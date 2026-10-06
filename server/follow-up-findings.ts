import { feedbackFields, type FeedbackField } from '../src/lib/feedback.ts';
import type { Summariser } from './finding-summary.ts';
/** `rewrite` marks a value that is still the person's own words and must be rewritten (or dropped) before it is offered. */
export interface Proposal {field:FeedbackField;value:string;quote:string;rewrite?:boolean;hedged?:boolean}
/** What a follow-up call reported about one service, in the shape gov-hack returns it. */
export interface CallFinding {
  name?:string;status?:string;confidence?:string;quote?:string;feedback?:string;
  operating?:{state?:string;confidence?:string;quote?:string};
  details?:{category?:string;said?:string;confidence?:string;quote?:string}[];
}
export interface ReportDraft {answers:{upToDate:'changed';availability?:'closed';issues:FeedbackField[]};note:string;proposal?:Proposal}
const detailFields:Record<string,FeedbackField>={address:'address',phone:'publicPhone',email:'publicEmail',times:'openingTimes',price:'cost'};
const operatingText:Record<string,string>={closed_permanently:'has closed permanently',closed_temporarily:'is temporarily closed',moved:'has moved'};
const capacityPattern=/\b(waiting list|backlog|wait(ing)?|waits?|full|booked|busy|stocks?|available|availability|spaces?|places?|slots?|appointments?|capacity|weeks?|months?|term)\b/i;
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
    // A doubtful detail is still offered, worded with its doubt; only a closure needs to be confidently stated.
    if (field && !proposal) proposal={field,value:clip(detail.said).slice(0,500),quote:clip(detail.quote),rewrite:true,hedged:detail.confidence!=='confirmed'};
    lines.push(`${detail.category==='other' || !field ? 'Detail' : `Changed ${detail.category}`}${detail.confidence==='hedged' ? ' (said with doubt)' : ''}: ${clip(detail.said)} - "${clip(detail.quote)}"`);
  }
  // A wait or a full list is a fact about the service, so it is reported as capacity. What the person did themselves is not kept.
  const candidates=[...(finding.details ?? []).filter(detail => detail?.category==='other' && detail.said && capacityPattern.test(detail.said)).map(detail => ({text:detail.said as string,quote:detail.quote,confirmed:detail.confidence==='confirmed'})),
    ...(finding.feedback && capacityPattern.test(finding.feedback) ? [{text:finding.feedback,quote:finding.quote,confirmed:finding.confidence==='confirmed'}] : [])];
  const capacity=candidates.find(item => item.confirmed) ?? candidates[0];
  if (capacity && !issues.has('capacity')) {
    issues.add('capacity');
    // The same words may already be listed as a detail; say them once.
    const said=clip(capacity.text);for (let i=lines.length-1;i>=0;i--) if (lines[i].startsWith('Detail') && lines[i].includes(said)) lines.splice(i,1);
    lines.push(`Capacity${capacity.confirmed ? '' : ' (said with doubt)'}: ${said}${capacity.quote ? ` - "${clip(capacity.quote)}"` : ''}`);
    if (!proposal) proposal={field:'capacity',value:said.slice(0,500),quote:clip(capacity.quote ?? said),rewrite:true,hedged:!capacity.confirmed};
  }
  if (!lines.length) return null;
  const note=`Reported on a follow-up call. ${lines.join(' ')}`.slice(0,1000);
  return {answers:{upToDate:'changed',...(availability ? {availability} : {}),issues:[...issues]},note,...(proposal ? {proposal} : {})};
}
/**
 * Replaces the person's own words in a proposal with a neutral statement about the service. The quote and note keep the exact words.
 * When no trustworthy rewrite is available the proposal is dropped, so staff review the report and word it themselves.
 */
export async function withSummary(draft:ReportDraft,service:string,summarise:Summariser,now=new Date()):Promise<ReportDraft> {
  const proposal=draft.proposal;if (!proposal?.rewrite) return draft;
  const {proposal:_raw,...rest}=draft;
  const summary=await summarise({field:proposal.field,label:feedbackFields[proposal.field],service,said:proposal.value,hedged:proposal.hedged});
  if (!summary) return rest;
  const value=proposal.field==='capacity' ? `${summary} (reported ${now.toISOString().slice(0,10)})` : summary;
  return {...rest,proposal:{field:proposal.field,value:value.slice(0,500),quote:proposal.quote}};
}
