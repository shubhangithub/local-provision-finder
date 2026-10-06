import { createServer,type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { FeedbackStore } from './feedback-store';
import { EnrichmentStore } from './enrichment-store';
import { followUpsHandler } from './follow-ups-api';
import { GovHackClient,GovHackError } from './gov-hack';

const hub={id:'bucks:1',name:'Elmhurst Family Hub',provider:'Bucks',description:'Hub',cost:'Free',searchText:'x'};
const club={id:'bris:2',name:'Kettlebell Club',provider:'Club',description:'Club',cost:'£10',searchText:'y'};
const gym={id:'bris:3',name:'Walking Group',provider:'Group',description:'Walk',cost:'Free',searchText:'z'};
const phone='07700900123';
const staff={'x-staff-demo':'true','content-type':'application/json'};
let summary:(input:{said:string;service:string;field:string;label:string})=>Promise<string|null>;
let directory:string,server:Server,base:string,client:GovHackClient | null,gov:{submitFollowup:ReturnType<typeof vi.fn>;getFollowup:ReturnType<typeof vi.fn>};
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),'followups-api-'));
  const db=new DatabaseSync(join(directory,'services.sqlite'));
  db.exec('CREATE TABLE catalogue_services(id TEXT PRIMARY KEY,source_id TEXT,postcode TEXT,lat REAL,lng REAL,vetting TEXT,availability TEXT,record_json TEXT,search_text TEXT)');
  for (const record of [hub,club,gym]) db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(record.id,'x',null,null,null,'public','Available',JSON.stringify(record),'x');
  db.close();
  summary=async({said})=>said.includes('twelve') ? 'Costs 12 pounds' : null;
  gov={submitFollowup:vi.fn(async()=>({id:'fu-1',status:'awaiting'})),getFollowup:vi.fn(async()=>({id:'fu-1',status:'awaiting'}))};
  client={...gov,submitJob:vi.fn(),getJob:vi.fn()} as unknown as GovHackClient;
  const handler=followUpsHandler({directory,client:()=>client,summarise:input=>summary(input)});
  server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end('{}');}));
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(()=>{server.close();rmSync(directory,{recursive:true,force:true});});
const call=(path:string,init:RequestInit={})=>fetch(base+path,init);
const post=(path:string,body:unknown)=>call(path,{method:'POST',headers:staff,body:JSON.stringify(body)});
const create=(over:Record<string,unknown>={})=>post('/api/follow-ups',{firstName:'Sam',phone,agreed:true,services:[{id:hub.id},{id:club.id},{id:gym.id}],...over});
const made=async()=>(await (await create()).json()).followUp as {id:string};
const poll=async(id:string)=>(await call(`/api/follow-ups?id=${id}`,{headers:staff})).json();
const pending=()=>{const store=new FeedbackStore(join(directory,'feedback.sqlite'));try {return store.list('pending');} finally {store.close();}};
const answered={id:'fu-1',status:'resolved',outcome:'answered',result:{outcome:'answered',services:[
  {name:hub.name,status:'contacted',quote:'Went.',operating:{state:'closed_permanently',confidence:'confirmed',quote:"It's shut down for good."}},
  {name:club.name,status:'contacted',details:[{category:'price',said:'twelve pounds now',confidence:'confirmed',quote:'It is twelve pounds now.'}]},
  {name:gym.name,status:'contacted',quote:'It was fine.',feedback:'it was fine'}]}};
