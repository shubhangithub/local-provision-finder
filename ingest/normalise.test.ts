import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalise,sanitise,trust,isJobListing } from './normalise.ts';
import { sources,SourceAdapter,CachedClient } from './adapters.ts';
import { Store } from './store.ts';
const at='2026-10-05T12:00:00.000Z';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/contracts.json',import.meta.url),'utf8'));
for(const kind of ['bristol','kingston'])for(const [i,raw] of fixtures[kind].entries())test(`${kind} normaliser contract ${i+1}`,()=>{
 const source=sources[kind==='bristol'?0:1];const r=normalise(raw,source,at);
 assert.equal(r.id,`${source.sourceId}:${raw.id}`);assert.equal(r.vetting,'internal');assert.equal((r.raw as {id: unknown}).id,raw.id);
 assert.equal(r.name,raw.name);assert.ok(r.searchText.includes('Access instruction outside structured columns'));
 assert.ok(r.textProvenance.fields.includes('custom_access_detail'));assert.equal(r.textProvenance.fetchedAt,at);
 if(raw.assured_date)assert.ok(r.lastVerified);else assert.equal(r.lastVerified,null);
 if(raw.contact_phone)assert.equal(r.publicPhone,raw.contact_phone);
});
test('published named professional, mobile and personal-form email retained; private metadata excluded',()=>{
 const input={name:'Charity',contact_name:'Jane Example',contact_phone:'07749 633973',contact_email:'jane@charity.org',contacts:[{name:'John Example',title:'Service coordinator',phones:[{number:'07749 633973'}],email:'john@charity.org'}],description:'Call Jane on 07749 633973 or jane@charity.org',assurer_email:'private@example.org',pc_metadata:{assured_by:'private@example.org',date_assured:'2026-01-01'},password:'secret'};
 const safe=sanitise(input);assert.equal(safe.contact_phone,input.contact_phone);assert.equal(safe.contacts[0].name,'John Example');assert.equal(safe.description,input.description);assert.equal(safe.assurer_email,undefined);assert.equal(safe.password,undefined);assert.equal(safe.pc_metadata.assured_by,undefined);
});
test('updated date is not assurance and online is not nationwide',()=>{
 const r=normalise({id:'date',name:'Online local support',description:'training',updated_at:'2026-10-01',attending_type:['online']},sources[1],at);
 assert.equal(r.lastVerified,null);assert.equal(r.verificationStatus,'Potentially outdated');assert.equal(r.confidence,40);assert.ok(r.sourceUpdatedAt);assert.equal(r.scope,'local');assert.equal(r.delivery,'Online');
});
test('trust boundaries calendar months, invalid and future dates',()=>{
 const now=new Date(at);assert.equal(trust('2026-04-05T12:00:00.000Z',now).verificationStatus,'Verified');assert.equal(trust('2026-04-05T11:59:59.000Z',now).verificationStatus,'Review due');assert.equal(trust('2025-10-05T12:00:00.000Z',now).verificationStatus,'Review due');assert.equal(trust('2025-10-05T11:59:59.000Z',now).verificationStatus,'Potentially outdated');assert.equal(trust('2027-01-01T00:00:00Z',now).verificationStatus,'Potentially outdated');assert.equal(trust('2020-01-01T00:00:00Z',now).confidence,30);
});
test('do not discard employability support as a job listing',()=>{assert.equal(isJobListing({name:'Employment skills and training'}),false);assert.equal(isJobListing({name:'Job vacancy: accountant'}),true);assert.equal(isJobListing({type:'vacancy',name:'Accountant'}),true);});
const clientFor=(pages:any[])=>({async get(url:string){if(/\/services\//.test(url)){const id=url.split('/').at(-1);return {data:{id,name:`Service ${id}`,description:'Support'},fetchedAt:at};}const p=Number(new URL(url).searchParams.get('page'));return {data:pages[p-1],fetchedAt:at};}});
const page=(n:number,total:number,pages:number,ids:string[])=>({page_number:n,total_items:total,total_pages:pages,contents:ids.map(id=>({id,name:`Service ${id}`,list_only_detail:'Preserve me'}))});
async function consume(adapter:SourceAdapter){const rows=[];for await(const row of adapter.fetchAll())rows.push(row);return rows;}
test('ORUK pagination keeps exact counts and list/detail provenance',async()=>{const a=new SourceAdapter(sources[0],clientFor([page(1,3,2,['a','b']),page(2,3,2,['c'])]));const rows=await consume(a);assert.equal(rows.length,3);assert.equal(rows[0].raw._sourceList.list_only_detail,'Preserve me');assert.equal(rows[0].raw._sourceDetail.id,'a');});
for(const [label,pages] of [
 ['missing count',[page(1,3,2,['a']),page(2,3,2,['b'])]],
 ['duplicate',[page(1,2,2,['a']),page(2,2,2,['a'])]],
 ['changed totals',[page(1,2,2,['a']),page(2,3,2,['b'])]],
 ['wrong page',[page(2,1,1,['a'])]],
 ['empty intermediate',[page(1,2,2,[]),page(2,2,2,['b'])]],
] as any[])test(`reject ${label}`,async()=>{await assert.rejects(consume(new SourceAdapter(sources[0],clientFor(pages))));});
test('Kingston licence gate prevents all HTTP access',async()=>{const adapter=new SourceAdapter(sources[1],{get(){throw new Error('must not fetch');}});await assert.rejects(consume(adapter),/reuse licence/);});
test('transactional upsert, source isolation, removal only on explicit refresh, search text storage, approval preservation',()=>{
 const db=new Store(':memory:');const make=(id:string)=>normalise({id,name:`Housing ${id}`,description:'Housing assistance',custom_access_detail:'Bring the blue form'},sources[0],at);
 try{
  const a=make('a'),b=make('b');db.upsertComplete('bristol-oruk',[a,b],true);db.upsertComplete('bristol-oruk',[a,b],true);assert.equal(db.records().length,2);
  db.db.prepare("UPDATE services SET vetting='public' WHERE id=?").run(a.id);
  db.upsertComplete('bristol-oruk',[make('a')],false);assert.equal(db.records().find(r=>r.id===b.id).availability,'Available');assert.equal(db.records().find(r=>r.id===a.id).vetting,'public');
  db.upsertComplete('kingston-ck',[],true);assert.equal(db.records().find(r=>r.id===b.id).availability,'Available');
  assert.equal(db.upsertComplete('bristol-oruk',[make('a')],true),1);assert.equal(db.records().find(r=>r.id===b.id).availability,'Removed at source');
  assert.ok((db.db.prepare('SELECT search_text FROM services WHERE id=?').get(a.id)?.search_text as string).includes('Bring the blue form'));
  const before=JSON.stringify(db.records());const broken={...make('c'),name:BigInt(1)};assert.throws(()=>db.upsertComplete('bristol-oruk',[make('d'),broken as any],true));assert.equal(JSON.stringify(db.records()),before);
 }finally{db.close();}
});
test('disk cache preserves full licensed public contacts and fetch date and never retries by default',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dwp-ingest-'));const url='https://test.invalid/service';const {createHash}=await import('node:crypto');const {writeFile}=await import('node:fs/promises');
 try {await writeFile(join(dir,createHash('sha256').update(url).digest('hex')+'.json'),JSON.stringify({data:{contact_name:'Jane',contact_phone:'07749633973'},fetchedAt:at}));const result=await new CachedClient(dir).get(url);assert.equal(result.data.contact_name,'Jane');assert.equal(result.data.contact_phone,'07749633973');assert.equal(result.fetchedAt,at);}finally{await rm(dir,{recursive:true});}
});
test('three licensed real Bristol detail fixtures retain nested locations, schedules and entire source detail',async()=>{
 const live=JSON.parse(await readFile(new URL('./fixtures/bristol-live.json',import.meta.url),'utf8'));assert.equal(live.length,3);
 for(const f of live){const r=normalise(f.data,sources[0],f.fetchedAt);assert.equal(r.sourceUrl,f.sourceUrl);assert.deepEqual(r.raw,f.data);assert.ok(r.searchText.includes(r.name));assert.equal(r.vetting,'internal');
  const nested=f.data.service_at_locations?.[0];if(nested){const address=nested.location.addresses?.find((a:any)=>a.address_type==='physical');if(address)assert.equal(r.postcode,address.postal_code);if(nested.regular_schedule?.[0]?.description)assert.ok(r.openingTimes?.includes(nested.regular_schedule[0].description));}
  if(f.data.cost_options?.length)assert.ok(r.cost);
 }
});
test('six-month cutoff clamps to last day of shorter calendar month',()=>{
 const now=new Date('2026-10-31T12:00:00Z');assert.equal(trust('2026-04-30T12:00:00Z',now).verificationStatus,'Verified');assert.equal(trust('2026-04-30T11:59:59Z',now).verificationStatus,'Review due');
});
test('cached source fetch timestamp never prevents trust ageing',()=>{
 const r=normalise({id:'old-cache',name:'Housing support',assured_date:'2026-01-01'},sources[0],'2026-01-02T00:00:00.000Z',new Date('2026-10-05T00:00:00Z'));
 assert.equal(r.fetchedAt,'2026-01-02T00:00:00.000Z');assert.equal(r.verificationStatus,'Review due');
});
