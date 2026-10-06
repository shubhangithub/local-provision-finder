import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class FollowUpError extends Error {constructor(message:string,public status=400){super(message);}}
/** How long a number is kept if its follow-up never finishes. */
export const retentionDays=30;
export type FollowUpStatus='scheduled'|'requested'|'completed'|'denied'|'failed'|'expired';
export interface FollowUp {feedbackId:string;serviceId:string;serviceName:string;status:FollowUpStatus;followupId:string|null;consentedAt:string;requestedAt:string|null;finishedAt:string|null;outcome:string|null;reason:string|null;reportIds:string[]}
/** Accepts UK numbers (leading 0) and international numbers (leading +) and returns them without spaces or punctuation. */
export function normalisePhone(value:unknown):string {
  const raw=typeof value==='string' ? value.trim() : '';
  const cleaned=raw.replace(/[\s().-]/g,'');
  if (!/^(\+[1-9]\d{7,14}|0\d{9,10})$/.test(cleaned)) throw new FollowUpError('Enter a UK phone number or an international number starting with +.');
  return cleaned;
}
/** Reads the optional follow-up block of a feedback submission. Consent is needed for a number, and a number for consent. */
export function validateFollowUp(value:unknown):{phone:string} | null {
  if (value===undefined || value===null) return null;
  if (typeof value!=='object' || Array.isArray(value)) throw new FollowUpError('Invalid follow-up details.');
  const input=value as Record<string,unknown>;const phone=typeof input.phone==='string' ? input.phone.trim() : '';
  if (!phone && input.consent!==true) return null;
  if (!phone) throw new FollowUpError('Enter a phone number to be called on, or untick the follow-up box.');
  if (input.consent!==true) throw new FollowUpError('Tick the box to agree to a follow-up call, or remove the phone number.');
  return {phone:normalisePhone(phone)};
}
export class FollowUpStore {
  private db:DatabaseSync;
  constructor(path:string) {
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS follow_ups(feedback_id TEXT PRIMARY KEY,service_id TEXT NOT NULL,service_name TEXT NOT NULL,phone TEXT,consented_at TEXT NOT NULL,status TEXT NOT NULL,followup_id TEXT,requested_at TEXT,finished_at TEXT,outcome TEXT,reason TEXT,report_ids TEXT NOT NULL DEFAULT '[]')`);
  }
  close() {this.db.close();}
  private view(row:Record<string,any>):FollowUp {
    return {feedbackId:row.feedback_id,serviceId:row.service_id,serviceName:row.service_name,status:row.status,followupId:row.followup_id ?? null,consentedAt:row.consented_at,requestedAt:row.requested_at ?? null,finishedAt:row.finished_at ?? null,outcome:row.outcome ?? null,reason:row.reason ?? null,reportIds:JSON.parse(row.report_ids)};
  }
  /** Removes numbers whose follow-up never finished within the retention period. */
  purgeExpired(now=new Date()) {
    const cutoff=new Date(now.getTime()-retentionDays*86400000).toISOString();
    this.db.prepare("UPDATE follow_ups SET phone=NULL,status='expired',finished_at=? WHERE phone IS NOT NULL AND consented_at<?").run(now.toISOString(),cutoff);
  }
  record(feedbackId:string,service:{id:string;name:string},phone:string,now=new Date()) {
    this.db.prepare("INSERT INTO follow_ups(feedback_id,service_id,service_name,phone,consented_at,status) VALUES(?,?,?,?,?,'scheduled')").run(feedbackId,service.id,service.name,phone,now.toISOString());
  }
  get(feedbackId:string,now=new Date()):FollowUp | null {this.purgeExpired(now);const row=this.db.prepare('SELECT * FROM follow_ups WHERE feedback_id=?').get(feedbackId);return row ? this.view(row) : null;}
  /** Staff-facing list. It never includes a phone number. */
  list(now=new Date()):FollowUp[] {this.purgeExpired(now);return this.db.prepare('SELECT * FROM follow_ups ORDER BY rowid DESC').all().map(row=>this.view(row));}
  /** Marks the follow-up as requested and returns the number to call. Only a scheduled, denied or failed follow-up can start. */
  begin(feedbackId:string,now=new Date()):{phone:string;followUp:FollowUp} {
    this.purgeExpired(now);
    const row=this.db.prepare('SELECT * FROM follow_ups WHERE feedback_id=?').get(feedbackId);
    if (!row) throw new FollowUpError('This report has no follow-up consent.',404);
    if (['requested','completed'].includes(String(row.status))) throw new FollowUpError('This follow-up has already been placed.',409);
    if (!row.phone || row.status==='expired') throw new FollowUpError('The number for this follow-up has been deleted.',410);
    this.db.prepare("UPDATE follow_ups SET status='requested',requested_at=?,reason=NULL,followup_id=NULL WHERE feedback_id=?").run(now.toISOString(),feedbackId);
    return {phone:String(row.phone),followUp:this.get(feedbackId,now)!};
  }
  attach(feedbackId:string,followupId:string) {this.db.prepare("UPDATE follow_ups SET followup_id=? WHERE feedback_id=? AND status='requested'").run(followupId,feedbackId);}
  /** Ends a requested follow-up once. Completing it deletes the number; a refusal keeps it so staff can try again. Returns false if it had already ended. */
  finish(feedbackId:string,status:'completed'|'denied'|'failed',details:{outcome?:string|null;reason?:string|null;reportIds?:string[]},now=new Date()):boolean {
    const result=this.db.prepare(`UPDATE follow_ups SET status=?,outcome=?,reason=?,report_ids=?,finished_at=?${status==='completed' ? ',phone=NULL' : ''} WHERE feedback_id=? AND status='requested'`).run(status,details.outcome ?? null,details.reason ?? null,JSON.stringify(details.reportIds ?? []),now.toISOString(),feedbackId);
    return Number(result.changes)>0;
  }
  setReports(feedbackId:string,reportIds:string[]) {this.db.prepare('UPDATE follow_ups SET report_ids=? WHERE feedback_id=?').run(JSON.stringify(reportIds),feedbackId);}
  /** Used only when the request to the follow-up service itself failed, so staff can retry. */
  release(feedbackId:string,reason:string) {this.db.prepare("UPDATE follow_ups SET status='failed',reason=? WHERE feedback_id=? AND status='requested'").run(reason,feedbackId);}
}
export function readFollowUps(directory:string):FollowUp[] {
  const path=resolve(directory,'follow-ups.sqlite');if (!existsSync(path)) return [];
  const store=new FollowUpStore(path);try {return store.list();} finally {store.close();}
}
