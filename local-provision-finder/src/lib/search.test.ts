import { describe, expect, it } from 'vitest';
import { catalogue } from '../data/catalogue';
import { defaultQuery, effectiveStatus, findServices, parsePostcode } from './search';

describe('catalogue search boundaries', () => {
  it('uses all eight synthetic postcode areas and rejects unsupported locations', () => {
    expect(parsePostcode('ab4 1xx')).toBe('AB4');
    expect(parsePostcode('AB8')).toBe('AB8');
    expect(parsePostcode('AB9')).toBeNull();
    expect(parsePostcode('SW1A 1AA')).toBeNull();
  });
  it('preserves the AB4 housing gap and respects CIT-004’s two-mile radius', () => {
    const result = findServices(catalogue, { ...defaultQuery, text: 'anxiety and housing', postcode: 'AB4', radius: 2, practical: ['quiet'] });
    expect(result.matches.map(m => m.service.id)).toEqual(['LP-003']);
    expect(result.matches[0].service.coverageConflict).toBe(true);
    expect(result.unmetNeeds).toEqual(['housing']);
    expect(result.farther.map(m => m.service.id)).toEqual(['LP-004']);
  });
  it('shows stale information with uncertainty after explicitly widening the radius', () => {
    const result = findServices(catalogue, { ...defaultQuery, text: 'anxiety', postcode: 'AB4', radius: 3 });
    expect(result.matches.map(m => m.service.id)).toEqual(['LP-003', 'LP-004']);
    expect(result.matches[1].service.venueConflict).toBe(true);
    expect(result.matches[1].service.status).toBe('Potentially outdated');
  });
  it('excludes a closed service instead of recommending the only transport match', () => {
    const result = findServices(catalogue, { ...defaultQuery, text: 'cannot get to work', postcode: 'AB1' });
    expect(result.matches).toHaveLength(0);
    expect(result.unmetNeeds).toEqual(['transport']);
  });
  it('keeps online coverage local instead of treating it as national', () => {
    const query = { ...defaultQuery, text: 'business idea', radius: 1 };
    expect(findServices(catalogue, { ...query, postcode: 'AB4' }).matches).toHaveLength(0);
    expect(findServices(catalogue, { ...query, postcode: 'AB7' }).matches.map(m => m.service.id)).toEqual(['LP-008']);
    expect(findServices(catalogue, { ...query, postcode: 'AB7', includeRemote: false }).matches).toHaveLength(0);
  });
  it('does not present a training course as childcare support', () => {
    expect(findServices(catalogue, { ...defaultQuery, text: 'childcare', postcode: 'AB6' }).matches).toHaveLength(0);
  });
  it('flags unknown accessibility instead of asserting it is suitable', () => {
    const result = findServices(catalogue, { ...defaultQuery, text: 'construction', postcode: 'AB1', practical: ['captions'] });
    expect(result.matches[0].missingPractical).toEqual(['captions']);
  });
  it('derives a review-due status from the ownership review date', () => {
    expect(effectiveStatus(catalogue.find(s => s.id === 'LP-007')!)).toBe('Review due');
  });
  it('does not return every service for an unmatched short search', () => {
    expect(findServices(catalogue, { ...defaultQuery, text: 'xyz', postcode: 'AB1' }).matches).toHaveLength(0);
  });
});
