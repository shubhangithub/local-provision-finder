export interface AgentContext { title: string; facts: string[]; searchText?: string; prompts?: string[]; serviceId?: string; area?: string }
export interface AgentRequest { context?: AgentContext; question?: string }
export const agentEvent = 'directory-agent-request';
export function askAgent(request: AgentRequest = {}) { window.dispatchEvent(new CustomEvent<AgentRequest>(agentEvent, { detail: request })); }
export function agentPageContext(route: string, staff: boolean): AgentContext {
  if (route === '/meeting/summary') return {title:'Customer meeting summary',facts:['Check that the summary reflects the conversation and includes only provision discussed with the customer.','Make each next step clear: what to do, who will do it and when.','Edit the document before downloading it as PDF, DOCX or PNG.'],prompts:['Check this customer summary','Find provision for this customer','What makes a useful next step?']};
  if (route === '/meeting') return {title:'Customer meeting',facts:['Use customer statements to identify needs and practical preferences.','The AI assist panel suggests directory provision and questions to explore.','Add suitable provision to the summary; check eligibility, area and availability first.'],prompts:['What should I ask next?','Find relevant provision','How do I prepare the customer summary?']};
  if (route === '/review' || route === '/feedback') return {title:'Review workspace',facts:['Check the proposed detail against the provider or original source.','Publish only independently checked changes. Hold unresolved changes for further checking.','Record what was checked and the evidence supporting the decision.'],prompts:['What needs checking?','When should I hold a change?','What evidence should I record?']};
  if (route === '/saved') return {title:'Saved provision',facts:['Compare saved services for eligibility, area, current availability and practical access.','Check provider details before recommending a service.'],prompts:['Compare my saved provision','Find alternatives','What should I check before a referral?']};
  if (route.startsWith('/directory/') || route.startsWith('/service/')) return {title:'Service details',facts:['Check eligibility, location, opening times, cost and referral requirements.','A source date does not confirm that places are available today.'],prompts:['Explain this service','What details need checking?','Find similar provision']};
  if (route === '/imports') return {title:'Imported directory',facts:['Use the original source and published contacts to check imported details.','Confirm missing information before approval.'],prompts:['What needs checking?','Find relevant provision','How do I check an imported record?']};
  return {title:staff ? 'Staff workspace' : 'Find support',facts:['Describe the help needed in everyday words to find matching directory provision.','Check the area, eligibility and availability of each service before taking the next step.'],prompts:staff ? ['Find provision for a customer','What should I check before a referral?','Help me with a meeting'] : ['Help me find support','What should I check before contacting a service?','How do I save a service?']};
}
export function contextReply(question: string, context: AgentContext): string | null {
  if (/what.*next step|useful next step|improve.*next step/i.test(question)) return 'A useful next step says what will happen, who will do it and when. For example: “Customer to call the chosen provider by Tuesday to check availability.” Use a date and action agreed in the meeting.';
  if (/what.*evidence|record.*evidence/i.test(question)) return 'Record the specific field checked, the provider or source, the date of the check, and what the evidence confirmed. Keep unresolved details for further checking.';
  if (/when.*hold|hold.*change/i.test(question)) return 'Hold a change when sources disagree, required details are missing, or you cannot confirm the proposal with the provider or original source. Record the unresolved question and the evidence still needed.';
  if (/how.*save.*service/i.test(question)) return 'Use the bookmark beside a service to add it to Saved. Open Saved to compare provision or remove a service from your shortlist.';
  if (/prepare.*summary|help.*meeting/i.test(question)) return 'Start a customer meeting from the staff workspace. Capture customer needs, add suitable provision from AI assist, then stop the recording and select Produce customer summary. Review and edit the document before exporting it.';
  if (/how.*(pdf|docx|png)|export|download/i.test(question)) return 'Use Save as PDF, Save as DOCX or Save as PNG on the customer summary page. The download includes the current edited document.';
  if (/summary|summari[sz]e|shorten|rewrite|next steps/i.test(question) && context.title==='Customer meeting summary' && !/find|search|provision/i.test(question)) return context.facts.join('\n\n');
  if (/what.*ask next/i.test(question)) return 'Ask which need matters most right now, what the customer has already tried, and what could make support easier to access. Check preferred days, travel, childcare and accessibility before choosing provision.';
  if (/check|explain|compare|review|imported record|help me/i.test(question) && !/find|search|alternative|similar/i.test(question)) return context.facts.join('\n\n');
  return null;
}

export function summaryAgentChecks(document: import('./meeting').CustomerDocument): string[] {
  const checks:string[]=[];
  if(!document.customer.trim())checks.push('Add the customer’s name.');
  if(!document.date.trim())checks.push('Add the meeting date.');
  if(!document.summary.trim() || /^Add a summary/i.test(document.summary))checks.push('Complete the summary of what was discussed.');
  if(!document.provisions.trim() || /^No services have been added/i.test(document.provisions))checks.push('Confirm whether any provision should be included.');
  if(!document.nextSteps.trim())checks.push('Add the next steps agreed with the customer.');
  else if(!/\b(by|before|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next (week|month)|\d{1,2}[/.]\d{1,2})\b/i.test(document.nextSteps))checks.push('Give each next step an owner and a target date.');
  return checks;
}
export function summaryAgentContext(document: import('./meeting').CustomerDocument): AgentContext {
  const checks=summaryAgentChecks(document);
  return {title:'Customer meeting summary',facts:[checks.length ? `Before sharing:\n${checks.map(check=>`• ${check}`).join('\n')}` : 'The summary includes a customer name, meeting date and next steps. Review the wording with the customer before sharing.',`Current summary:\n${document.summary}`,`Provision included:\n${document.provisions}`,`Next steps:\n${document.nextSteps}`],searchText:document.summary,prompts:['Check this customer summary','Find provision for this customer','What makes a useful next step?']};
}
