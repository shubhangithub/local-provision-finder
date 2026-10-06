import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { FollowUpError,FollowUpStore,maxServices,normaliseName,normalisePhone,retentionDays } from './follow-ups-store';
const services=[{id:'a',name:'Service A'},{id:'b',name:'Service B'}];
const at=(days:number)=>new Date(Date.UTC(2026,9,5)+days*86400000);
const phoneOf=(store:FollowUpStore,id:string)=>((store as unknown as {db:DatabaseSync}).db.prepare('SELECT phone FROM meeting_follow_ups WHERE id=?').get(id) as {phone:string|null}).phone;
describe('input rules',()=>{
  it('accepts UK and international numbers and strips punctuation',()=>{
    expect(normalisePhone('07700 900 123')).toBe('07700900123');expect(normalisePhone('+44 7700-900123')).toBe('+447700900123');
    for (const bad of ['','12345','abc','+0123456789','07700 9001']) expect(()=>normalisePhone(bad)).toThrow(FollowUpError);
  });
  it('treats the first name as optional and tidies it',()=>{
    expect(normaliseName(undefined)).toBeNull();expect(normaliseName('  ')).toBeNull();expect(normaliseName(' Sam\n Jones ')).toBe('Sam Jones');
    expect(()=>normaliseName('x'.repeat(41))).toThrow(FollowUpError);expect(()=>normaliseName(5)).toThrow(FollowUpError);
  });
});
describe('meeting follow-ups',()=>{
  it('stores a customer with several services and never lists the number',()=>{
    const store=new FollowUpStore(':memory:');const made=store.create({personName:'Sam',phone:'07700900123',services},at(0));
    expect(made).toMatchObject({personName:'Sam',status:'scheduled',services});
    expect(JSON.stringify(store.list(at(0)))).not.toContain('07700');expect(JSON.stringify(made)).not.toContain('07700');
  });
  it('needs one to five services',()=>{
    const store=new FollowUpStore(':memory:');
    expect(()=>store.create({personName:null,phone:'07700900123',services:[]})).toThrow(/at least one/);
    expect(()=>store.create({personName:null,phone:'07700900123',services:Array.from({length:maxServices+1},(_,i)=>({id:String(i),name:`S${i}`}))})).toThrow(/at most/);
  });
  it('lists newest first',()=>{
    const store=new FollowUpStore(':memory:');const first=store.create({personName:'A',phone:'07700900123',services},at(0));const second=store.create({personName:'B',phone:'07700900124',services},at(0));
    expect(store.list(at(0)).map(item=>item.id)).toEqual([second.id,first.id]);
  });
  it('starts once, deletes the number when completed, and cannot be started again',()=>{
    const store=new FollowUpStore(':memory:');const made=store.create({personName:null,phone:'07700900123',services},at(0));
    expect(store.begin(made.id,at(1)).phone).toBe('07700900123');expect(()=>store.begin(made.id,at(1))).toThrow(/already been placed/);
    expect(store.finish(made.id,'completed',{outcome:'answered'},at(2))).toBe(true);expect(store.finish(made.id,'completed',{},at(2))).toBe(false);
    expect(phoneOf(store,made.id)).toBeNull();expect(store.get(made.id,at(2))).toMatchObject({status:'completed',outcome:'answered'});
    expect(()=>store.begin(made.id,at(3))).toThrow(FollowUpError);
  });
  it('keeps the number after a refusal so staff can try again',()=>{
    const store=new FollowUpStore(':memory:');const made=store.create({personName:null,phone:'07700900123',services},at(0));store.begin(made.id,at(1));
    store.finish(made.id,'denied',{reason:'Outside calling hours.'},at(1));expect(store.get(made.id,at(1))).toMatchObject({status:'denied',reason:'Outside calling hours.'});
    expect(store.begin(made.id,at(2)).phone).toBe('07700900123');expect(store.get(made.id,at(2))?.reason).toBeNull();
  });
  it('releases a request that could not be sent',()=>{
    const store=new FollowUpStore(':memory:');const made=store.create({personName:null,phone:'07700900123',services},at(0));store.begin(made.id,at(1));store.release(made.id,'unreachable');
    expect(store.get(made.id,at(1))).toMatchObject({status:'failed',reason:'unreachable'});expect(store.begin(made.id,at(2)).phone).toBe('07700900123');
  });
  it('deletes a number never used after the retention period and keeps the record',()=>{
    const store=new FollowUpStore(':memory:');const made=store.create({personName:null,phone:'07700900123',services},at(0));
    expect(store.get(made.id,at(retentionDays-1))?.status).toBe('scheduled');
    expect(store.get(made.id,at(retentionDays+1))?.status).toBe('expired');expect(phoneOf(store,made.id)).toBeNull();expect(()=>store.begin(made.id,at(retentionDays+2))).toThrow(/deleted/);
  });
  it('clears numbers left in the old feedback-form table',()=>{
    const directory=mkdtempSync(join(tmpdir(),'followups-legacy-'));
    try {
      const path=join(directory,'follow-ups.sqlite');const old=new DatabaseSync(path);
      old.exec("CREATE TABLE follow_ups(feedback_id TEXT PRIMARY KEY,phone TEXT)");old.prepare('INSERT INTO follow_ups VALUES(?,?)').run('fb-1','07700900123');old.close();
      const store=new FollowUpStore(path);store.close();
      const check=new DatabaseSync(path);expect((check.prepare('SELECT phone FROM follow_ups').get() as {phone:string|null}).phone).toBeNull();check.close();
    } finally {rmSync(directory,{recursive:true,force:true});}
  });
});
