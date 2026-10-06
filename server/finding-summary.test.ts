import { describe, expect, it, vi } from 'vitest';
import { acceptable, summariseFinding } from './finding-summary';

const config={azure:false,apiKey:'k',model:'m',url:'http://x'};
const input=(said:string)=>({field:'capacity',label:'Capacity',service:'Turning Point',said});
const reply=(content:string,ok=true)=>vi.fn(async()=>({ok,status:ok ? 200 : 500,json:async()=>({choices:[{message:{content}}]})}) as unknown as Response);
describe('summariseFinding',()=>{
  it('returns a neutral rewrite',async()=>{expect(await summariseFinding(input('good one'),config,reply('Busy: about a 2-week wait'))).toBe('Busy: about a 2-week wait');});
  it('rejects first-person, reported-speech and over-long rewrites',async()=>{
    expect(acceptable("I think they are busy")).toBe(false);expect(acceptable('They said it is busy')).toBe(false);expect(acceptable('x'.repeat(201))).toBe(false);expect(acceptable('')).toBe(false);
    expect(await summariseFinding(input('first person'),config,reply("They told me it is busy"))).toBeNull();
  });
  it('returns null on an HTTP error, a thrown error or no key',async()=>{
    expect(await summariseFinding(input('http'),config,reply('Busy',false))).toBeNull();
    expect(await summariseFinding(input('throws'),config,vi.fn(async()=>{throw new Error('timeout');}) as unknown as typeof fetch)).toBeNull();
    const fetcher=reply('Busy');expect(await summariseFinding(input('nokey'),{...config,apiKey:undefined},fetcher)).toBeNull();expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends only the service name and the words',async()=>{
    const fetcher=reply('Busy');await summariseFinding(input('words only'),config,fetcher);
    const body=String((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body);expect(body).toContain('Turning Point');expect(body).toContain('words only');
  });
});
