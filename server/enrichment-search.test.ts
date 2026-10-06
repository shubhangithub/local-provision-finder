import { describe,expect,it,vi } from 'vitest';
import { searchDirectory } from './directory-search';
import { EnrichmentStore,enrichmentOverlay } from './enrichment-store';
import { recordFingerprint,semanticChunks } from './semantic';
import type { DirectoryRecord } from '../src/lib/directory';
vi.mock('./semantic.ts',async importOriginal=>({...await importOriginal<typeof import('./semantic')>(),semanticMatches:vi.fn(async()=>null)}));
const base:DirectoryRecord={id:'hub',name:'Elmhurst Family Hub',provider:'Council',description:'Family support',searchText:'name: Elmhurst Family Hub',source:'Buckinghamshire',postcode:null,lat:null,lng:null};
function enriched() {
  const store=new EnrichmentStore(':memory:');const run=store.startRun({id:'hub',name:base.name},'job',{});
  store.complete(run.id,{id:'job',status:'completed',result:{outcome:'found',facts:[{key:'session_balanceability',value:'Wednesday balanceability class',source_url:'https://x.test'}],chunks:[{text:'Zorbing taster mornings run termly.'}]}},base);
  return enrichmentOverlay(base,store.data('hub'));
}
describe('enriched text in search',()=>{
  it('returns a service for words that appear only in an enriched fact or passage',async()=>{
    const other={...base,id:'other',name:'Other group',searchText:'name: Other group'};
    for (const query of ['balanceability','zorbing taster']) {
      expect((await searchDirectory([base,other],new URLSearchParams({q:query,mode:'keyword'}))).records).toEqual([]);
      const result=await searchDirectory([enriched(),other],new URLSearchParams({q:query,mode:'keyword'}));
      expect(result.records.map(record=>record.id)).toEqual(['hub']);
    }
  });
  it('changes the semantic fingerprint and adds the text to the indexed chunks',()=>{
    const shown=enriched();
    expect(recordFingerprint(shown)).not.toBe(recordFingerprint(base));
    expect(semanticChunks(shown).join(' ')).toContain('Zorbing taster mornings');
  });
});
