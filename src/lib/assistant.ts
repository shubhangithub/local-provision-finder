import type { DirectorySummary } from './directory';
export type AssistantTask='search'|'service'|'suggestion'|'feedback'|'meeting'|'tags'|'guidance';
export interface AssistantSearch {q?:string;area?:string;lat?:number;lng?:number;bounds?:string;unknown?:'0'|'1';urgency?:'today'|'normal'}
export interface AssistantRequest {task:AssistantTask;question?:string;search?:AssistantSearch;serviceId?:string;suggestionId?:string;feedbackId?:string;transcript?:string;pageContext?:string}
export interface AssistantCitation {id:string;name:string;url:string;excerpt:string}
export interface AssistantResult {mode:'openai'|'local';summary:string;answer:string;needs:string[];nextSteps:string[];citations:AssistantCitation[];services:DirectorySummary[];warnings:string[];proposedFields?:Record<string,string>;suggestedTags?:string[];duplicates?:AssistantCitation[]}
export async function askAssistant(input:AssistantRequest,signal?:AbortSignal):Promise<AssistantResult> {
 const staff=['suggestion','feedback','meeting','tags'].includes(input.task);
 const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',...(staff?{'X-Staff-Demo':'true'}:{})},body:JSON.stringify(input),signal});
 const data=await response.json();if(!response.ok)throw new Error(data.error || 'Assistance is unavailable. Please try again.');return data;
}
