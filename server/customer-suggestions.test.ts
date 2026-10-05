import {test,expect} from 'vitest';
import {SuggestionsStore} from './suggestions-store';
test('customer resources persist in the pending review queue without publication',()=>{
 const store=new SuggestionsStore(':memory:');
 try {
  const entry=store.submit({name:'Benefits guide',provider:'Community advice',description:'A free resource explaining benefit applications.',website:'https://example.org/guide'});
  expect(store.list()).toEqual([entry]);
  expect(entry.status).toBe('submitted');
  expect(entry.serviceId).toBeNull();
  expect(()=>store.review(entry.id,{action:'publish',verified:true,note:'Checked guide'})).toThrow('Prepare a draft');
  expect(store.prepare(entry.id).status).toBe('draft');
  expect(store.review(entry.id,{action:'reject',note:'Guide is out of date'}).status).toBe('rejected');
 }finally{store.close();}
});
