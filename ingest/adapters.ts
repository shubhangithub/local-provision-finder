import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sanitise, normalise } from './normalise.ts';
export const sources = [
 {sourceId:'bristol-oruk',name:'Bristol City Council / Well Aware',baseUrl:'https://bristol.openplace.directory/o/OpenReferralService/v3',kind:'oruk',licensed:true,licence:'Open Government Licence (OGL), version not stated',terms:'https://www.wellaware.org.uk/terms-and-conditions-open-place-directory-account/'},
 {sourceId:'kingston-ck',name:'Connected Kingston',baseUrl:'https://api.connectedkingston.uk/core/v1',kind:'kingston',licensed:false,licence:'No explicit data reuse licence found; blocked pending permission',terms:'https://connectedkingston.uk/terms-and-conditions'},
];
export class CachedClient {
 lastRequest=0; refresh:boolean; directory:string;
 constructor(directory:string,refresh=false){this.directory=directory;this.refresh=refresh;}
 async get(url:string):Promise<any> {
  await mkdir(this.directory,{recursive:true});const file=`${this.directory}/${createHash('sha256').update(url).digest('hex')}.json`;
  if(!this.refresh){try{return JSON.parse(await readFile(file,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}}
  await new Promise(r=>setTimeout(r,Math.max(0,510-(Date.now()-this.lastRequest))));this.lastRequest=Date.now();
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
 async *fetchAll():AsyncGenerator<any> {
  if(!this.source.licensed)throw new Error(`${this.sourceId}: ${this.source.licence}`);
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
    if(raw.id!==row.id)throw new Error('Detail identity mismatch');this.fetchedCount++;yield {raw:{...row,...raw,_sourceList:row,_sourceDetail:raw,_sourceListFetchedAt:envelope.fetchedAt,_sourceDetailFetchedAt:detail.fetchedAt},fetchedAt:detail.fetchedAt};
   }
   if(page===pages)break;if(rows.length===0)throw new Error('Empty intermediate page');
  }
  if(seen.size!==total)throw new Error(`Incomplete source: received ${seen.size}, expected ${total}`);
 }
}
