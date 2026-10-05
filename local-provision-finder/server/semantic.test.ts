import { describe,it,expect } from 'vitest';
import { cosineSimilarity,semanticChunks,recordFingerprint } from './semantic';
import type { DirectoryRecord } from '../src/lib/directory';
const record:DirectoryRecord={id:'long',name:'Long description',provider:'Charity',description:'Description',searchText:`${'Early text '.repeat(500)}Late detail about hearing support`,source:'Bristol',postcode:null,lat:null,lng:null};
describe('semantic index integrity',()=>{
 it('indexes late retained text as well as the beginning of a long record',()=>{const chunks=semanticChunks(record);expect(chunks.length).toBeGreaterThan(1);expect(chunks.at(-1)).toContain('Late detail about hearing support');});
 it('detects a source or checked-detail change and handles non-unit vectors',()=>{expect(recordFingerprint(record)).not.toBe(recordFingerprint({...record,description:'Updated support'}));expect(cosineSimilarity([2,0],[10,0])).toBeCloseTo(1);expect(cosineSimilarity([1,0],[0,1])).toBe(0);expect(cosineSimilarity([0,0],[1,0])).toBe(0);});
});
