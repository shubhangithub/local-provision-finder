import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class TagsInputError extends Error {}
export function normaliseTags(value:unknown):string[] {
  if (!Array.isArray(value) || value.length>20) throw new TagsInputError('Choose up to 20 tags.');
  const tags:string[]=[];const seen=new Set<string>();
  for (const item of value) {
    if (typeof item!=='string') throw new TagsInputError('Each tag must be text.');
    const tag=item.trim().replace(/\s+/g,' ');
    if (!tag || tag.length>40 || /[\u0000-\u001f\u007f]/.test(tag)) throw new TagsInputError('Tags must contain 1 to 40 characters.');
    const key=tag.toLocaleLowerCase('en-GB');if (!seen.has(key)) {seen.add(key);tags.push(tag);}
  }
  return tags;
}
export class TagsStore {
  private db:DatabaseSync;
  constructor(path:string) {this.db=new DatabaseSync(path);this.db.exec('CREATE TABLE IF NOT EXISTS service_tags (service_id TEXT PRIMARY KEY, tags_json TEXT NOT NULL, updated_at TEXT NOT NULL)');}
  get(serviceId:string):string[] {const row=this.db.prepare('SELECT tags_json FROM service_tags WHERE service_id=?').get(serviceId);return row ? JSON.parse(String(row.tags_json)) : [];}
  list(serviceIds?:string[]):Map<string,string[]> {
    const entries=new Map<string,string[]>();const wanted=serviceIds ? new Set(serviceIds) : null;
    for (const row of this.db.prepare('SELECT service_id,tags_json FROM service_tags').all()) {const id=String(row.service_id);if (!wanted || wanted.has(id)) entries.set(id,JSON.parse(String(row.tags_json)));}
    return entries;
  }
  save(serviceId:string,value:unknown):string[] {
    const tags=normaliseTags(value);
    this.db.prepare('INSERT INTO service_tags(service_id,tags_json,updated_at) VALUES(?,?,?) ON CONFLICT(service_id) DO UPDATE SET tags_json=excluded.tags_json,updated_at=excluded.updated_at').run(serviceId,JSON.stringify(tags),new Date().toISOString());
    return tags;
  }
  close() {this.db.close();}
}
export function readServiceTags(serviceIds?:string[]):Map<string,string[]> {
  const path=resolve(process.cwd(),'data/tags.sqlite');if (!existsSync(path)) return new Map();
  const store=new TagsStore(path);try {return store.list(serviceIds);} finally {store.close();}
}
