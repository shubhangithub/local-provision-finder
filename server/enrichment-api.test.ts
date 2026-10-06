import { createServer,type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { enrichmentContext,enrichmentHandler } from './enrichment-api';
import { GovHackClient,GovHackError } from './gov-hack';
import { EnrichmentStore } from './enrichment-store';

const service={id:'bucks:1',name:'Elmhurst Family Hub',provider:'Bucks Council',postcode:'HP20 1AA',address:null,url:'https://hub.example.test',description:'Family hub',cost:null,searchText:'x'};
let directory:string,server:Server,base:string,job:Record<string,any>,client:GovHackClient | null,submit:ReturnType<typeof vi.fn>;
const staff={'x-staff-demo':'true','content-type':'application/json'};
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),'enrich-api-'));
  const db=new DatabaseSync(join(directory,'services.sqlite'));
  db.exec('CREATE TABLE catalogue_services(id TEXT PRIMARY KEY,source_id TEXT,postcode TEXT,lat REAL,lng REAL,vetting TEXT,availability TEXT,record_json TEXT,search_text TEXT)');
  db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(service.id,'bucks',null,null,null,'public','Available',JSON.stringify(service),'x');db.close();
  job={id:'job-1',status:'running'};submit=vi.fn(async()=>({id:'job-1',status:'queued'}));
  client={submitJob:submit,getJob:vi.fn(async()=>job),submitFollowup:vi.fn(),getFollowup:vi.fn()} as unknown as GovHackClient;
  const handler=enrichmentHandler({directory,client:()=>client});
  server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end('{}');}));
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(()=>{server.close();rmSync(directory,{recursive:true,force:true});});
const call=(path:string,init:RequestInit={})=>fetch(base+path,init);
const start=(body:Record<string,unknown>={serviceId:service.id})=>call('/api/enrichment',{method:'POST',headers:staff,body:JSON.stringify(body)});
describe('enrichment API',()=>{
  it('requires the staff workspace',async()=>{
    expect((await call('/api/enrichment?serviceId=bucks:1')).status).toBe(403);
    expect((await call('/api/enrichment',{method:'POST',body:'{}',headers:{'content-type':'application/json'}})).status).toBe(403);
    expect((await call('/api/enrichment/recent')).status).toBe(403);
  });
  it('is disabled with a clear message when the service is not configured',async()=>{
    client=null;const response=await start();expect(response.status).toBe(503);expect((await response.json()).error).toMatch(/GOV_HACK_URL/);
    const status=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();expect(status.configured).toBe(false);
  });
  it('starts a job with the service details as context and never sends the token or address to the browser',async()=>{
    const response=await start({serviceId:service.id,notes:'Try the council page'});const raw=await response.text();
    expect(response.status).toBe(202);expect(JSON.parse(raw).run.status).toBe('running');
    expect(submit).toHaveBeenCalledWith('Elmhurst Family Hub',{provider:'Bucks Council',postcode:'HP20 1AA',url:'https://hub.example.test',description:'Family hub',notes:'Try the council page'},undefined);
    expect(raw).not.toMatch(/token|hack\.example|Bearer/i);
  });
  it('refuses a second start while one is running, without submitting another job',async()=>{
    expect((await start()).status).toBe(202);expect((await start()).status).toBe(409);expect(submit).toHaveBeenCalledTimes(1);
  });
  it('stores the finished result on the first poll and applies it once',async()=>{
    await start();job={id:'job-1',status:'completed',result:{outcome:'found',facts:[{key:'cost',topic:'cost',value:'Five pounds',source_url:'https://hub.example.test/cost',quote:'Five pounds'},{key:'extra_note',value:'Bring a towel',source_url:'https://hub.example.test/a'}],chunks:[{text:'Bring a towel.'}],gaps:[{topic:'eligibility',reason:'missing',detail:'No age limit stated',status:'needs_human',flag_reason:'A person needs to check'}]}};
    const first=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();const second=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();
    expect(first.run).toMatchObject({status:'completed',outcome:'found'});expect(first.overwrites).toHaveLength(1);expect(second.overwrites).toHaveLength(1);
    expect(first.facts.map((row:{label:string})=>row.label)).toEqual(['Cost','Extra note']);expect(first.gaps[0]).toMatchObject({topic:'eligibility',detail:'No age limit stated'});
    expect((await call('/api/enrichment/recent',{headers:staff}).then(r=>r.json())).overwrites).toHaveLength(1);
  });
  it('reverts an overwrite',async()=>{
    await start();job={id:'job-1',status:'completed',result:{outcome:'found',facts:[{key:'cost',topic:'cost',value:'Five pounds',source_url:'https://x.test'}]}};
    const {overwrites}=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();
    expect((await call('/api/enrichment/revert',{method:'POST',headers:staff,body:JSON.stringify({id:overwrites[0].id})})).status).toBe(200);
    expect((await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json()).overwrites).toEqual([]);
    expect((await call('/api/enrichment/revert',{method:'POST',headers:staff,body:JSON.stringify({id:overwrites[0].id})})).status).toBe(409);
  });
  it('reports a failed job and keeps no overwrite',async()=>{
    await start();job={id:'job-1',status:'error',error:{message:'agent failed'}};
    const status=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();expect(status.run).toMatchObject({status:'error',error:'agent failed'});expect(status.overwrites).toEqual([]);
  });
  it('reports a job the service has forgotten as failed so staff can start again',async()=>{
    await start();(client as unknown as {getJob:ReturnType<typeof vi.fn>}).getJob.mockRejectedValueOnce(new GovHackError('x',502,'job_not_found'));
    const status=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();
    expect(status.run).toMatchObject({status:'error',error:'The enrichment service lost this job. Try again.'});expect((await start()).status).toBe(202);
  });
  it('surfaces ambiguity with candidates and changes nothing',async()=>{
    await start();job={id:'job-1',status:'completed',result:{outcome:'ambiguous',candidates:[{name:'Elmhurst Hub (Aylesbury)',url:'https://a.test'}]}};
    const status=await (await call('/api/enrichment?serviceId=bucks:1',{headers:staff})).json();
    expect(status.run.outcome).toBe('ambiguous');expect(status.candidates).toHaveLength(1);expect(status.overwrites).toEqual([]);expect(status.facts).toEqual([]);
  });
  it('maps an unreachable or rejecting service to an error and stores no run',async()=>{
    submit.mockRejectedValueOnce(new GovHackError('The enrichment service rejected the access token.',502,'unauthorised'));
    const response=await start();expect(response.status).toBe(502);expect((await response.json()).error).toMatch(/access token/);
    const store=new EnrichmentStore(join(directory,'enrichment.sqlite'));expect(store.latestRun(service.id)).toBeNull();store.close();
  });
  it('validates the website and the service',async()=>{
    expect((await start({serviceId:service.id,url:'javascript:alert(1)'})).status).toBe(400);expect((await start({serviceId:'nope'})).status).toBe(404);
  });
  it('sends the stored result as previous when refreshing',async()=>{
    await start();job={id:'job-1',status:'completed',result:{outcome:'found',facts:[{key:'cost',topic:'cost',value:'Five pounds',source_url:'https://x.test'}]}};
    await call('/api/enrichment?serviceId=bucks:1',{headers:staff});submit.mockClear();await start();
    expect((submit.mock.calls[0] as unknown[])[2]).toMatchObject({outcome:'found'});
  });
});
describe('context',()=>{it('drops empty values',()=>expect(enrichmentContext({provider:'P',postcode:null,url:'https://a.test'},{})).toEqual({provider:'P',url:'https://a.test'}));});
