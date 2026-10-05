import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sanitise, normalise } from './normalise.ts';
export const sources = [
 {sourceId:'bristol-oruk',name:'Bristol City Council / Well Aware',baseUrl:'https://bristol.openplace.directory/o/OpenReferralService/v3',kind:'oruk',licensed:true,licence:'Open Government Licence (OGL), version not stated',terms:'https://www.wellaware.org.uk/terms-and-conditions-open-place-directory-account/'},
 {sourceId:'kingston-ck',name:'Connected Kingston',baseUrl:'https://api.connectedkingston.uk/core/v1',kind:'kingston',licensed:true,licence:'Data reuse approved by the user on 5 October 2026 for this project; no general open-data licence asserted',terms:'https://connectedkingston.uk/terms-and-conditions'},
 {sourceId:'buckinghamshire-oruk',name:'Buckinghamshire Family Information Service',baseUrl:'https://api.familyinfo.buckinghamshire.gov.uk/api/v1',kind:'bucks',licensed:true,licence:'Open Government Licence v3.0, except where otherwise stated',terms:'https://directory.familyinfo.buckinghamshire.gov.uk/'},
];
export class CachedClient {
 lastRequest=0; refresh:boolean; directory:string;
 constructor(directory:string,refresh=false){this.directory=directory;this.refresh=refresh;}
 async get(url:string):Promise<any> {
  await mkdir(this.directory,{recursive:true});const file=`${this.directory}/${createHash('sha256').update(url).digest('hex')}.json`;
  if(!this.refresh){try{return JSON.parse(await readFile(file,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}}
  await new Promise(r=>setTimeout(r,Math.max(0,650-(Date.now()-this.lastRequest))));this.lastRequest=Date.now();
  const response=await fetch(url,{headers:{'User-Agent':'LocalProvisionFinderHackathon/1.0 (internal service directory research)','Accept':'application/json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`HTTP ${response.status} fetching ${url}`);
  if(!response.headers.get('content-type')?.includes('json'))throw new Error(`Expected JSON at ${url}`);
  const envelope={fetchedAt:new Date().toISOString(),data:sanitise(await response.json())};
  await writeFile(file,JSON.stringify(envelope));return envelope;
 }
}
export class SourceAdapter {
 sourceId:string; source:any; client:any; fetchedCount=0; expectedCount=0;
 constructor(source:any,client:any){this.source=source;this.sourceId=source.sourceId;this.client=client;}
 normalise(raw:any,fetchedAt:string){return normalise(raw,this.source,fetchedAt);}
 async fetchRelated(endpoint:string,extra=''):Promise<Map<string,any>> {
  const records=new Map<string,any>();let expected:number|undefined;let pages:number|undefined;
  for(let page=1;;page++){
   const envelope=await this.client.get(`${this.source.baseUrl}/${endpoint}?page=${page}&per_page=100${extra}`);const data=envelope.data;
   if(!Array.isArray(data.data)||!Number.isInteger(data.meta?.total)||!Number.isInteger(data.meta?.last_page)||data.meta.current_page!==page)throw new Error(`Invalid ${endpoint} pagination`);
   if(expected!==undefined&&(expected!==data.meta.total||pages!==data.meta.last_page))throw new Error(`${endpoint} totals changed during fetch`);
   expected=data.meta.total;pages=data.meta.last_page;
   for(const record of data.data){if(!record.id||records.has(record.id))throw new Error(`Missing/duplicate ${endpoint} identity`);records.set(record.id,{record,sourceUrl:`${this.source.baseUrl}/${endpoint}/${encodeURIComponent(record.id)}`,fetchedAt:envelope.fetchedAt});}
   if(page===pages)break;if(!data.data.length)throw new Error(`Empty intermediate ${endpoint} page`);
  }
  if(records.size!==expected)throw new Error(`Incomplete ${endpoint}: ${records.size}/${expected}`);
  return records;
 }
 async *fetchBuckinghamshire():AsyncGenerator<any> {
  const seen=new Set<string>();let expected:number|undefined;let pages:number|undefined;
  // This source supplies its complete detail schema, including contacts, sites,
  // SEND survey answers and schedules, directly in each paginated list record.
  for(let page=1;;page++){
   const url=`${this.source.baseUrl}/services?page=${page}&per_page=50`;
   const envelope=await this.client.get(url);const data=envelope.data;
   if(!Array.isArray(data.content)||!Number.isInteger(data.totalElements)||!Number.isInteger(data.totalPages)||data.number!==page)throw new Error('Invalid Buckinghamshire pagination');
   if(expected!==undefined&&(expected!==data.totalElements||pages!==data.totalPages))throw new Error('Buckinghamshire totals changed during fetch');
   expected=data.totalElements;pages=data.totalPages;this.expectedCount=expected!;
   if(page===1)console.log(`${this.sourceId}: source reports ${expected} records across ${pages} pages`);
   for(const row of data.content){const id=String(row.id);if(!row.id||seen.has(id))throw new Error('Missing/duplicate Buckinghamshire identity');seen.add(id);this.fetchedCount++;yield {raw:{...row,_sourceListUrl:url,_sourceListFetchedAt:envelope.fetchedAt},fetchedAt:envelope.fetchedAt};}
   if(page===pages)break;if(!data.content.length)throw new Error('Empty intermediate Buckinghamshire page');
  }
  if(seen.size!==expected)throw new Error(`Incomplete Buckinghamshire source: ${seen.size}/${expected}`);
 }
 async *fetchAll():AsyncGenerator<any> {
  if(!this.source.licensed)throw new Error(`${this.sourceId}: ${this.source.licence}`);
  if(this.source.kind==='bucks'){yield* this.fetchBuckinghamshire();return;}
  const ckSource=this.source.kind==='kingston';
  const organisations=ckSource?await this.fetchRelated('organisations'):new Map<string,any>();
  const seen=new Set<string>();let total:number|undefined;let pages:number|undefined;
  for(let page=1;;page++){
   const envelope=await this.client.get(`${this.source.baseUrl}/services?page=${page}&per_page=50`);const data=envelope.data;
   const ck=this.source.kind==='kingston';const rows=ck?data.data:data.contents;
   const count=ck?data.meta?.total:data.total_items;const pageCount=ck?data.meta?.last_page:data.total_pages;const pageNumber=ck?data.meta?.current_page:data.page_number;
   if(!Array.isArray(rows)||!Number.isInteger(count)||!Number.isInteger(pageCount)||pageNumber!==page||count<0||pageCount<1)throw new Error('Invalid pagination envelope');
   if(total!==undefined&&(total!==count||pages!==pageCount))throw new Error('Pagination totals changed during fetch');
   total=count;pages=pageCount;this.expectedCount=count;
   if(page===1)console.log(`${this.sourceId}: source reports ${count} records across ${pages} pages`);
   for(const row of rows){if(!row.id||seen.has(row.id))throw new Error('Missing/duplicate source ID');seen.add(row.id);
    const detail=await this.client.get(`${this.source.baseUrl}/services/${encodeURIComponent(row.id)}`);const raw=ck?(detail.data.data??detail.data):detail.data;
    if(raw.id!==row.id)throw new Error('Detail identity mismatch');
    // Kingston's unfiltered location pagination sorts nullable names and can
    // duplicate/omit rows. Fetch each service's complete filtered relationship set.
    const relatedLocations=ck?Array.from((await this.fetchRelated('service-locations',`&filter%5Bservice_id%5D=${encodeURIComponent(row.id)}&include=location`)).values()):[];
    const organisation=ck?organisations.get(raw.organisation_id):null;
    if(ck&&raw.organisation_id&&!organisation)throw new Error(`Missing organisation for service ${row.id}`);
    const linked=relatedLocations.map((entry:any)=>{if(entry.record.service_id!==row.id||!entry.record.location)throw new Error(`Missing/mismatched location for service ${row.id}`);return {...entry.record,_sourceRelation:entry,_sourceLocation:{record:entry.record.location,sourceUrl:`${this.source.baseUrl}/locations/${encodeURIComponent(entry.record.location_id)}`,fetchedAt:entry.fetchedAt}};});
    const enrichment=ck?{organisation:organisation?.record??null,service_at_locations:linked,_relatedProvenance:{organisation,serviceLocations:relatedLocations,locations:linked.map((entry:any)=>entry._sourceLocation)}}:{};
    this.fetchedCount++;yield {raw:{...row,...raw,...enrichment,_sourceList:row,_sourceDetail:raw,_sourceListFetchedAt:envelope.fetchedAt,_sourceDetailFetchedAt:detail.fetchedAt},fetchedAt:detail.fetchedAt};
   }
   if(page===pages)break;if(rows.length===0)throw new Error('Empty intermediate page');
  }
  if(seen.size!==total)throw new Error(`Incomplete source: received ${seen.size}, expected ${total}`);
 }
}
