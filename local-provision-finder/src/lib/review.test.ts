import { describe, expect, it } from 'vitest';
import { catalogue, changes } from '../data/catalogue';
import { applyDecisions, canPublish } from './review';
import type { ReviewDecision } from '../types';
const decision = (updateId: string, verified: boolean): ReviewDecision => ({ updateId, verified, status: 'published', decidedOn: '2026-10-05T12:00:00Z' });
describe('human-reviewed updates', () => {
  it('does not publish an unverified proposal even when source confidence is high', () => {
    expect(canPublish(changes.find(c => c.id === 'UP-004')!, false)).toBe(false);
    expect(applyDecisions(catalogue, changes, [decision('UP-001', false)])).toEqual(catalogue);
  });
  it('updates only the verified venue and preserves whole-record uncertainty', () => {
    const next = applyDecisions(catalogue, changes, [decision('UP-001', true)]).find(s => s.id === 'LP-004')!;
    expect(next.venue).toBe('Library Meeting Room 2');
    expect(next.venueConflict).toBe(false);
    expect(next.confidence).toBe(42);
    expect(next.status).toBe('Potentially outdated');
    expect(next.lastVerified).toBe('2026-06-15');
    expect(catalogue.find(s => s.id === 'LP-004')!.venue).toBeUndefined();
  });
  it('keeps low-confidence coverage conflicts until an explicit field verification', () => {
    expect(applyDecisions(catalogue, changes, [decision('UP-006', false)])[2].coverageConflict).toBe(true);
    expect(applyDecisions(catalogue, changes, [decision('UP-006', true)])[2].coverageConflict).toBe(false);
  });
  it('holds duplicate new-service proposals for reconciliation', () => {
    expect(canPublish(changes.find(c => c.id === 'UP-002')!, true)).toBe(false);
  });
  it('publishes end dates rather than recording a successful no-op', () => {
    const next = applyDecisions(catalogue, changes, [decision('UP-004', true)]).find(s => s.id === 'LP-002')!;
    expect(next.endDate).toBe('30 January');
  });
});
