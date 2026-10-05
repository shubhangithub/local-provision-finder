import { postcodeLookup } from '../data/catalogue';
import type { Need, PracticalNeed, SearchQuery, SearchResult, Service, ServiceMatch } from '../types';

export const needLabels: Record<Need, string> = {
  wellbeing: 'Health & wellbeing', housing: 'Housing', money: 'Money & debt',
  digital: 'Digital skills', training: 'Skills & training', childcare: 'Childcare',
  confidence: 'Confidence', transport: 'Travel support', language: 'English & language',
  enterprise: 'Self-employment',
};
export const practicalLabels: Record<PracticalNeed, string> = {
  'step-free': 'Step-free access', quiet: 'Quiet setting', captions: 'Captions', 'school-hours': 'School hours',
};
export const defaultQuery: SearchQuery = {
  text: '', postcode: '', radius: 3, includeRemote: true,
  needs: [], practical: [], providerType: '',
};
const patterns: Record<Need, RegExp> = {
  wellbeing: /anxious|anxiety|mental|wellbeing|well-being|health|isolat|depress|panic/i,
  housing: /hous|homeless|shelter|evict|sleep.*rough/i,
  money: /money|debt|financial|food|hardship|bills|cost of living/i,
  digital: /digital|computer|device|internet|online access/i,
  training: /train|skills|construction|building site|logistics|warehouse|\bcare\b|course|qualification/i,
  childcare: /childcare|child care|school hours|school-hours/i,
  confidence: /confidence/i,
  transport: /transport|travel|bus|cannot get to work|can't get to work/i,
  language: /english|language|interview/i,
  enterprise: /self.employ|business|enterprise/i,
};

export function parsePostcode(input: string): string | null {
  const match = input.toUpperCase().replace(/\s/g, '').match(/^AB([1-8])(?:\d[A-Z]{2})?$/);
  return match ? `AB${match[1]}` : null;
}
export function inferNeeds(text: string): Need[] {
  return (Object.keys(patterns) as Need[]).filter(need => patterns[need].test(text));
}
export function isRemote(service: Service): boolean {
  return /online|phone|hybrid|blended/i.test(service.delivery);
}
export function effectiveStatus(service: Service, referenceDate = '2026-10-05'): Service['status'] {
  if (service.status === 'Verified' && service.nextReview && service.nextReview < referenceDate) return 'Review due';
  return service.status;
}
function supports(service: Service, need: Need): boolean {
  const terms = `${service.category} ${service.needs.join(' ')}`;
  switch (need) {
    case 'wellbeing': return /health|wellbeing|anxiety|isolation/i.test(terms);
    case 'housing': return /housing/i.test(terms);
    case 'money': return /financial|debt|money/i.test(terms);
    case 'digital': return /digital|online access/i.test(terms);
    case 'training': return /skills|training|academy|employability/i.test(terms);
    // A school-hours training course is not childcare provision.
    case 'childcare': return /childcare support|childcare funding/i.test(terms);
    case 'confidence': return /confidence/i.test(terms);
    case 'transport': return /transport|travel|route planning/i.test(terms);
    case 'language': return /language|english/i.test(terms);
    case 'enterprise': return /self.employment|business/i.test(terms);
  }
}
function practicalMatch(service: Service, need: PracticalNeed): boolean {
  const text = service.accessibility.join(' ');
  return ({ 'step-free': /step.free/i, quiet: /quiet/i, captions: /captions/i, 'school-hours': /school.hours/i })[need].test(text);
}
export function findServices(services: Service[], query: SearchQuery): SearchResult {
  const postcode = parsePostcode(query.postcode);
  const needs = [...new Set([...inferNeeds(query.text), ...query.needs])];
  const urgent = /suicid|self.harm|homeless tonight|in danger|abuse|no food/i.test(query.text);
  if (!postcode) return { matches: [], farther: [], needs, unmetNeeds: needs, urgent };
  const lookup = postcodeLookup.find(row => row.Postcode_Prefix === postcode);
  const nearest = lookup?.Nearest_Service_IDs.split(';') ?? [];
  const matches: ServiceMatch[] = [];
  const farther: ServiceMatch[] = [];
  for (const service of services) {
    if (service.availability === 'Closed' || service.status === 'Expired') continue;
    // Hybrid and online delivery don't remove geographic coverage restrictions.
    if (!service.postcodePrefixes.includes(postcode) && !nearest.includes(service.id)) continue;
    if (query.providerType && service.providerType !== query.providerType) continue;
    const remote = isRemote(service);
    const onlineOnly = service.delivery === 'Online';
    if (onlineOnly && !query.includeRemote) continue;
    const matchedNeeds = needs.filter(need => supports(service, need));
    const haystack = `${service.name} ${service.category} ${service.needs.join(' ')} ${service.accessibility.join(' ')}`.toLowerCase();
    const words = query.text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !['need','want','help','with','work','support','looking'].includes(w));
    const textMatch = words.some(word => haystack.includes(word));
    if (needs.length ? !matchedNeeds.length : (query.text.trim().length > 0 && !textMatch)) continue;
    const missingPractical = query.practical.filter(need => !practicalMatch(service, need));
    // Missing accessibility data is unknown, not a confirmed match. Keep it
    // visible and label the missing check instead of silently excluding it.
    const reasons = matchedNeeds.map(need => needLabels[need]);
    if (!reasons.length) reasons.push(textMatch ? 'Matches your search' : 'Serves this demo area');
    const confirmedPractical = query.practical.filter(need => practicalMatch(service, need));
    reasons.push(...confirmedPractical.map(need => `${practicalLabels[need]} listed`));
    const status = effectiveStatus(service);
    const freshness = status === 'Verified' ? 12 : status === 'Review due' ? 3 : -12;
    const score = matchedNeeds.length * 30 + freshness + confirmedPractical.length * 5;
    const match = { service, score, matchedNeeds, reasons, missingPractical };
    if (service.distanceMiles <= query.radius || (query.includeRemote && remote)) matches.push(match);
    else farther.push(match);
  }
  const sort = (a: ServiceMatch, b: ServiceMatch) => b.score - a.score || a.service.distanceMiles - b.service.distanceMiles;
  matches.sort(sort); farther.sort(sort);
  const unmetNeeds = needs.filter(need => !matches.some(match => match.matchedNeeds.includes(need)));
  return { matches, farther, needs, unmetNeeds, urgent };
}
