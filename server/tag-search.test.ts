import { describe, expect, it, vi } from 'vitest';
import { matchingServiceTags, searchDirectory } from './directory-search';
import type { DirectoryRecord } from '../src/lib/directory';
vi.mock('./semantic.ts', () => ({ semanticMatches: vi.fn(async () => new Map([['ordinary', {score:0.95,snippet:'Housing support'}], ['tagged', {score:0.05,snippet:'A community group'}]])) }));
const base: DirectoryRecord = {id:'ordinary',name:'Housing support',provider:'Provider',description:'Housing support',searchText:'Housing support',source:'Bristol',postcode:null,lat:null,lng:null};
describe('staff tag search priority', () => {
  it('matches whole significant tag words without boosting partial or unrelated tags', () => {
    expect(matchingServiceTags(['Housing support','art','the and'], 'I need support with housing')).toEqual(['Housing support']);
    expect(matchingServiceTags(['Housing support','art'], 'I need support to start work')).toEqual([]);
  });
  for (const mode of ['keyword','semantic']) {
    it(`surfaces relevant tags first in ${mode} search even below semantic threshold`, async () => {
      const tagged = {...base,id:'tagged',name:'Z community group',description:'A community group',searchText:'A community group',tags:['Housing support']};
      const unrelated = {...base,id:'unrelated',name:'A other group',searchText:'Something else',tags:['Childcare']};
      const result = await searchDirectory([base,tagged,unrelated], new URLSearchParams({q:'housing support',mode}));
      expect(result.records[0].id).toBe('tagged');
      expect(result.records[0].tags).toEqual(['Housing support']);
      expect(result.records.some(record => record.id==='unrelated')).toBe(false);
    });
  }
});
