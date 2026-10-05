import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AvailabilityStore,availabilityOverlay} from './availability';
const now=new Date('2026-10-05T12:00:00Z');
const input={status:'Open',confirmedAt:'2026-10-02T12:00:00Z',staffName:'Staff member',method:'phone',note:'Provider confirmed spaces by phone.'};
describe('availability confirmations',()=>{
 it('persists confirmation history and keeps the most recent check when an older one is recorded',()=>{const dir=mkdtempSync(join(tmpdir(),'availability-'));try{let store=new AvailabilityStore(join(dir,'checks.sqlite'));store.save('service',input,now);store.save('service',{...input,status:'Closed',confirmedAt:'2026-09-30T12:00:00Z'},now);store.close();store=new AvailabilityStore(join(dir,'checks.sqlite'));expect(store.history('service')).toHaveLength(2);expect(store.latest().get('service')?.status).toBe('Open');expect(store.history('service')[0].staffName).toBe('Staff member');store.close();}finally{rmSync(dir,{recursive:true,force:true});}});
 it('requires staff evidence and rejects future dates and invalid statuses',()=>{const store=new AvailabilityStore(':memory:');try{expect(()=>store.save('service',{...input,note:''},now)).toThrow();expect(()=>store.save('service',{...input,confirmedAt:'2026-10-06T12:00:00Z'},now)).toThrow();expect(()=>store.save('service',{...input,status:'Verified'},now)).toThrow();expect(()=>store.save('service',{...input,method:'guess'},now)).toThrow();expect(store.history('service')).toHaveLength(0);}finally{store.close();}});
 it('updates only availability and keeps assurance dates unchanged, preserving newer checked corrections',()=>{const store=new AvailabilityStore(':memory:');try{store.save('service',input,now);const record={id:'service',availability:'Closed',lastVerified:'2020-01-01',fieldCheckedAt:{}};const result=availabilityOverlay(record,store.latest());expect(result.availability).toBe('Open');expect(result.lastVerified).toBe('2020-01-01');expect(result.availabilityConfirmation?.confirmedAt).toBe(new Date(input.confirmedAt).toISOString());expect(availabilityOverlay({...record,fieldCheckedAt:{availability:'2026-10-04T12:00:00Z'}},store.latest()).availability).toBe('Closed');expect(JSON.stringify(result)).not.toContain('Staff member');}finally{store.close();}});
});
