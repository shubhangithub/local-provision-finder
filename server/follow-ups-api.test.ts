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
import { FollowUpStore } from './follow-ups-store';
import { GovHackClient,GovHackError } from './gov-hack';

const service={id:'bucks:1',name:'Elmhurst Family Hub',provider:'Bucks',description:'Hub',cost:'Free',searchText:'x'};
const phone='07700900123';
const staff={'x-staff-demo':'true','content-type':'application/json'};
let directory:string,server:Server,base:string,client:GovHackClient | null,gov:{submitFollowup:ReturnType<typeof vi.fn>;getFollowup:ReturnType<typeof vi.fn>},reportId:string;
const open=(fn:(store:FollowUpStore)=>void)=>{const store=new FollowUpStore(join(directory,'follow-ups.sqlite'));try {fn(store);} finally {store.close();}};
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),'followups-api-'));
  const db=new DatabaseSync(join(directory,'services.sqlite'));
  db.exec('CREATE TABLE catalogue_services(id TEXT PRIMARY KEY,source_id TEXT,postcode TEXT,lat REAL,lng REAL,vetting TEXT,availability TEXT,record_json TEXT,search_text TEXT)');
  db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(service.id,'bucks',null,null,null,'public','Available',JSON.stringify(service),'x');db.close();
  const feedback=new FeedbackStore(join(directory,'feedback.sqlite'));reportId=feedback.submit(service,{answers:{upToDate:'yes',issues:[]}}).id;feedback.close();
  open(store=>store.record(reportId,service,phone));
  gov={submitFollowup:vi.fn(async()=>({id:'fu-1',status:'awaiting'})),getFollowup:vi.fn(async()=>({id:'fu-1',status:'awaiting'}))};
  client={...gov,submitJob:vi.fn(),getJob:vi.fn()} as unknown as GovHackClient;
  const handler=followUpsHandler({directory,client:()=>client});
  server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end('{}');}));
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(()=>{server.close();rmSync(directory,{recursive:true,force:true});});
const call=(path:string,init:RequestInit={})=>fetch(base+path,init);
const start=(id=reportId)=>call('/api/follow-ups',{method:'POST',headers:staff,body:JSON.stringify({feedbackId:id})});
const poll=async()=>(await call(`/api/follow-ups?feedbackId=${reportId}`,{headers:staff})).json();
const reports=()=>{const store=new FeedbackStore(join(directory,'feedback.sqlite'));try {return store.list('pending').filter(entry=>entry.id!==reportId);} finally {store.close();}};
describe('follow-ups API',()=>{
  it('is staff only, and never returns the number',async()=>{
    expect((await call('/api/follow-ups')).status).toBe(403);expect((await call('/api/follow-ups',{method:'POST',body:'{}'})).status).toBe(403);
    const list=await (await call('/api/follow-ups',{headers:staff})).text();expect(list).toContain(reportId);expect(list).not.toContain(phone);expect(JSON.parse(list)).toMatchObject({sandbox:true,configured:true});
  });
  it('asks gov-hack to call, attesting consent and passing the enrichment job',async()=>{
    const enrichment=new EnrichmentStore(join(directory,'enrichment.sqlite'));const run=enrichment.startRun(service,'11111111-1111-4111-8111-111111111111',{});
    enrichment.complete(run.id,{id:'x',status:'completed',result:{outcome:'found',facts:[]}},service);enrichment.close();
    const response=await start();const text=await response.text();
    expect(response.status).toBe(202);expect(text).not.toContain(phone);expect(JSON.parse(text).followUp.status).toBe('requested');
    expect(gov.submitFollowup).toHaveBeenCalledWith({person:{phone},consent:{attested:true},services:[{name:service.name,job_id:'11111111-1111-4111-8111-111111111111'}],reference:reportId});
  });
  it('does not place a second call for the same report',async()=>{
    expect((await start()).status).toBe(202);expect((await start()).status).toBe(409);expect(gov.submitFollowup).toHaveBeenCalledTimes(1);
  });
  it('has no follow-up for a report without consent, and a missing one is not found',async()=>{
    const feedback=new FeedbackStore(join(directory,'feedback.sqlite'));const other=feedback.submit(service,{answers:{upToDate:'yes',issues:[]}}).id;feedback.close();
    expect((await start(other)).status).toBe(404);expect((await start('nope')).status).toBe(404);expect(gov.submitFollowup).not.toHaveBeenCalled();
  });
  it('is disabled with a message when the service is not configured',async()=>{
    client=null;const response=await start();expect(response.status).toBe(503);expect((await response.json()).error).toMatch(/Follow-up calls is not configured|GOV_HACK_URL/);
    expect((await (await call('/api/follow-ups',{headers:staff})).json()).configured).toBe(false);
  });
  it('lets staff retry after the service could not be reached',async()=>{
    gov.submitFollowup.mockRejectedValueOnce(new GovHackError('The enrichment service could not be reached.',502,'unreachable'));
    expect((await start()).status).toBe(502);expect((await poll()).followUp).toMatchObject({status:'failed'});expect((await start()).status).toBe(202);
  });
  it('lets staff try again when the service has forgotten the request',async()=>{
    await start();gov.getFollowup.mockRejectedValue(new GovHackError('not found',502,'followup_not_found'));
    expect((await poll()).followUp).toMatchObject({status:'failed',reason:'The follow-up service no longer has this request. Try again.'});
    gov.getFollowup.mockReset();expect((await start()).status).toBe(202);
  });
  it('shows the reason when the service refuses, and keeps the report unchanged',async()=>{
    await start();gov.getFollowup.mockResolvedValue({id:'fu-1',status:'denied',decisions:[{check:'do_not_contact',result:'allow',reason:'not on the list'},{check:'calling_hours',result:'deny',reason:'Outside calling hours (09:00 to 17:00 UK time).'}]});
    expect((await poll()).followUp).toMatchObject({status:'denied',reason:'Outside calling hours (09:00 to 17:00 UK time).'});expect(reports()).toHaveLength(0);
    open(store=>expect(store.begin(reportId).phone).toBe(phone));
  });
  it('turns what the person said into pending reports once, and deletes the number',async()=>{
    await start();gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome:'answered',result:{outcome:'answered',services:[{name:service.name,status:'contacted',confidence:'confirmed',quote:'I went along.',operating:{state:'closed_permanently',confidence:'confirmed',quote:"It's shut down for good."}}]}});
    const first=await poll();const second=await poll();
    expect(first.followUp).toMatchObject({status:'completed',outcome:'answered'});expect(second.followUp.reportIds).toEqual(first.followUp.reportIds);
    const made=reports();expect(made).toHaveLength(1);expect(made[0]).toMatchObject({serviceId:service.id,status:'pending',answers:{availability:'closed',issues:['availability']}});
    expect(made[0].note).toContain("It's shut down for good.");
    expect(made[0].proposed).toEqual({field:'availability',value:'Closed',previous:'',quote:"It's shut down for good.",source:'follow-up'});
    expect(first.followUp.reportIds).toEqual([made[0].id]);
    const record=JSON.parse(String(new DatabaseSync(join(directory,'services.sqlite')).prepare('SELECT record_json FROM catalogue_services').get()!.record_json));expect(record.cost).toBe('Free');
    expect((await start()).status).toBe(409);
    const db=new DatabaseSync(join(directory,'follow-ups.sqlite'));expect(db.prepare('SELECT phone FROM follow_ups').get()!.phone).toBeNull();db.close();
  });
  it.each(['wrong_person','declined'])('records no findings for %s',async outcome=>{
    await start();gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome,result:{outcome,services:[{name:service.name,status:'contacted',operating:{state:'closed_permanently',quote:'closed'}}]}});
    expect((await poll()).followUp).toMatchObject({status:'completed',outcome,reportIds:[]});expect(reports()).toHaveLength(0);
  });
  it('makes no report when the call had nothing to report',async()=>{
    await start();gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome:'answered',result:{outcome:'answered',services:[{name:service.name,status:'contacted',quote:'Fine.',feedback:'it was fine'}]}});
    expect((await poll()).followUp).toMatchObject({status:'completed',reportIds:[]});expect(reports()).toHaveLength(0);
  });
  it('keeps the number and allows a retry when nobody answered',async()=>{
    await start();gov.getFollowup.mockResolvedValue({id:'fu-1',status:'resolved',outcome:'no_answer',result:{outcome:'no_answer',services:[]}});
    expect((await poll()).followUp).toMatchObject({status:'failed',reason:'Nobody answered the call.'});expect((await start()).status).toBe(202);
  });
});
