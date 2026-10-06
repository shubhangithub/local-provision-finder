import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JobResponse } from './gov-hack.ts';

export class EnrichmentError extends Error {constructor(message:string,public status=400){super(message);}}
export type EnrichmentField='cost'|'openingTimes'|'eligibilitySummary'|'accessibility'|'referralRoute'|'address'|'publicPhone'|'publicEmail';
export interface WebFact {key:string;value:string;source_url?:string;quote?:string;valid_from?:string;valid_to?:string;topic?:string;source_type?:string}
export interface FactRow {key:string;label:string;value:string;sourceUrl?:string;sourceType:string;validFrom?:string;validTo?:string;outdated:boolean}
export interface Overwrite {id:string;serviceId:string;serviceName:string;runId:string;field:EnrichmentField;original:string;value:string;sourceUrl:string;quote:string;appliedAt:string;revertedAt:string|null;supersededAt:string|null}
export interface Run {id:string;serviceId:string;serviceName:string;jobId:string;status:'running'|'completed'|'error';outcome:string|null;result:Record<string,any>|null;error:string|null;context:Record<string,unknown>;startedAt:string;finishedAt:string|null}
export interface EnrichmentData {latest:Run;success?:Run;overwrites:Overwrite[]}
/** A run that never finished (for example the remote job was lost) stops blocking a new one after this long. */
export const staleRunMs=15*60*1000;
const checklistFields:Record<string,EnrichmentField|'contact'>={cost:'cost','session times':'openingTimes',eligibility:'eligibilitySummary',accessibility:'accessibility','how to book':'referralRoute',location:'address','contact details':'contact'};
const searchTextLimit=20000;

export function factLabel(key:string):string {const text=key.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();return text ? text[0].toUpperCase()+text.slice(1) : 'Detail';}
const iso=/^\d{4}(-\d{2}(-\d{2})?)?$/;
function endOf(value:string):number {
  if (!iso.test(value)) return Infinity;
  const [year,month,day]=value.split('-').map(Number);
  return month ? (day ? Date.UTC(year,month-1,day,23,59,59) : Date.UTC(year,month,0,23,59,59)) : Date.UTC(year,11,31,23,59,59);
}
export function factRows(result:Record<string,any>|null|undefined,now=new Date()):FactRow[] {
  const facts=Array.isArray(result?.facts) ? result!.facts as WebFact[] : [];
  return facts.filter(fact=>fact && typeof fact.key==='string' && typeof fact.value==='string' && fact.value.trim()).map(fact=>({
    key:fact.key,label:factLabel(fact.key),value:fact.value.trim(),sourceUrl:typeof fact.source_url==='string' ? fact.source_url : undefined,sourceType:fact.source_type ?? 'web',
    validFrom:fact.valid_from,validTo:fact.valid_to,outdated:!!fact.valid_to && endOf(fact.valid_to)<now.getTime(),
  }));
}
const emailPattern=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const phonePattern=/(?:\+44\s?\(?0?\)?|0)(?:[\s-]?\d){9,10}/;
/** Facts for the checklist topics become field values. A value is used only if it fits the field; anything else stays a fact row. */
export function mapFacts(result:Record<string,any>|null|undefined,now=new Date()):{field:EnrichmentField;value:string;sourceUrl:string;quote:string;keys:string[]}[] {
  const facts=(Array.isArray(result?.facts) ? result!.facts as WebFact[] : []).filter(fact=>fact && typeof fact.value==='string' && fact.value.trim() && typeof fact.topic==='string' && fact.source_url && !(fact.valid_to && endOf(fact.valid_to)<now.getTime()));
  const out=new Map<EnrichmentField,{values:string[];sourceUrl:string;quote:string;keys:string[]}>();
  const add=(field:EnrichmentField,value:string,fact:WebFact)=>{
    const entry=out.get(field);
    if (!entry) out.set(field,{values:[value],sourceUrl:fact.source_url!,quote:fact.quote ?? value,keys:[fact.key]});
    else if (!['address','publicPhone','publicEmail'].includes(field)) {if (!entry.values.includes(value)) entry.values.push(value);entry.keys.push(fact.key);}
  };
  for (const fact of facts) {
    const mapped=checklistFields[fact.topic!.trim().toLowerCase()];if (!mapped) continue;const value=fact.value.trim().slice(0,1000);
    if (mapped==='contact') {
      const email=emailPattern.exec(value)?.[0];const phone=phonePattern.exec(value)?.[0].replace(/\s+/g,' ').trim();
      if (email) add('publicEmail',email,fact);if (phone) add('publicPhone',phone,fact);
    } else add(mapped,value,fact);
  }
  return [...out].map(([field,entry])=>({field,value:entry.values.join('; '),sourceUrl:entry.sourceUrl,quote:entry.quote,keys:entry.keys}));
}
const text=(value:unknown)=>Array.isArray(value) ? value.join('; ') : value==null ? '' : String(value);
const same=(left:string,right:string)=>left.trim().toLowerCase().replace(/\s+/g,' ')===right.trim().toLowerCase().replace(/\s+/g,' ');

