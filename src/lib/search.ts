import type { Need, PracticalNeed, Service } from '../types';

export const needLabels: Record<Need, string> = {
  wellbeing: 'Health & wellbeing', housing: 'Housing', money: 'Money & debt',
  digital: 'Digital skills', training: 'Skills & training', childcare: 'Childcare',
  confidence: 'Confidence', transport: 'Travel support', language: 'English & language',
  enterprise: 'Self-employment',
};
export const practicalLabels: Record<PracticalNeed, string> = {
  'step-free': 'Step-free access', quiet: 'Quiet setting', captions: 'Captions', 'school-hours': 'School hours',
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
