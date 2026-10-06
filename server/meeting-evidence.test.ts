import { describe, expect, it } from 'vitest';
import { evidenceExcerpt } from './meeting-search';
const text = [
  'name: Talking Therapies for mental health and wellbeing',
  'We provide a calm place to talk about mental health problems.',
  'Languages: The venue advertises help in Polish and Spanish. Renata offers therapy in Polish and English.',
].join('\n');
const covered = 'Talking Therapies for mental health and wellbeing. We provide a calm place to talk about mental health problems.';
describe('evidence shown to the relevance filter', () => {
  it('prefers the passage with words the service summary does not already contain', () => {
    const excerpt = evidenceExcerpt(text, 'polish mental health support', covered)!;
    expect(excerpt).toMatch(/Polish/);
    expect(excerpt).not.toMatch(/^name:/);
  });
  it('falls back to the best ordinary match when every word is already in the summary', () => {
    expect(evidenceExcerpt(text, 'mental health support', covered)).toMatch(/mental health/i);
  });
  it('returns nothing when nothing matches or the query has only generic words', () => {
    expect(evidenceExcerpt(text, 'archery club', covered)).toBeUndefined();
    expect(evidenceExcerpt(text, 'help and support', covered)).toBeUndefined();
  });
  it('keeps the excerpt short', () => {
    expect(evidenceExcerpt('polish '.repeat(200) + 'tail.', 'polish', '', 100)!.length).toBeLessThanOrEqual(101);
  });
});