export class EnrichmentStore {
  private db:DatabaseSync;
  constructor(path:string) {
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS enrichment_runs(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,service_name TEXT NOT NULL,job_id TEXT NOT NULL,status TEXT NOT NULL,outcome TEXT,result_json TEXT,error TEXT,context_json TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT);
      CREATE INDEX IF NOT EXISTS enrichment_runs_service ON enrichment_runs(service_id,started_at);
      CREATE TABLE IF NOT EXISTS enrichment_overwrites(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,service_name TEXT NOT NULL,run_id TEXT NOT NULL,field TEXT NOT NULL,original TEXT NOT NULL,value TEXT NOT NULL,source_url TEXT NOT NULL,quote TEXT NOT NULL,applied_at TEXT NOT NULL,reverted_at TEXT,superseded_at TEXT);
      CREATE INDEX IF NOT EXISTS enrichment_overwrites_service ON enrichment_overwrites(service_id);`);
  }
  close() {this.db.close();}
  private run(row:Record<string,any>|undefined):Run | null {
    return row ? {id:row.id,serviceId:row.service_id,serviceName:row.service_name,jobId:row.job_id,status:row.status,outcome:row.outcome ?? null,result:row.result_json ? JSON.parse(row.result_json) : null,error:row.error ?? null,context:JSON.parse(row.context_json),startedAt:row.started_at,finishedAt:row.finished_at ?? null} : null;
  }
  private overwrite(row:Record<string,any>):Overwrite {
    return {id:row.id,serviceId:row.service_id,serviceName:row.service_name,runId:row.run_id,field:row.field,original:row.original,value:row.value,sourceUrl:row.source_url,quote:row.quote,appliedAt:row.applied_at,revertedAt:row.reverted_at ?? null,supersededAt:row.superseded_at ?? null};
  }
  getRun(id:string) {return this.run(this.db.prepare('SELECT * FROM enrichment_runs WHERE id=?').get(id));}
  latestRun(serviceId:string) {return this.run(this.db.prepare('SELECT * FROM enrichment_runs WHERE service_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1').get(serviceId));}
  /** The most recent run that produced a usable answer. Its facts and chunks are the ones in force. */
  latestSuccess(serviceId:string) {return this.run(this.db.prepare("SELECT * FROM enrichment_runs WHERE service_id=? AND status='completed' AND outcome IN ('found','partial') ORDER BY started_at DESC,rowid DESC LIMIT 1").get(serviceId));}
  /** Throws while a recent run is still in progress, so a second click never starts a second paid job. */
  assertIdle(serviceId:string,now=new Date()) {
    const active=this.latestRun(serviceId);
    if (active?.status==='running' && now.getTime()-Date.parse(active.startedAt)<staleRunMs) throw new EnrichmentError('This service is already being enriched.',409);
  }
  startRun(service:{id:string;name:string},jobId:string,context:Record<string,unknown>,now=new Date()):Run {
    this.assertIdle(service.id,now);
    const id=randomUUID();
    this.db.prepare('INSERT INTO enrichment_runs(id,service_id,service_name,job_id,status,context_json,started_at) VALUES(?,?,?,?,?,?,?)').run(id,service.id,service.name,jobId,'running',JSON.stringify(context),now.toISOString());
    return this.getRun(id)!;
  }
  /** Stores a finished job once. Calling it again for the same run changes nothing. */
  complete(runId:string,job:JobResponse,record:Record<string,any>,now=new Date()):Run {
    const run=this.getRun(runId);if (!run) throw new EnrichmentError('Enrichment run not found.',404);
    if (run.status!=='running') return run;
    if (job.status==='queued' || job.status==='running') return run;
    const finished=now.toISOString();
    if (job.status==='error' || !job.result) {
      this.db.prepare("UPDATE enrichment_runs SET status='error',error=?,finished_at=? WHERE id=? AND status='running'").run(String(job.error?.message||job.error?.code||'The enrichment job failed.').slice(0,500),finished,runId);
      return this.getRun(runId)!;
    }
    const outcome=String(job.result.outcome ?? '');
    this.db.exec('BEGIN');
    try {
      this.db.prepare("UPDATE enrichment_runs SET status='completed',outcome=?,result_json=?,finished_at=? WHERE id=? AND status='running'").run(outcome,JSON.stringify(job.result),finished,runId);
      if (['found','partial'].includes(outcome)) this.applyOverwrites(run,job.result,record,now);
      this.db.exec('COMMIT');
    } catch (error) {this.db.exec('ROLLBACK');throw error;}
    return this.getRun(runId)!;
  }
  private applyOverwrites(run:Run,result:Record<string,any>,record:Record<string,any>,now:Date) {
    for (const change of mapFacts(result,now)) {
      const history=this.db.prepare('SELECT * FROM enrichment_overwrites WHERE service_id=? AND field=? ORDER BY rowid DESC').all(run.serviceId,change.field).map(row=>this.overwrite(row));
      const active=history.find(item=>!item.revertedAt && !item.supersededAt);
      const reverted=history.find(item=>item.revertedAt && same(item.value,change.value));
      const original=active?.original ?? text(record[change.field]);
      if (active && same(active.value,change.value)) continue;
      // A value staff already reverted is not reapplied; a different one is.
      if (reverted && !active) continue;
      if (same(original,change.value)) continue;
      if (active) this.db.prepare('UPDATE enrichment_overwrites SET superseded_at=? WHERE id=?').run(now.toISOString(),active.id);
      this.db.prepare('INSERT INTO enrichment_overwrites VALUES(?,?,?,?,?,?,?,?,?,?,NULL,NULL)').run(randomUUID(),run.serviceId,run.serviceName,run.id,change.field,original,change.value,change.sourceUrl,change.quote,now.toISOString());
    }
  }
  overwrites(serviceId:string,includeInactive=false):Overwrite[] {
    return this.db.prepare(`SELECT * FROM enrichment_overwrites WHERE service_id=? ${includeInactive?'':'AND reverted_at IS NULL AND superseded_at IS NULL'} ORDER BY rowid DESC`).all(serviceId).map(row=>this.overwrite(row));
  }
  recent(limit=100):Overwrite[] {return this.db.prepare('SELECT * FROM enrichment_overwrites WHERE superseded_at IS NULL ORDER BY rowid DESC LIMIT ?').all(limit).map(row=>this.overwrite(row));}
  revert(id:string,serviceId?:string,now=new Date()):Overwrite {
    const row=this.db.prepare('SELECT * FROM enrichment_overwrites WHERE id=?').get(id);
    if (!row || (serviceId && row.service_id!==serviceId)) throw new EnrichmentError('Overwrite not found.',404);
    if (row.reverted_at || row.superseded_at) throw new EnrichmentError('This overwrite is no longer in effect.',409);
    this.db.prepare('UPDATE enrichment_overwrites SET reverted_at=? WHERE id=?').run(now.toISOString(),id);
    return this.overwrite(this.db.prepare('SELECT * FROM enrichment_overwrites WHERE id=?').get(id)!);
  }
  data(serviceId:string):EnrichmentData | undefined {
    const latest=this.latestRun(serviceId);if (!latest) return undefined;
    return {latest,success:this.latestSuccess(serviceId) ?? undefined,overwrites:this.overwrites(serviceId)};
  }
  /** Everything needed to overlay the catalogue, read in one pass. */
  all():Map<string,EnrichmentData> {
    const map=new Map<string,EnrichmentData>();
    for (const row of this.db.prepare('SELECT DISTINCT service_id FROM enrichment_runs').all()) {const data=this.data(String(row.service_id));if (data) map.set(String(row.service_id),data);}
    return map;
  }
}
export function readEnrichment(directory:string):Map<string,EnrichmentData> {
  const path=resolve(directory,'enrichment.sqlite');if (!existsSync(path)) return new Map();
  const store=new EnrichmentStore(path);try {return store.all();} finally {store.close();}
}
export function enrichmentSearchText(result:Record<string,any>|null|undefined):string {
  const rows=factRows(result).filter(row=>!row.outdated).map(row=>`${row.label}: ${row.value}`);
  const chunks=(Array.isArray(result?.chunks) ? result!.chunks as {text?:unknown}[] : []).map(chunk=>typeof chunk?.text==='string' ? chunk.text : '').filter(Boolean);
  const body=[rows.length ? rows.join('\n') : '',...chunks].filter(Boolean).join('\n');
  return body ? `Enriched from the web:\n${body}`.slice(0,searchTextLimit) : '';
}
/** Applies the enrichment to a record at read time. The stored catalogue record is never changed. */
export function enrichmentOverlay<T extends {id:string;searchText?:string;fieldCheckedAt?:Record<string,string>}>(record:T,data:EnrichmentData | undefined):T & {enrichment?:{enrichedAt:string;facts:FactRow[];overwrites:{id:string;field:string;sourceUrl:string}[]}} {
  if (!data?.success) return record;
  const updated:Record<string,any>={...record};const applied:{id:string;field:string;sourceUrl:string}[]=[];
  for (const change of data.overwrites) {
    // A staff-verified correction newer than the overwrite wins.
    const checked=Date.parse(record.fieldCheckedAt?.[change.field] ?? '');
    if (Number.isFinite(checked) && checked>Date.parse(change.appliedAt)) continue;
    updated[change.field]=change.field==='accessibility' ? [change.value] : change.value;applied.push({id:change.id,field:change.field,sourceUrl:change.sourceUrl});
  }
  const body=enrichmentSearchText(data.success.result);
  if (body) updated.searchText=`${body}\n\n${record.searchText ?? ''}`;
  // A fact already shown in a standard field is not listed again. A fact whose field was reverted, or that was not applied, stays as its own row.
  const appliedFields=new Set(applied.map(item => item.field));const consumed=new Set<string>();
  for (const change of mapFacts(data.success.result)) if (appliedFields.has(change.field) || same(text((record as Record<string,unknown>)[change.field]),change.value)) change.keys.forEach(key => consumed.add(key));
  updated.enrichment={enrichedAt:data.success.finishedAt ?? data.success.startedAt,facts:factRows(data.success.result).filter(row => !consumed.has(row.key)),overwrites:applied};
  return updated as T;
}
