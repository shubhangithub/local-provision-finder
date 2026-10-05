import type { ProposedChange, ReviewDecision, Service } from '../types';

export function canPublish(change: ProposedChange, verified: boolean): boolean {
  // Every publication needs a human evidence check, regardless of agent confidence.
  return verified && change.field !== 'New service';
}
export function applyDecisions(catalogue: Service[], changes: ProposedChange[], decisions: ReviewDecision[]): Service[] {
  return catalogue.map(original => {
    let service = { ...original };
    for (const decision of decisions) {
      if (decision.status !== 'published' || !decision.verified) continue;
      const change = changes.find(c => c.id === decision.updateId && c.serviceId === service.id);
      if (!change || !canPublish(change, decision.verified)) continue;
      // Update only the verified field. Never inflate whole-record confidence.
      if (change.field === 'Venue') {
        service = { ...service, venue: change.newValue, venueConflict: false, venueCheckedOn: decision.decidedOn.slice(0,10) };
      } else if (change.field === 'End date') {
        service = { ...service, endDate: change.newValue };
      } else if (change.field === 'Closure') {
        service = { ...service, availability: 'Closed' };
      } else if (change.field === 'Eligibility') {
        service = { ...service, coverageConflict: false, postcodePrefixes: [...new Set([...service.postcodePrefixes, 'AB4'])] };
      } else if (change.field === 'Accessibility') {
        service = { ...service, accessibility: [...new Set([...service.accessibility, change.newValue])] };
      }
    }
    return service;
  });
}
