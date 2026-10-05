import { describe, expect, it } from 'vitest';
import { buildVocabulary, suggestTerms } from './suggest-terms.ts';

const record = (name: string, source: string, extra: { needs?: string[]; categories?: string[]; tags?: string[] }) => ({ name, source, ...extra });
const records = [
  record('Bristol Food Hub', 'Bristol City Council / Well Aware', { needs: ['Money and debt'], categories: ['Food support'], tags: ['Food bank'] }),
  record('Kingston Meals', 'Connected Kingston', { categories: ['Food support', 'Food support'], tags: ['Community meals'] }),
  record('Soup Kitchen', 'Connected Kingston', { categories: ['Advice and support'] }),
  record('Anxiety Group', 'Bristol City Council / Well Aware', { needs: ['Mental health'], tags: ['x'] }),
];

describe('term suggestions', () => {
  const vocabulary = buildVocabulary(records, ['anxiety', 'money worries']);
  it('suggests vocabulary terms, never service names', () => {
    expect(suggestTerms(buildVocabulary([record('Food bank', 'Bristol', { tags: ['Food bank', 'Food parcels'] })]), 'food')).toEqual(['Food parcels']);
    expect(suggestTerms(vocabulary, 'food')).toEqual(['Food support', 'Food bank']);
    const names = records.map(item => item.name.toLowerCase());
    for (const term of suggestTerms(vocabulary, 'food')) expect(names).not.toContain(term.toLowerCase());
  });
  it('ranks prefix matches before word and substring matches, then by count', () => {
    const terms = suggestTerms(vocabulary, 'support');
    expect(terms).toEqual(['Food support', 'Advice and support']);
    expect(suggestTerms(vocabulary, 'anx')).toEqual(['anxiety']);
  });
  it('deduplicates case-insensitively and counts a record once per term', () => {
    const duplicated = buildVocabulary([record('A', 'Bristol', { categories: ['Food Bank'], tags: ['food bank'] })]);
    expect(suggestTerms(duplicated, 'food')).toEqual(['Food Bank']);
    expect(duplicated.get('food bank')!.total).toBe(1);
  });
  it('limits terms to the region while keeping curated terms', () => {
    expect(suggestTerms(vocabulary, 'food', 'Kingston')).toEqual(['Food support']);
    expect(suggestTerms(vocabulary, 'food bank', 'Kingston')).toEqual([]);
    expect(suggestTerms(vocabulary, 'anx', 'Kingston')).toEqual(['anxiety']);
  });
  it('requires two characters, caps the list and drops over-long or tiny terms', () => {
    expect(suggestTerms(vocabulary, 'f')).toEqual([]);
    const many = buildVocabulary([record('N', 'Bristol', { tags: Array.from({ length: 12 }, (_, index) => `walk ${index}`).concat(['x', 'y'.repeat(60)]) })]);
    expect(suggestTerms(many, 'walk')).toHaveLength(6);
    expect(suggestTerms(many, 'yy')).toEqual([]);
  });
});
