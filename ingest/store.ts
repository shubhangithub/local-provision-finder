import { DatabaseSync } from 'node:sqlite';
import type { ServiceRecord } from './normalise.ts';
export class Store {
 db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec(`
 CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, postcode TEXT, lat REAL,lng REAL, vetting TEXT NOT NULL, availability TEXT NOT NULL, record_json TEXT NOT NULL, search_text TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS services_postcode ON services(postcode);
 CREATE INDEX IF NOT EXISTS services_geo ON services(lat,lng);
 CREATE TABLE IF NOT EXISTS service_needs(service_id TEXT NOT NULL, need TEXT NOT NULL, PRIMARY KEY(service_id,need));
 CREATE INDEX IF NOT EXISTS needs_lookup ON service_needs(need);
 CREATE TABLE IF NOT EXISTS ingest_runs(id INTEGER PRIMARY KEY, source TEXT,started TEXT,finished TEXT,expected INTEGER,fetched INTEGER,written INTEGER,skipped INTEGER,removed INTEGER,status TEXT,errors TEXT);
 `);}
 start(source:string){return Number(this.db.prepare("INSERT INTO ingest_runs(source,started,status) VALUES(?,?,'running')").run(source,new Date().toISOString()).lastInsertRowid);}
 finish(id:number,report:any){this.db.prepare('UPDATE ingest_runs SET finished=?,expected=?,fetched=?,written=?,skipped=?,removed=?,status=?,errors=? WHERE id=?').run(new Date().toISOString(),report.expected??0,report.fetched??0,report.written??0,report.skipped??0,report.removed??0,report.status,report.error??null,id);}
 upsertComplete(source:string,records:ServiceRecord[],allowRemoval:boolean){
  this.db.exec('BEGIN');let removed=0;
  try {
   const seen=new Set(records.map(r=>r.id));
   const upsert=this.db.prepare(`INSERT INTO services VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET postcode=excluded.postcode,lat=excluded.lat,lng=excluded.lng,availability=excluded.availability,record_json=excluded.record_json,search_text=excluded.search_text`);
   for(const r of records){const existing=this.db.prepare('SELECT vetting FROM services WHERE id=?').get(r.id);if(existing)r.vetting=existing.vetting as any;
    upsert.run(r.id,source,r.postcode,r.lat,r.lng,r.vetting,r.availability,JSON.stringify(r),r.searchText);this.db.prepare('DELETE FROM service_needs WHERE service_id=?').run(r.id);for(const need of r.needs)this.db.prepare('INSERT INTO service_needs VALUES(?,?)').run(r.id,need);
   }
   if(allowRemoval)for(const row of this.db.prepare('SELECT id,record_json FROM services WHERE source_id=?').all(source)){if(!seen.has(row.id as string)){const r=JSON.parse(row.record_json as string);if(r.availability!=='Removed at source')removed++;r.availability='Removed at source';this.db.prepare("UPDATE services SET availability='Removed at source',record_json=? WHERE id=?").run(JSON.stringify(r),row.id);}}
   this.db.exec('COMMIT');return removed;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 records(){return this.db.prepare('SELECT record_json FROM services ORDER BY id').all().map(row=>JSON.parse(row.record_json as string));}
 close(){this.db.close();}
}
