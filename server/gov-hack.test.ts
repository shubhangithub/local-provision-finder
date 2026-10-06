import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { GovHackClient,GovHackError,govHackConfig } from './gov-hack';
// The test must not read the developer's real .env.
vi.mock('vite',()=>({loadEnv:()=>({})}));
const config={url:'https://hack.example.test',token:'secret-token-value'};
const reply=(status:number,body:unknown)=>vi.fn(async()=>new Response(JSON.stringify(body),{status}));
describe('gov-hack client',()=>{
  const saved={...process.env};
  beforeEach(()=>{delete process.env.GOV_HACK_URL;delete process.env.GOV_HACK_API_TOKEN;});
  afterEach(()=>{process.env={...saved};});
  it('is unconfigured unless both settings are present, and trims a trailing slash',()=>{
    expect(govHackConfig()).toBeNull();process.env.GOV_HACK_URL='https://x.test/';expect(govHackConfig()).toBeNull();
    process.env.GOV_HACK_API_TOKEN='tok';expect(govHackConfig()).toEqual({url:'https://x.test',token:'tok'});
  });
  it('sends the bearer token and JSON body',async()=>{
    const fetcher=reply(202,{id:'job-1',status:'queued'});
    await expect(new GovHackClient(config,fetcher as unknown as typeof fetch).submitJob('Club',{postcode:'HP20'})).resolves.toEqual({id:'job-1',status:'queued'});
    const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe('https://hack.example.test/jobs');expect((init.headers as Record<string,string>).Authorization).toBe('Bearer secret-token-value');
    expect(JSON.parse(String(init.body))).toEqual({name:'Club',context:{postcode:'HP20'}});
  });
  it('sends previous only when given',async()=>{
    const fetcher=reply(202,{id:'j',status:'queued'});await new GovHackClient(config,fetcher as unknown as typeof fetch).submitJob('Club',{},{outcome:'found'});
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body)).previous).toEqual({outcome:'found'});
  });
  it('maps a rejected token, an unreachable service and a disabled feature to clear errors',async()=>{
    await expect(new GovHackClient(config,reply(401,{error:'unauthorized'}) as unknown as typeof fetch).getJob('a')).rejects.toMatchObject({code:'unauthorised',status:502});
    await expect(new GovHackClient(config,vi.fn(async()=>{throw new Error('boom');}) as unknown as typeof fetch).getJob('a')).rejects.toMatchObject({code:'unreachable'});
    await expect(new GovHackClient(config,reply(503,{error:'followups_disabled',message:'Follow-up calls are not available: no agent.'}) as unknown as typeof fetch).submitFollowup({})).rejects.toMatchObject({status:503,message:'Follow-up calls are not available: no agent.'});
    await expect(new GovHackClient(config,reply(401,{}) as unknown as typeof fetch).getJob('a')).rejects.toBeInstanceOf(GovHackError);
  });
});
