import { describe, expect, it } from 'vitest';
import { catalogue } from '../data/catalogue';
import { effectiveStatus, inferNeeds, isRemote } from './search';

describe('catalogue helpers', () => {
  it('derives a review-due status from the ownership review date', () => {
    expect(effectiveStatus(catalogue.find(s => s.id === 'LP-007')!)).toBe('Review due');
  });
  it('infers needs from everyday wording', () => {
    expect(inferNeeds('I am anxious and about to be evicted')).toEqual(expect.arrayContaining(['wellbeing', 'housing']));
  });
  it('treats hybrid delivery as remote', () => {
    expect(isRemote({ delivery: 'Hybrid' } as never)).toBe(true);
    expect(isRemote({ delivery: 'In person' } as never)).toBe(false);
  });
});
