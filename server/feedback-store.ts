import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { feedbackFields, type FeedbackAnswers, type FeedbackEntry, type FeedbackField, type ProposedChange } from '../src/lib/feedback.ts';
export interface FeedbackService {id:string;name:string;[key:string]:unknown}
export class FeedbackInputError extends Error { status=400; }
function fail(message:string):never {throw new FeedbackInputError(message);}
function object(value:unknown):Record<string,unknown> {return value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : fail('Expected an object.');}
export class FeedbackStore {
  db:DatabaseSync;
  constructor(path:string) {
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,entry_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS feedback_service ON feedback(service_id);
      CREATE TABLE IF NOT EXISTS corrections(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,field TEXT NOT NULL,value TEXT NOT NULL,reviewed_at TEXT NOT NULL,feedback_id TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS corrections_service ON corrections(service_id);`);
  }
  close() {this.db.close();}
  list(status?:string):FeedbackEntry[] {
    const entries=this.db.prepare('SELECT entry_json FROM feedback ORDER BY rowid DESC').all().map(row => JSON.parse(String(row.entry_json)) as FeedbackEntry);
    return status ? entries.filter(entry => entry.status===status) : entries;
  }
  get(id:string):FeedbackEntry | null {const row=this.db.prepare('SELECT entry_json FROM feedback WHERE id=?').get(id);return row ? JSON.parse(String(row.entry_json)) : null;}
  /** `proposed` can only be passed by trusted server code, never from a request body. */
  submit(service:FeedbackService,input:unknown,proposed?:ProposedChange):FeedbackEntry {
    const payload=object(input), answers=object(payload.answers);
    if (!['yes','changed','unsure'].includes(String(answers.upToDate))) fail('Answer whether the information is up to date.');
    if (answers.availability!==undefined && !['open','waiting','closed','unsure'].includes(String(answers.availability))) fail('Invalid availability answer.');
    if (answers.contact!==undefined && !['yes','no','not-tried'].includes(String(answers.contact))) fail('Invalid contact answer.');
    if (answers.recommendation!==undefined && !['yes','no','not-tried'].includes(String(answers.recommendation))) fail('Invalid recommendation feedback.');
    if (answers.location!==undefined && !['yes','no','not-tried'].includes(String(answers.location))) fail('Invalid location answer.');
    if (!Array.isArray(answers.issues) || answers.issues.length>Object.keys(feedbackFields).length || answers.issues.some(field => typeof field!=='string' || !Object.hasOwn(feedbackFields,field))) fail('Choose valid details to check.');
    const note=payload.note===undefined ? '' : typeof payload.note==='string' ? payload.note.trim() : fail('Invalid note.');
    if (note.length>1000) fail('Keep the note within 1,000 characters.');
    const clean:FeedbackAnswers={upToDate:answers.upToDate as FeedbackAnswers['upToDate'],issues:[...new Set(answers.issues as FeedbackField[])]};
    for (const key of ['availability','contact','location','recommendation'] as const) if (answers[key]!==undefined) Object.assign(clean,{[key]:answers[key]});
    if (clean.availability==='closed' || clean.availability==='waiting') clean.issues=[...new Set([...clean.issues,'availability' as const])];
    if (clean.contact==='no') clean.issues=[...new Set([...clean.issues,...(['publicPhone','publicEmail'] as const).filter(field => service[field])])];
    if (clean.location==='no') clean.issues=[...new Set([...clean.issues,'address' as const])];
    const entry:FeedbackEntry={id:randomUUID(),serviceId:service.id,serviceName:service.name,createdAt:new Date().toISOString(),status:'pending',answers:clean,note,...(proposed ? {proposed} : {})};
    this.db.prepare('INSERT INTO feedback VALUES(?,?,?)').run(entry.id,service.id,JSON.stringify(entry));return entry;
  }
  review(id:string,service:FeedbackService,input:unknown):FeedbackEntry {
    const entry=this.get(id);if (!entry || entry.serviceId!==service.id) {const error=new FeedbackInputError('Feedback not found.');error.status=404;throw error;}
    const payload=object(input);const action=String(payload.action);
    if (!['checking','checked','corrected','dismissed'].includes(action)) fail('Choose a review outcome.');
    const note=typeof payload.note==='string' ? payload.note.trim() : '';
    if (!note || note.length>2000) fail('Record the evidence or reason for this decision (up to 2,000 characters).');
    if (['checked','corrected'].includes(action) && payload.verified!==true) fail('Check the evidence before resolving or correcting a report.');
    if (['resolved','dismissed'].includes(entry.status)) fail('This report has already been reviewed.');
    const reviewedAt=new Date().toISOString();
    const review:NonNullable<FeedbackEntry['review']>={action,note,reviewedAt};
    if (action==='corrected') {
      const field=String(payload.field);
      if (!Object.hasOwn(feedbackFields,field)) fail('Choose a field to correct.');
      if (typeof payload.newValue!=='string' || !payload.newValue.trim() || payload.newValue.trim().length>10000) fail('Enter the checked correction.');
      const value=payload.newValue.trim();
      if (field==='url') {try {if (!['https:','http:'].includes(new URL(value).protocol)) fail('Use an http or https website.');} catch {fail('Use a valid website URL.');}}
      if (field==='publicEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('Use a valid email address.');
      if (field==='publicPhone' && value.replace(/\D/g,'').length<6) fail('Use a valid phone number.');
      if (field==='postcode' && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value)) fail('Use a full UK postcode.');
      if (field==='availability' && !['Open','Waiting list','Closed','Unknown'].includes(value)) fail('Choose Open, Waiting list, Closed or Unknown.');
      review.field=field as FeedbackField;review.previousValue=String(service[field] ?? '');review.newValue=value;
    }
    const next:FeedbackEntry={...entry,status:action==='checking' ? 'checking' : action==='dismissed' ? 'dismissed' : 'resolved',review};
    this.db.exec('BEGIN');
    try {
      this.db.prepare('UPDATE feedback SET entry_json=? WHERE id=?').run(JSON.stringify(next),id);
      if (review.field) this.db.prepare('INSERT INTO corrections VALUES(?,?,?,?,?,?)').run(randomUUID(),service.id,review.field,review.newValue!,reviewedAt,id);
      this.db.exec('COMMIT');return next;
    } catch (error) {this.db.exec('ROLLBACK');throw error;}
  }
  corrected<T extends FeedbackService>(service:T):T {
    const updated={...service};
    const changes=this.db.prepare('SELECT field,value,reviewed_at FROM corrections WHERE service_id=? ORDER BY rowid').all(service.id);
    const checks:Record<string,string>={};
    const searchUpdates:string[]=[];
    for (const change of changes) {
      const field=String(change.field) as FeedbackField;Object.assign(updated,{[field]:String(change.value)});checks[field]=String(change.reviewed_at);searchUpdates.push(`${feedbackFields[field]}: ${change.value}`);
      if (field==='address' || field==='postcode') {
        // An edited address cannot inherit coordinates for the previous venue.
        Object.assign(updated,{lat:null,lng:null,locations:[]});
        if (field==='address') Object.assign(updated,{postcode:null});
      }
    }
    if (changes.length) Object.assign(updated,{fieldCheckedAt:checks,searchText:`Checked service corrections:\n${searchUpdates.join('\n')}\n${service.searchText ?? ''}`});
    return updated;
  }
}
