import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sources,CachedClient,SourceAdapter } from './adapters.ts';
import { Store } from './store.ts';
import { isJobListing } from './normalise.ts';
export async function run(args=process.argv.slice(2)){
 const refresh=args.includes('--refresh');const sourceArg=args.find(a=>a.startsWith('--source='))?.split('=')[1];
 if(args.some(a=>a!=='--refresh'&&!a.startsWith('--source=')))throw new Error('Usage: npm run ingest -- [--refresh] [--source=bristol-oruk|kingston-ck]');
 if(sourceArg&&!sources.some(s=>s.sourceId===sourceArg))throw new Error('Unknown source');
 await mkdir('data',{recursive:true});const store=new Store('data/services.sqlite');const reports:any[]=[];let failed=false;
 try {
  for(const source of sources.filter(s=>!sourceArg||s.sourceId===sourceArg)){
   const id=store.start(source.sourceId);const adapter=new SourceAdapter(source,new CachedClient(`data/ingest-cache/${source.sourceId}`,refresh));const records=[];let skipped=0;
   try {
    if(!source.licensed){const report={source:source.sourceId,status:'licence-blocked',error:source.licence,sourceReportedCountAtProbe:354,probeDate:'2026-10-05',expected:0,fetched:0,written:0,skipped:0,removed:0};store.finish(id,report);reports.push(report);console.warn(report.error);if(sourceArg)failed=true;continue;}
    for await(const item of adapter.fetchAll()){if(isJobListing(item.raw)){skipped++;continue;}records.push(adapter.normalise(item.raw,item.fetchedAt));if(adapter.fetchedCount%100===0)console.log(`${source.sourceId}: fetched ${adapter.fetchedCount}/${adapter.expectedCount}`);}
    const removed=store.upsertComplete(source.sourceId,records,refresh);const report={source:source.sourceId,status:'complete',expected:adapter.expectedCount,fetched:adapter.fetchedCount,written:records.length,skipped,removed};store.finish(id,report);reports.push(report);
   }catch(e:any){failed=true;const report={source:source.sourceId,status:'failed',expected:adapter.expectedCount,fetched:adapter.fetchedCount,error:e.message};store.finish(id,report);reports.push(report);console.error(e.message);}
  }
  const records=store.records();const count=(key:string)=>records.filter(r=>r[key]!==null).length;
  const report={generatedAt:new Date().toISOString(),sources:reports,total:records.length,postcodes:{count:count('postcode'),share:records.length?count('postcode')/records.length:0},assuredDates:{count:count('lastVerified'),share:records.length?count('lastVerified')/records.length:0},updatedDates:{count:count('sourceUpdatedAt')},needs:Object.fromEntries([...new Set<string>(records.flatMap(r=>r.needs))].sort().map(need=>[need,records.filter(r=>r.needs.includes(need)).length]))};
  await writeFile('data/services.internal.json',JSON.stringify(records,null,2)+'\n');await writeFile('data/ingest-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{store.close();}
 if(failed)process.exitCode=1;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)await run();
