import { createServer,type IncomingMessage,type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { searchDirectory } from './directory-search';
import { enrichmentHandler } from './enrichment-api';
import { enrichmentOverlay,readEnrichment } from './enrichment-store';
import { FeedbackStore } from './feedback-store';
import { followUpsHandler } from './follow-ups-api';
import { FollowUpStore,validateFollowUp } from './follow-ups-store';
import { GovHackClient } from './gov-hack';
import type { DirectoryRecord } from '../src/lib/directory';
vi.mock('./semantic.ts',async importOriginal=>({...await importOriginal<typeof import('./semantic')>(),semanticMatches:vi.fn(async()=>null)}));

// The whole path with a fake gov-hack that speaks its real protocol: bearer token, jobs, follow-ups.
const token='integration-token-0123456789';
const service={id:'bucks:elmhurst',name:'Best Start Family Hub Elmhurst (Aylesbury)',provider:'Buckinghamshire Council',description:'Family hub',searchText:'name: Best Start Family Hub Elmhurst (Aylesbury)',source:'Buckinghamshire',postcode:'HP20 1AA',lat:null,lng:null,cost:null,url:'https://familyinfo.example.test'};
const jobId='6f1c0c1e-6d0e-4a52-9d3e-6a1f6b9b2f10';
let directory:string,hack:Server,app:Server,hackBase:string,appBase:string,calls:{path:string;auth?:string;body?:any}[]=[],followupBody:any;
const body=(request:IncomingMessage)=>new Promise<any>(done=>{let text='';request.on('data',chunk=>text+=chunk);request.on('end',()=>done(text ? JSON.parse(text) : undefined));});
const staff={'x-staff-demo':'true','content-type':'application/json'};
const listen=(server:Server)=>new Promise<string>(done=>server.listen(0,'127.0.0.1',()=>done(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
beforeAll(async()=>{
  directory=mkdtempSync(join(tmpdir(),'glue-'));
  const db=new DatabaseSync(join(directory,'services.sqlite'));
  db.exec('CREATE TABLE catalogue_services(id TEXT PRIMARY KEY,source_id TEXT,postcode TEXT,lat REAL,lng REAL,vetting TEXT,availability TEXT,record_json TEXT,search_text TEXT)');
  db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(service.id,'bucks',null,null,null,'public','Available',JSON.stringify(service),service.searchText);db.close();
  hack=createServer(async(request,response)=>{
    const data=await body(request);const path=new URL(request.url!,'http://x').pathname;calls.push({path,auth:request.headers.authorization,body:data});
    const send=(status:number,json:unknown)=>{response.statusCode=status;response.setHeader('content-type','application/json');response.end(JSON.stringify(json));};
    if (request.headers.authorization!==`Bearer ${token}`) return send(401,{error:'unauthorized'});
    if (request.method==='POST' && path==='/jobs') return send(202,{id:jobId,status:'queued',mode:'first'});
    if (path===`/jobs/${jobId}`) return send(200,{id:jobId,status:'completed',result:{outcome:'found',service_name:service.name,facts:[
      {key:'cost',topic:'cost',value:'Free, booking required',source_url:'https://familyinfo.example.test/elmhurst',quote:'Free, booking required'},
      {key:'session_balanceability',value:'Wednesday 11:00-12:00',source_url:'https://familyinfo.example.test/timetable.pdf',quote:'Balanceability 11am to 12pm',valid_to:'2099-12-31'}],
      chunks:[{text:'Balanceability is a balance bike class for toddlers.',source_url:'https://familyinfo.example.test/timetable.pdf'}],gaps:[{topic:'eligibility',reason:'missing',detail:'No age limit stated.',status:'needs_human',flag_reason:'A person needs to check.'}],sources:[]}});
    if (request.method==='POST' && path==='/followups') {followupBody=data;return send(202,{id:'fu-1',status:'awaiting'});}
    if (path==='/followups/fu-1') return send(200,{id:'fu-1',status:'resolved',outcome:'answered',result:{outcome:'answered',services:[{name:service.name,status:'contacted',confidence:'confirmed',quote:'I went along.',operating:{state:'closed_permanently',confidence:'confirmed',quote:"I went along but it's shut down."}}]}});
    return send(404,{error:'not_found'});
  });
  hackBase=await listen(hack);
  const client=()=>new GovHackClient({url:hackBase,token});const enrich=enrichmentHandler({directory,client});const follow=followUpsHandler({directory,client});
  app=createServer((request,response)=>enrich(request,response,()=>follow(request,response,()=>{response.statusCode=404;response.end('{}');})));appBase=await listen(app);
});
afterAll(()=>{hack.close();app.close();rmSync(directory,{recursive:true,force:true});});
const call=(path:string,init:RequestInit={})=>fetch(appBase+path,init);
const read=()=>{const db=new DatabaseSync(join(directory,'services.sqlite'),{readOnly:true});try {return JSON.parse(String(db.prepare('SELECT record_json FROM catalogue_services').get()!.record_json)) as DirectoryRecord & {cost:string|null};} finally {db.close();}};
const shown=()=>enrichmentOverlay(read(),readEnrichment(directory).get(service.id)) as DirectoryRecord & {cost:string|null;enrichment?:{facts:unknown[]}};
describe('enrich, search, revert, follow up',()=>{
  it('enriches a service through the token-protected service and applies the result',async()=>{
    expect((await call('/api/enrichment',{method:'POST',headers:staff,body:JSON.stringify({serviceId:service.id})})).status).toBe(202);
    const done=await (await call(`/api/enrichment?serviceId=${service.id}`,{headers:staff})).json();
    expect(done.run).toMatchObject({status:'completed',outcome:'found'});expect(done.gaps[0].topic).toBe('eligibility');
    expect(calls.filter(item=>item.path.startsWith('/jobs')).every(item=>item.auth===`Bearer ${token}`)).toBe(true);
    expect(shown().cost).toBe('Free, booking required');expect(read().cost).toBeNull();expect(shown().enrichment?.facts).toHaveLength(2);
  });
  it('finds the service by words that exist only in the enriched text',async()=>{
    const query=(q:string,record:DirectoryRecord)=>searchDirectory([record],new URLSearchParams({q,mode:'keyword'}));
    expect((await query('balanceability',read())).records).toEqual([]);
    const result=await query('balanceability',shown());expect(result.records.map(item=>item.id)).toEqual([service.id]);
  });
  it('reverts the overwrite, restoring the original value',async()=>{
    const {overwrites}=await (await call(`/api/enrichment?serviceId=${service.id}`,{headers:staff})).json();
    expect((await call('/api/enrichment/revert',{method:'POST',headers:staff,body:JSON.stringify({id:overwrites[0].id,serviceId:service.id})})).status).toBe(200);
    expect(shown().cost).toBeNull();expect(shown().enrichment?.facts).toHaveLength(2);
  });
  it('follows up a consenting report and the finding arrives as a pending report, changing no record',async()=>{
    const feedback=new FeedbackStore(join(directory,'feedback.sqlite'));const consent=validateFollowUp({phone:'07700 900123',consent:true})!;
    const report=feedback.submit(service,{answers:{upToDate:'yes',issues:[]},note:'Used it last week'});feedback.close();
    const follow=new FollowUpStore(join(directory,'follow-ups.sqlite'));follow.record(report.id,service,consent.phone);follow.close();
    const placed=await call('/api/follow-ups',{method:'POST',headers:staff,body:JSON.stringify({feedbackId:report.id})});expect(placed.status).toBe(202);expect(await placed.text()).not.toContain('07700');
    expect(followupBody).toMatchObject({person:{phone:'07700900123'},consent:{attested:true},services:[{name:service.name,job_id:jobId}],reference:report.id});
    const result=await (await call(`/api/follow-ups?feedbackId=${report.id}`,{headers:staff})).json();
    expect(result.followUp).toMatchObject({status:'completed',outcome:'answered'});
    const after=new FeedbackStore(join(directory,'feedback.sqlite'));const pending=after.list('pending').filter(entry=>entry.id!==report.id);after.close();
    expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({serviceId:service.id,answers:{availability:'closed'}});expect(pending[0].note).toContain("it's shut down");
    expect(result.followUp.reportIds).toEqual([pending[0].id]);expect(shown().availability).toBe(read().availability);
  });
  it('is refused by the service without the right token',async()=>{
    const response=await fetch(`${hackBase}/jobs`,{method:'POST',headers:{authorization:'Bearer wrong'},body:'{}'});expect(response.status).toBe(401);
  });
});