describe('creating a follow-up',()=>{
  it('is staff only and never returns the number',async()=>{
    expect((await call('/api/follow-ups')).status).toBe(403);expect((await call('/api/follow-ups',{method:'POST',body:'{}'})).status).toBe(403);
    const response=await create();const text=await response.text();expect(response.status).toBe(201);expect(text).not.toContain('07700');
    expect(JSON.parse(text).followUp).toMatchObject({personName:'Sam',status:'scheduled',services:[{id:hub.id,name:hub.name},{id:club.id,name:club.name},{id:gym.id,name:gym.name}]});
    expect(await (await call('/api/follow-ups',{headers:staff})).text()).not.toContain('07700');
  });
  it('rejects a missing agreement, a bad number, no services, too many, and an unknown service',async()=>{
    expect((await (await create({agreed:false})).json()).error).toMatch(/customer agreed/);expect((await create({agreed:undefined})).status).toBe(400);
    expect((await create({phone:'12345'})).status).toBe(400);expect((await create({phone:''})).status).toBe(400);
    expect((await create({services:[]})).status).toBe(400);
    expect((await create({services:Array.from({length:6},(_,i)=>({id:`s${i}`}))})).status).toBe(400);
    expect((await create({services:[{id:'nope'}]})).status).toBe(404);
    expect((await (await call('/api/follow-ups',{headers:staff})).json()).followUps).toEqual([]);
  });
  it('treats the first name as optional and counts a repeated service once',async()=>{
    const response=await create({firstName:undefined,services:[{id:hub.id},{id:hub.id}]});expect(response.status).toBe(201);
    expect((await response.json()).followUp).toMatchObject({personName:null,services:[{id:hub.id,name:hub.name}]});
  });
});
describe('placing the call',()=>{
  it('asks the call service about every service, with enrichment job ids, attesting consent',async()=>{
    const enrichment=new EnrichmentStore(join(directory,'enrichment.sqlite'));const run=enrichment.startRun(hub,'11111111-1111-4111-8111-111111111111',{});
    enrichment.complete(run.id,{id:'x',status:'completed',result:{outcome:'found',facts:[]}},hub);enrichment.close();
    const {id}=await made();const response=await post('/api/follow-ups/call',{id});const text=await response.text();
    expect(response.status).toBe(202);expect(text).not.toContain('07700');expect(JSON.parse(text).followUp.status).toBe('requested');
    expect(gov.submitFollowup).toHaveBeenCalledWith({person:{phone,first_name:'Sam'},consent:{attested:true},services:[{name:hub.name,job_id:'11111111-1111-4111-8111-111111111111'},{name:club.name},{name:gym.name}],reference:id});
  });
  it('does not place a second call',async()=>{const {id}=await made();expect((await post('/api/follow-ups/call',{id})).status).toBe(202);expect((await post('/api/follow-ups/call',{id})).status).toBe(409);expect(gov.submitFollowup).toHaveBeenCalledTimes(1);});
  it('finds nothing for an unknown id, and is disabled with a message when not configured',async()=>{
    expect((await post('/api/follow-ups/call',{id:'nope'})).status).toBe(404);
    const {id}=await made();client=null;const response=await post('/api/follow-ups/call',{id});expect(response.status).toBe(503);expect((await response.json()).error).toMatch(/Follow-up calls/);
    expect((await (await call('/api/follow-ups',{headers:staff})).json()).configured).toBe(false);
  });
  it('lets staff retry after the call service could not be reached',async()=>{
    const {id}=await made();gov.submitFollowup.mockRejectedValueOnce(new GovHackError('The enrichment service could not be reached.',502,'unreachable'));
    expect((await post('/api/follow-ups/call',{id})).status).toBe(502);expect((await poll(id)).followUp).toMatchObject({status:'failed'});expect((await post('/api/follow-ups/call',{id})).status).toBe(202);
  });
  it('shows the reason when the service refuses, and keeps the number to try again',async()=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});
    gov.getFollowup.mockResolvedValue({id:'fu-1',status:'denied',decisions:[{check:'dnc',result:'allow',reason:'ok'},{check:'calling_hours',result:'deny',reason:'Outside calling hours (09:00 to 17:00 UK time).'}]});
    expect((await poll(id)).followUp).toMatchObject({status:'denied',reason:'Outside calling hours (09:00 to 17:00 UK time).'});expect(pending()).toHaveLength(0);expect((await post('/api/follow-ups/call',{id})).status).toBe(202);
  });
  it('lets staff try again when the service has forgotten the request',async()=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});gov.getFollowup.mockRejectedValue(new GovHackError('not found',502,'followup_not_found'));
    expect((await poll(id)).followUp).toMatchObject({status:'failed',reason:'The follow-up service no longer has this request. Try again.'});gov.getFollowup.mockReset();expect((await post('/api/follow-ups/call',{id})).status).toBe(202);
  });
  it('keeps the number and allows a retry when nobody answered',async()=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome:'no_answer',result:{outcome:'no_answer',services:[]}});
    expect((await poll(id)).followUp).toMatchObject({status:'failed',reason:'Nobody answered the call.'});expect((await post('/api/follow-ups/call',{id})).status).toBe(202);
  });
});
describe('what the customer said',()=>{
  it('makes one pending report per finding, once, deletes the number, and changes no service',async()=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});gov.getFollowup.mockResolvedValue(answered);
    const first=await poll(id);const second=await poll(id);
    expect(first.followUp).toMatchObject({status:'completed',outcome:'answered'});expect(second.followUp.reportIds).toEqual(first.followUp.reportIds);
    const reports=pending();expect(reports).toHaveLength(2);
    const closed=reports.find(entry=>entry.serviceId===hub.id)!;expect(closed.proposed).toEqual({field:'availability',value:'Closed',previous:'',quote:"It's shut down for good.",source:'follow-up'});
    const price=reports.find(entry=>entry.serviceId===club.id)!;expect(price.proposed).toMatchObject({field:'cost',value:'Costs 12 pounds',previous:'£10'});
    expect(reports.some(entry=>entry.serviceId===gym.id)).toBe(false);expect(first.followUp.reportIds.sort()).toEqual(reports.map(entry=>entry.id).sort());
    const db=new DatabaseSync(join(directory,'follow-ups.sqlite'));expect((db.prepare('SELECT phone FROM meeting_follow_ups').get() as {phone:string|null}).phone).toBeNull();db.close();
    const cat=new DatabaseSync(join(directory,'services.sqlite'));expect(JSON.parse(String((cat.prepare('SELECT record_json FROM catalogue_services WHERE id=?').get(hub.id) as {record_json:string}).record_json)).cost).toBe('Free');cat.close();
    expect((await post('/api/follow-ups/call',{id})).status).toBe(409);
  });
  it.each(['wrong_person','declined'])('records no findings for %s',async outcome=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome,result:{outcome,services:answered.result.services}});
    expect((await poll(id)).followUp).toMatchObject({status:'completed',outcome,reportIds:[]});expect(pending()).toHaveLength(0);
  });
  it('ignores a finding about a service that was not in the call',async()=>{
    const {id}=await made();await post('/api/follow-ups/call',{id});
    gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome:'answered',result:{outcome:'answered',services:[{name:'Unrelated Place',operating:{state:'closed_permanently',confidence:'confirmed',quote:'Closed.'}}]}});
    expect((await poll(id)).followUp).toMatchObject({status:'completed',reportIds:[]});expect(pending()).toHaveLength(0);
  });
});
describe('rewriting what was said',()=>{
  const settle=async()=>{const {id}=await made();await post('/api/follow-ups/call',{id});gov.getFollowup.mockResolvedValue(answered);await poll(id);await poll(id);return id;};
  it('offers the rewritten value, never the spoken words, and keeps the quote',async()=>{
    await settle();const price=pending().find(entry=>entry.serviceName===club.name)!;
    expect(price.proposed).toMatchObject({field:'cost',value:'Costs 12 pounds',quote:'It is twelve pounds now.'});
    expect(price.note).toContain('twelve pounds now');
  });
  it('still creates the report, without a one-click change, when there is no rewrite',async()=>{
    summary=async()=>null;await settle();const price=pending().find(entry=>entry.serviceName===club.name)!;
    expect(price.proposed).toBeUndefined();expect(price.note).toContain('twelve pounds now');
    expect(pending().find(entry=>entry.serviceName===hub.name)!.proposed).toMatchObject({field:'availability',value:'Closed'});
  });
  it('makes one set of reports when the same call is settled twice',async()=>{
    const id=await settle();await poll(id);expect(pending()).toHaveLength(2);
  });
  it('sends the model the service name and the words, not the number or first name',async()=>{
    const seen:string[]=[];summary=async input=>{seen.push(JSON.stringify(input));return 'Costs 12 pounds';};await settle();
    expect(seen.length).toBeGreaterThan(0);for (const text of seen) {expect(text).not.toContain(phone);expect(text).not.toContain('Sam');}
  });
});
