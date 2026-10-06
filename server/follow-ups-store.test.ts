import { describe,expect,it } from 'vitest';
import { FollowUpError,FollowUpStore,normalisePhone,retentionDays,validateFollowUp } from './follow-ups-store';
const service={id:'bucks:1',name:'Elmhurst Family Hub'};
const at=(days:number)=>new Date(Date.UTC(2026,9,5)+days*86400000);
describe('follow-up consent',()=>{
  it('accepts UK and international numbers and strips punctuation',()=>{
    expect(normalisePhone('07700 900 123')).toBe('07700900123');expect(normalisePhone('+44 (0)7700-900123'.replace('(0)',''))).toBe('+447700900123');
    for (const bad of ['','12345','abc','+0123456789','07700 9001']) expect(()=>normalisePhone(bad)).toThrow(FollowUpError);
  });
  it('needs consent with a number, and a number with consent',()=>{
    expect(validateFollowUp({phone:'07700 900123',consent:true})).toEqual({phone:'07700900123'});
    expect(()=>validateFollowUp({phone:'07700 900123'})).toThrow(/Tick the box/);
    expect(()=>validateFollowUp({phone:'07700 900123',consent:false})).toThrow(/Tick the box/);
    expect(()=>validateFollowUp({phone:'',consent:true})).toThrow(/phone number/);
    expect(()=>validateFollowUp('07700')).toThrow(FollowUpError);
  });
  it('treats a blank block as no follow-up',()=>{expect(validateFollowUp(undefined)).toBeNull();expect(validateFollowUp({phone:'',consent:false})).toBeNull();});
});
describe('follow-up storage',()=>{
  it('keeps the number out of every listing and the follow-up record',()=>{
    const store=new FollowUpStore(':memory:');store.record('fb-1',service,'07700900123',at(0));
    expect(JSON.stringify(store.list(at(0)))).not.toContain('07700900123');expect(JSON.stringify(store.get('fb-1',at(0)))).not.toContain('07700900123');
    expect(store.get('fb-1',at(0))).toMatchObject({status:'scheduled',serviceName:'Elmhurst Family Hub'});
  });
  it('starts once, deletes the number on completion, and does not allow a second call',()=>{
    const store=new FollowUpStore(':memory:');store.record('fb-1',service,'07700900123',at(0));
    expect(store.begin('fb-1',at(1)).phone).toBe('07700900123');expect(()=>store.begin('fb-1',at(1))).toThrow(/already been placed/);
    expect(store.finish('fb-1','completed',{outcome:'answered'},at(2))).toBe(true);expect(store.finish('fb-1','completed',{},at(2))).toBe(false);
    expect(store.get('fb-1',at(2))).toMatchObject({status:'completed',outcome:'answered'});
    expect(()=>store.begin('fb-1',at(3))).toThrow(FollowUpError);
    expect((store as unknown as {db:{prepare:(sql:string)=>{get:(id:string)=>{phone:string|null}}}}).db.prepare('SELECT phone FROM follow_ups WHERE feedback_id=?').get('fb-1').phone).toBeNull();
  });
  it('keeps the number after a refusal so staff can try again',()=>{
    const store=new FollowUpStore(':memory:');store.record('fb-1',service,'07700900123',at(0));store.begin('fb-1',at(1));
    store.finish('fb-1','denied',{reason:'Outside calling hours.'},at(1));expect(store.get('fb-1',at(1))).toMatchObject({status:'denied',reason:'Outside calling hours.'});
    expect(store.begin('fb-1',at(2)).phone).toBe('07700900123');expect(store.get('fb-1',at(2))?.reason).toBeNull();
  });
  it('deletes a number that was never used after the retention period, and keeps the follow-up record',()=>{
    const store=new FollowUpStore(':memory:');store.record('fb-1',service,'07700900123',at(0));
    expect(store.get('fb-1',at(retentionDays-1))?.status).toBe('scheduled');
    expect(store.get('fb-1',at(retentionDays+1))?.status).toBe('expired');expect(()=>store.begin('fb-1',at(retentionDays+2))).toThrow(/deleted/);
  });
  it('releases a request that could not be sent',()=>{
    const store=new FollowUpStore(':memory:');store.record('fb-1',service,'07700900123',at(0));store.begin('fb-1',at(1));store.release('fb-1','unreachable');
    expect(store.get('fb-1',at(1))).toMatchObject({status:'failed',reason:'unreachable'});expect(store.begin('fb-1',at(2)).phone).toBe('07700900123');
  });
});
