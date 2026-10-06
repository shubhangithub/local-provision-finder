import { describe,expect,it } from 'vitest';
import { EnrichmentError,EnrichmentStore,enrichmentOverlay,enrichmentSearchText,factRows,mapFacts } from './enrichment-store';
const service={id:'bucks:1',name:'Elmhurst Family Hub'};
const record={...service,cost:'Free',openingTimes:null,eligibilitySummary:'Families',accessibility:['Step-free'],publicPhone:'01296 000000',searchText:'name: Elmhurst Family Hub'};
const fact=(over:Record<string,unknown>)=>({key:'k',value:'v',source_url:'https://example.test/a',quote:'q',...over});
const found=(facts:unknown[],chunks:unknown[]=[])=>({status:'completed' as const,id:'job',result:{outcome:'found',service_name:service.name,facts,chunks}});
const at=(minutes:number)=>new Date(Date.UTC(2026,9,5,12,minutes));
function run(store:EnrichmentStore,job:ReturnType<typeof found>,minute:number,rec:Record<string,any>=record) {
  const started=store.startRun(service,'job',{},at(minute));return store.complete(started.id,job,rec,at(minute+1));
}
describe('enrichment storage',()=>{
  it('stores a result, finds the latest success, and allows one active run per service',()=>{
    const store=new EnrichmentStore(':memory:');
    const first=store.startRun(service,'job-1',{postcode:'HP20'},at(0));
    expect(()=>store.startRun(service,'job-2',{},at(5))).toThrow(EnrichmentError);
    store.complete(first.id,found([fact({key:'cost_note',value:'Free drop-in'})]),record,at(1));
    expect(store.latestSuccess(service.id)?.result?.facts).toHaveLength(1);
    const failed=store.startRun(service,'job-3',{},at(10));
    store.complete(failed.id,{id:'x',status:'error',error:{message:'agent failed'}},record,at(11));
    expect(store.latestRun(service.id)).toMatchObject({status:'error',error:'agent failed'});
    expect(store.latestSuccess(service.id)?.id).toBe(first.id);
  });
  it('lets a lost run stop blocking after it goes stale',()=>{
    const store=new EnrichmentStore(':memory:');store.startRun(service,'job-1',{},at(0));
    expect(()=>store.startRun(service,'job-2',{},at(14))).toThrow();expect(store.startRun(service,'job-2',{},at(16)).jobId).toBe('job-2');
  });
  it('completes a run once and ignores a repeated completion',()=>{
    const store=new EnrichmentStore(':memory:');const started=store.startRun(service,'job',{},at(0));
    store.complete(started.id,{id:'job',status:'running'},record,at(1));expect(store.getRun(started.id)?.status).toBe('running');
    const job=found([fact({topic:'cost',value:'Five pounds'})]);store.complete(started.id,job,record,at(2));store.complete(started.id,job,record,at(3));
    expect(store.overwrites(service.id)).toHaveLength(1);
  });
});
describe('mapping facts to fields',()=>{
  it('maps each checklist topic and joins several answers',()=>{
    const mapped=mapFacts({facts:[
      fact({topic:'cost',value:'Five pounds'}),fact({topic:'Session times',key:'a',value:'Wed 11:00-12:00'}),fact({topic:'session times',key:'b',value:'Fri 10:00'}),
      fact({topic:'eligibility',value:'Under fives'}),fact({topic:'accessibility',value:'Ramp at the side door'}),fact({topic:'how to book',value:'Ring ahead'}),fact({topic:'location',value:'High Street, Aylesbury HP20 1AA'}),
    ]});
    expect(Object.fromEntries(mapped.map(item=>[item.field,item.value]))).toEqual({cost:'Five pounds',openingTimes:'Wed 11:00-12:00; Fri 10:00',eligibilitySummary:'Under fives',accessibility:'Ramp at the side door',referralRoute:'Ring ahead',address:'High Street, Aylesbury HP20 1AA'});
  });
  it('takes a phone number and email only when the value contains one',()=>{
    expect(mapFacts({facts:[fact({topic:'contact details',value:'Call 01296 123 456 or hello@hub.example.org'})]}).map(item=>[item.field,item.value])).toEqual([['publicEmail','hello@hub.example.org'],['publicPhone','01296 123 456']]);
    expect(mapFacts({facts:[fact({topic:'contact details',value:'Ask at reception'})]})).toEqual([]);
  });
  it('leaves facts with no checklist topic, no source, or an ended period as rows only',()=>{
    const result={facts:[fact({key:'session_balanceability',value:'Wednesday 11:00',topic:undefined}),fact({topic:'cost',value:'Old price',valid_to:'2020-01-01'}),fact({topic:'cost',value:'No source',source_url:undefined})]};
    expect(mapFacts(result)).toEqual([]);
    expect(factRows(result,new Date('2026-10-05')).map(row=>[row.label,row.outdated])).toEqual([['Session balanceability',false],['K',true],['K',false]]);
  });
});
describe('overwrites and the overlay',()=>{
  it('overwrites a field, keeps the original and provenance, and does not touch the catalogue record',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds',quote:'It is five pounds',source_url:'https://example.test/cost'})]),0);
    const [change]=store.overwrites(service.id);
    expect(change).toMatchObject({field:'cost',original:'Free',value:'Five pounds',sourceUrl:'https://example.test/cost',quote:'It is five pounds'});
    const frozen=JSON.stringify(record);const shown=enrichmentOverlay(record,store.data(service.id));
    expect(shown.cost).toBe('Five pounds');expect(JSON.stringify(record)).toBe(frozen);expect(shown.enrichment?.overwrites).toEqual([{id:change.id,field:'cost',sourceUrl:'https://example.test/cost'}]);
  });
  it('shows an accessibility overwrite as a list and skips a value the record already has',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'accessibility',value:'Ramp'}),fact({topic:'eligibility',value:'families',key:'e'})]),0);
    expect(store.overwrites(service.id).map(item=>item.field)).toEqual(['accessibility']);
    expect(enrichmentOverlay(record,store.data(service.id)).accessibility).toEqual(['Ramp']);
  });
  it('is not applied when a staff correction is newer than the overwrite',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds'})]),0);
    const staff={...record,cost:'Free for under fives',fieldCheckedAt:{cost:at(30).toISOString()}};
    expect(enrichmentOverlay(staff,store.data(service.id)).cost).toBe('Free for under fives');
    const older={...record,cost:'Old staff value',fieldCheckedAt:{cost:at(-30).toISOString()}};
    expect(enrichmentOverlay(older,store.data(service.id)).cost).toBe('Five pounds');
  });
  it('shows every fact as a row and adds fact text and chunks to the search text',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({key:'session_balanceability',value:'Wednesday 11:00-12:00'})],[{text:'Balanceability is a balance bike class.',source_url:'https://example.test/a'}]),0);
    const shown=enrichmentOverlay(record,store.data(service.id));
    expect(shown.enrichment?.facts[0]).toMatchObject({label:'Session balanceability',value:'Wednesday 11:00-12:00',sourceUrl:'https://example.test/a'});
    expect(shown.searchText).toContain('Wednesday 11:00-12:00');expect(shown.searchText).toContain('balance bike class');expect(shown.searchText).toContain('name: Elmhurst Family Hub');
    expect(enrichmentSearchText({facts:[fact({value:'gone',valid_to:'2019'})]})).toBe('');
  });
  it('reverts one field, and a refresh with the same value does not bring it back',()=>{
    const store=new EnrichmentStore(':memory:');const job=()=>found([fact({topic:'cost',value:'Five pounds'}),fact({topic:'eligibility',key:'e',value:'Under fives'})]);
    run(store,job(),0);const cost=store.overwrites(service.id).find(item=>item.field==='cost')!;
    store.revert(cost.id,service.id,at(5));
    expect(enrichmentOverlay(record,store.data(service.id)).cost).toBe('Free');expect(enrichmentOverlay(record,store.data(service.id)).eligibilitySummary).toBe('Under fives');
    run(store,job(),10);expect(store.overwrites(service.id).map(item=>item.field)).toEqual(['eligibilitySummary']);
    expect(()=>store.revert(cost.id,service.id)).toThrow(EnrichmentError);
  });
  it('applies a different value after a revert and replaces the previous overwrite on refresh',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds'})]),0);
    store.revert(store.overwrites(service.id)[0].id,service.id,at(3));
    run(store,found([fact({topic:'cost',value:'Eight pounds'})]),10);
    expect(store.overwrites(service.id)).toHaveLength(1);expect(store.overwrites(service.id)[0]).toMatchObject({value:'Eight pounds',original:'Free'});
    run(store,found([fact({topic:'cost',value:'Nine pounds'})]),20);
    expect(store.overwrites(service.id)).toHaveLength(1);expect(store.overwrites(service.id)[0]).toMatchObject({value:'Nine pounds',original:'Free'});
    expect(store.overwrites(service.id,true)).toHaveLength(3);
  });
  it('refuses to revert another service\'s overwrite',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds'})]),0);
    expect(()=>store.revert(store.overwrites(service.id)[0].id,'other')).toThrow(EnrichmentError);
  });
});
describe('facts already shown in a standard field',()=>{
  it('are not listed again, while other facts stay as rows',()=>{
    const store=new EnrichmentStore(':memory:');
    run(store,found([fact({key:'free_activities',topic:'cost',value:'All activities are free'}),fact({key:'hub_phone',topic:'contact details',value:'Call 01296 123 456'}),fact({key:'parking',value:'Limited parking'})]),0);
    expect(enrichmentOverlay(record,store.data(service.id)).enrichment?.facts.map(row=>row.key)).toEqual(['parking']);
  });
  it('come back as rows when the overwrite is reverted or could not be applied',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({key:'free_activities',topic:'cost',value:'All activities are free'}),fact({key:'how_to_reach',topic:'contact details',value:'Ask at reception'})]),0);
    expect(enrichmentOverlay(record,store.data(service.id)).enrichment?.facts.map(row=>row.key)).toEqual(['how_to_reach']);
    store.revert(store.overwrites(service.id)[0].id,service.id,at(5));
    expect(enrichmentOverlay(record,store.data(service.id)).enrichment?.facts.map(row=>row.key)).toEqual(['free_activities','how_to_reach']);
  });
});
describe('outcomes that identify nothing',()=>{
  it.each(['ambiguous','not_found'])('stores %s and changes no field, fact or search text',outcome=>{
    const store=new EnrichmentStore(':memory:');const started=store.startRun(service,'job',{},at(0));
    store.complete(started.id,{id:'job',status:'completed',result:{outcome,candidates:[{name:'A',url:'https://a.test'}],facts:[fact({topic:'cost',value:'Five pounds'})]}},record,at(1));
    expect(store.latestRun(service.id)).toMatchObject({status:'completed',outcome});expect(store.overwrites(service.id)).toEqual([]);
    const shown=enrichmentOverlay(record,store.data(service.id));expect(shown).toEqual(record);
  });
  it('keeps an earlier success in force when a later run is ambiguous',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds'})]),0);
    const second=store.startRun(service,'job',{},at(10));store.complete(second.id,{id:'job',status:'completed',result:{outcome:'ambiguous',candidates:[]}},record,at(11));
    expect(store.latestRun(service.id)?.outcome).toBe('ambiguous');expect(enrichmentOverlay(record,store.data(service.id)).cost).toBe('Five pounds');
  });
});
describe('catalogue rebuilds',()=>{
  it('still applies overwrites to a record parsed afresh from a rebuilt catalogue',()=>{
    const store=new EnrichmentStore(':memory:');run(store,found([fact({topic:'cost',value:'Five pounds'})]),0);
    const rebuilt={...JSON.parse(JSON.stringify(record)),description:'Reloaded from source'};
    const shown=enrichmentOverlay(rebuilt,store.data(service.id));
    expect(shown.cost).toBe('Five pounds');expect(shown.description).toBe('Reloaded from source');
  });
});
