import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class FollowUpError extends Error {constructor(message:string,public status=400){super(message);}}
/** How long a number is kept if its follow-up never finishes. */
export const retentionDays=30;
/** The call service takes at most this many services in one call. */
export const maxServices=5;
export type FollowUpStatus='scheduled'|'requested'|'completed'|'denied'|'failed'|'expired';
export interface FollowUpService {id:string;name:string}
export interface FollowUp {id:string;personName:string|null;services:FollowUpService[];status:FollowUpStatus;followupId:string|null;consentedAt:string;requestedAt:string|null;finishedAt:string|null;outcome:string|null;reason:string|null;reportIds:string[]}
/** Accepts UK numbers (leading 0) and international numbers (leading +) and returns them without spaces or punctuation. */
export function normalisePhone(value:unknown):string {
  const raw=typeof value==='string' ? value.trim() : '';
  const cleaned=raw.replace(/[\s().-]/g,'');
  if (!/^(\+[1-9]\d{7,14}|0\d{9,10})$/.test(cleaned)) throw new FollowUpError('Enter a UK phone number or an international number starting with +.');
  return cleaned;
}
/** A first name is optional, used only to ask for the person by name. */
export function normaliseName(value:unknown):string | null {
  if (value===undefined || value===null || value==='') return null;
  if (typeof value!=='string') throw new FollowUpError('Check the first name.');
  const name=value.replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();
  if (name.length>40) throw new FollowUpError('Keep the first name within 40 characters.');
  return name || null;
}
export class FollowUpStore {
  private db:DatabaseSync;
  constructor(path:string) {
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS meeting_follow_ups(id TEXT PRIMARY KEY,person_name TEXT,phone TEXT,consented_at TEXT NOT NULL,services_json TEXT NOT NULL,status TEXT NOT NULL,followup_id TEXT,requested_at TEXT,finished_at TEXT,outcome TEXT,reason TEXT,report_ids TEXT NOT NULL DEFAULT '[]')`);
    // Follow-ups used to be asked for on the feedback form. Any number left from then is deleted.
    const legacy=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_ups'").get();
    if (legacy) this.db.exec("UPDATE follow_ups SET phone=NULL WHERE phone IS NOT NULL");
  }
  close() {this.db.close();}
  private view(row:Record<string,any>):FollowUp {
    return {id:row.id,personName:row.person_name ?? null,services:JSON.parse(row.services_json),status:row.status,followupId:row.followup_id ?? null,consentedAt:row.consented_at,requestedAt:row.requested_at ?? null,finishedAt:row.finished_at ?? null,outcome:row.outcome ?? null,reason:row.reason ?? null,reportIds:JSON.parse(row.report_ids)};
  }
  /** Removes numbers whose follow-up never finished within the retention period. */
  purgeExpired(now=new Date()) {
    const cutoff=new Date(now.getTime()-retentionDays*86400000).toISOString();
    this.db.prepare("UPDATE meeting_follow_ups SET phone=NULL,status='expired',finished_at=? WHERE phone IS NOT NULL AND consented_at<?").run(now.toISOString(),cutoff);
  }
  create(input:{personName:string|null;phone:string;services:FollowUpService[]},now=new Date()):FollowUp {
    if (!input.services.length) throw new FollowUpError('Choose at least one service to follow up on.');
    if (input.services.length>maxServices) throw new FollowUpError(`Follow up on at most ${maxServices} services.`);
    const id=randomUUID();
    this.db.prepare("INSERT INTO meeting_follow_ups(id,person_name,phone,consented_at,services_json,status) VALUES(?,?,?,?,?,'scheduled')").run(id,input.personName,input.phone,now.toISOString(),JSON.stringify(input.services));
    return this.get(id,now)!;
  }
  get(id:string,now=new Date()):FollowUp | null {this.purgeExpired(now);const row=this.db.prepare('SELECT * FROM meeting_follow_ups WHERE id=?').get(id);return row ? this.view(row) : null;}
  /** Staff-facing list, newest first. It never includes a phone number. */
  list(now=new Date()):FollowUp[] {this.purgeExpired(now);return this.db.prepare('SELECT * FROM meeting_follow_ups ORDER BY rowid DESC').all().map(row=>this.view(row));}
  /** Marks the follow-up as requested and returns the number to call. Only a scheduled, denied or failed follow-up can start. */
  begin(id:string,now=new Date()):{phone:string;followUp:FollowUp} {
    this.purgeExpired(now);
    const row=this.db.prepare('SELECT * FROM meeting_follow_ups WHERE id=?').get(id);
    if (!row) throw new FollowUpError('Follow-up not found.',404);
    if (['requested','completed'].includes(String(row.status))) throw new FollowUpError('This follow-up has already been placed.',409);
    if (!row.phone || row.status==='expired') throw new FollowUpError('The number for this follow-up has been deleted.',410);
    this.db.prepare("UPDATE meeting_follow_ups SET status='requested',requested_at=?,reason=NULL,followup_id=NULL WHERE id=?").run(now.toISOString(),id);
    return {phone:String(row.phone),followUp:this.get(id,now)!};
  }
  attach(id:string,followupId:string) {this.db.prepare("UPDATE meeting_follow_ups SET followup_id=? WHERE id=? AND status='requested'").run(followupId,id);}
  /** Ends a requested follow-up once. Completing it deletes the number; a refusal keeps it so staff can try again. Returns false if it had already ended. */
  finish(id:string,status:'completed'|'denied'|'failed',details:{outcome?:string|null;reason?:string|null;reportIds?:string[]},now=new Date()):boolean {
    const result=this.db.prepare(`UPDATE meeting_follow_ups SET status=?,outcome=?,reason=?,report_ids=?,finished_at=?${status==='completed' ? ',phone=NULL' : ''} WHERE id=? AND status='requested'`).run(status,details.outcome ?? null,details.reason ?? null,JSON.stringify(details.reportIds ?? []),now.toISOString(),id);
    return Number(result.changes)>0;
  }
  setReports(id:string,reportIds:string[]) {this.db.prepare('UPDATE meeting_follow_ups SET report_ids=? WHERE id=?').run(JSON.stringify(reportIds),id);}
  /** Used only when the request to the follow-up service itself failed, so staff can retry. */
  release(id:string,reason:string) {this.db.prepare("UPDATE meeting_follow_ups SET status='failed',reason=? WHERE id=? AND status='requested'").run(reason,id);}
}
export function readFollowUps(directory:string):FollowUp[] {
  const path=resolve(directory,'follow-ups.sqlite');if (!existsSync(path)) return [];
  const store=new FollowUpStore(path);try {return store.list();} finally {store.close();}
}
