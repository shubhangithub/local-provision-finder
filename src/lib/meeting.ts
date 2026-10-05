import { inferNeeds, needLabels } from './search';
import type { Need } from '../types';
import type { DirectorySummary } from './directory';
export interface MeetingTurn { speaker: 'Advisor' | 'Customer'; text: string }
export interface MeetingProvision extends DirectorySummary { reason: string }
export interface CustomerDocument { title: string; customer: string; date: string; summary: string; provisions: string; nextSteps: string }
export function meetingNeeds(text: string): Need[] {
  return [...new Set([...inferNeeds(text).filter(need => need !== 'language' || /english|language/i.test(text)), ...(/interview|getting.*work|back.*work/i.test(text) ? ['training' as Need] : []), ...(/bus fare|travel cost/i.test(text) ? ['transport' as Need] : []), ...(/childcare|after school/i.test(text) ? ['childcare' as Need] : [])])];
}
export const meetingPrompts: Partial<Record<Need,string>> = {
  wellbeing: 'Would a quiet group or one-to-one support feel easier to start with?',
  confidence: 'What would make interviews feel more manageable?', training: 'Would interview practice or help finding opportunities be most useful?',
  childcare: 'Which days and hours do you need childcare, and what are the children’s ages?', transport: 'Where do you need to travel, and what would make the journey affordable?',
  money: 'Is there an immediate cost or bill you need help with?', housing: 'Do you need help with your current accommodation or finding somewhere to live?',
  digital: 'Do you have a device and internet access?', language: 'Would support in another language be helpful?', enterprise: 'What kind of business are you hoping to start?',
};
export function createCustomerDocument(turns: MeetingTurn[], provisions: MeetingProvision[]): CustomerDocument {
  const customer = turns.filter(turn => turn.speaker === 'Customer').map(turn => turn.text);
  const needs = meetingNeeds(customer.join(' '));
  return {
    title: 'Your meeting summary', customer: '', date: new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'}),
    summary: customer.length ? `${needs.length ? `We discussed support with ${needs.map(need=>needLabels[need].toLowerCase()).join(', ')}.\n\n` : ''}Your priorities, in your own words:\n${customer.map(text => `“${text}”`).join('\n\n')}` : 'Add a summary of what you discussed with your advisor.',
    provisions: provisions.length ? provisions.map(provision => `${provision.name}\n${provision.provider}${provision.postcode ? ` · ${provision.postcode}` : ''}\n${provision.reason}`).join('\n\n') : 'No services have been added yet. Add any provision discussed with your advisor.',
    nextSteps: [ ...provisions.map(provision => `Contact ${provision.name} to check eligibility, current availability and how to access support.`), ...needs.map(need => `Discuss your ${needLabels[need].toLowerCase()} needs with your advisor and decide on a practical next step.`), 'Agree a follow-up date with your advisor.' ].map((text,index) => `${index+1}. ${text}`).join('\n'),
  };
}
