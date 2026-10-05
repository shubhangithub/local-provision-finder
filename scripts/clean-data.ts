import { readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import type { ServiceRecord } from '../ingest/normalise.ts';
const sourceDb=new DatabaseSync('data/services.sqlite',{readOnly:true});
sourceDb.exec('PRAGMA busy_timeout=5000');
const input:ServiceRecord[]=sourceDb.prepare('SELECT record_json FROM services').all().map(row=>JSON.parse(String(row.record_json)));
sourceDb.close();
await writeFile('data/services.internal.json',JSON.stringify(input,null,2)+'\n');
const key=(r:ServiceRecord)=>r.id.split(':')[0]+'|'+r.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+r.provider.toLowerCase().replace(/[^a-z0-9]/g,'');
const groups=new Map<string,ServiceRecord[]>();
for(const record of input)groups.set(key(record),[...(groups.get(key(record))??[]),record]);
const unique=<T,>(values:T[]):T[]=>[...new Map(values.map(value=>[JSON.stringify(value),value])).values()];
const newest=(dates:(string|null)[])=>dates.filter((d):d is string=>!!d).sort().at(-1)??null;
const cleaned=Array.from(groups.values()).map(group=>{
 const {raw:_raw,confidence:_confidence,verificationStatus:_status,...record}=group[0];
 const locations=unique(group.flatMap(r=>{
  const raw=r.raw as Record<string,any>;
  return (raw.service_at_locations??[]).map((item:any)=>({location:r.id.startsWith('buckinghamshire-oruk:')?{...item.location,latitude:item.location?.geometry?.coordinates?.[1]??null,longitude:item.location?.geometry?.coordinates?.[0]??null,postcode:item.location?.postal_code??null}:item.location,regular_schedule:item.regular_schedule??item.regular_opening_hours??[],holiday_schedule:item.holiday_opening_hours??[]}));
 }));
 const searchText=unique(group.map(r=>r.searchText.split('\n').filter(line=>!/^\s*(minimum_age|maximum_age|min_age|max_age)\s*:/i.test(line)).join('\n'))).join('\n\n');
 return {...record,description:unique(group.map(r=>r.description).filter(Boolean)).join('\n\n'),categories:unique(group.flatMap(r=>r.categories)),needs:unique(group.flatMap(r=>r.needs)),contacts:unique(group.flatMap(r=>[...r.contacts,...(r.publicPhone||r.publicEmail?[{name:r.provider,phone:r.publicPhone,email:r.publicEmail,sourceUrl:r.sourceUrl,fetchedAt:r.fetchedAt}]:[])])),accessibility:unique(group.flatMap(r=>r.accessibility)),lastVerified:newest(group.map(r=>r.lastVerified)),sourceUpdatedAt:newest(group.map(r=>r.sourceUpdatedAt)),searchText,locations,sourceRecordIds:group.map(r=>r.id),sourceRecordUrls:group.map(r=>r.sourceUrl)};
});
const db=new DatabaseSync('data/services.sqlite');
try{
 db.exec('CREATE TABLE IF NOT EXISTS catalogue_services(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, postcode TEXT, lat REAL, lng REAL, vetting TEXT NOT NULL, availability TEXT NOT NULL, record_json TEXT NOT NULL, search_text TEXT NOT NULL); CREATE INDEX IF NOT EXISTS catalogue_postcode ON catalogue_services(postcode);');
 db.exec('BEGIN');
 try{db.exec('DELETE FROM catalogue_services');const insert=db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)');for(const row of cleaned)insert.run(row.id,row.id.split(':')[0],row.postcode,row.lat,row.lng,row.vetting,row.availability,JSON.stringify(row),row.searchText);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}finally{db.close();}
await writeFile('data/services.cleaned.json',JSON.stringify(cleaned,null,2)+'\n');
const merges=Array.from(groups.values()).filter(group=>group.length>1).map(group=>({canonicalId:group[0].id,name:group[0].name,provider:group[0].provider,sourceIds:group.map(r=>r.id)}));
await writeFile('data/deduplication-report.json',JSON.stringify({originalCount:input.length,cleanedCount:cleaned.length,rowsConsolidated:input.length-cleaned.length,rule:'Same source, normalized service name and provider. Combine contacts, locations and descriptions; preserve all source IDs. Original responses archived separately.',groups:merges},null,2)+'\n');
console.log(`Consolidated ${input.length-cleaned.length} duplicate rows: ${input.length} source records → ${cleaned.length} listings. Original source records preserved.`);
