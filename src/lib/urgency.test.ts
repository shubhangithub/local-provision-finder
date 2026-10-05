import { describe, expect, it } from 'vitest';
import { detectUrgency, needsHelpToday, urgentServiceEvidence } from './urgency';
import type { DirectoryRecord } from './directory';
describe('urgency signals',()=>{
 it.each(['I need help today','I have nowhere to sleep tonight','I have no food for my kids','I am not safe at home','I’m sleeping rough','I want to die'])('recognises a clear present need: %s',text=>expect(detectUrgency(text)?.level).toBe('today'));
 it.each(['I am feeling anxious','I need evening childcare','I am not suicidal','This is not urgent','I used to have nowhere to stay','I do not want to hurt myself','I am not going to kill myself'])('avoids routine, negated or historical phrases: %s',text=>expect(detectUrgency(text)).toBeNull());
 it('prioritises danger and preserves a current clause after a negation',()=>{expect(detectUrgency('I need food today. I cannot keep myself safe')?.level).toBe('danger');expect(detectUrgency('It was not urgent but I have no food now')?.topic).toBe('food');});
 it('allows a user to override an inferred priority',()=>{expect(needsHelpToday('no food','normal')).toBe(false);expect(needsHelpToday('training','today')).toBe(true);});
 it('only badges explicit, positive recorded urgent provision',()=>{const record:DirectoryRecord={id:'test',provider:'Charity',source:'Bristol',postcode:null,lat:null,lng:null,searchText:'',name:'Support group',description:'We offer emergency accommodation.',categories:[]};expect(urgentServiceEvidence(record)).toBe('We offer emergency accommodation');expect(urgentServiceEvidence({...record,description:'We do not provide emergency accommodation.'})).toBeNull();expect(urgentServiceEvidence({...record,description:'Open weekday mornings.'})).toBeNull();});
});
