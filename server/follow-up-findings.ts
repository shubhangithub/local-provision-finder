import type { FeedbackField } from '../src/lib/feedback.ts';
export interface Proposal {field:FeedbackField;value:string;quote:string}
/** What a follow-up call reported about one service, in the shape gov-hack returns it. */
export interface CallFinding {
  name?:string;status?:string;confidence?:string;quote?:string;feedback?:string;
  operating?:{state?:string;confidence?:string;quote?:string};
  details?:{category?:string;said?:string;confidence?:string;quote?:string}[];
}
export interface ReportDraft {answers:{upToDate:'changed';availability?:'closed';issues:FeedbackField[]};note:string;proposal?:Proposal}
const detailFields:Record<string,FeedbackField>={address:'address',phone:'publicPhone',email:'publicEmail',times:'openingTimes',price:'cost'};
const operatingText:Record<string,string>={closed_permanently:'has closed permanently',closed_temporarily:'is temporarily closed',moved:'has moved'};
const clip=(value:string)=>value.replace(/\s+/g,' ').trim();
/**
 * Turns a call's findings about a service into a pending-report draft. Nothing here changes a service:
 * the draft is a report for staff to check. Returns null when the person reported nothing about the service.
 */
export function reportFromFinding(finding:CallFinding,service:string):ReportDraft | null {
  const issues=new Set<FeedbackField>();const lines:string[]=[];let availability:'closed' | undefined;let proposal:Proposal | undefined;
  const state=finding.operating?.state;
  if (state && operatingText[state] && finding.operating?.quote) {
    if (state==='moved') issues.add('address'); else {availability='closed';issues.add('availability');}
    lines.push(`${service} ${operatingText[state]}${finding.operating.confidence==='hedged' ? ' (said with doubt)' : ''}: "${clip(finding.operating.quote)}"`);
    // Only a clearly stated closure is offered for one-click apply; a doubtful or hearsay one goes to full review.
    if (state!=='moved' && finding.operating.confidence==='confirmed') proposal={field:'availability',value:'Closed',quote:clip(finding.operating.quote)};
  }
  for (const detail of finding.details ?? []) {
    if (!detail?.said || !detail.quote) continue;
    const field=detailFields[String(detail.category)];if (field) issues.add(field);
    if (field && !proposal && detail.confidence==='confirmed') proposal={field,value:clip(detail.said).slice(0,500),quote:clip(detail.quote)};
    lines.push(`${detail.category==='other' || !field ? 'Detail' : `Changed ${detail.category}`}${detail.confidence==='hedged' ? ' (said with doubt)' : ''}: ${clip(detail.said)} - "${clip(detail.quote)}"`);
  }
  if (!lines.length) return null;
  const note=`Reported on a follow-up call (sandbox demo). ${lines.join(' ')}`.slice(0,1000);
  return {answers:{upToDate:'changed',...(availability ? {availability} : {}),issues:[...issues]},note,...(proposal ? {proposal} : {})};
}
