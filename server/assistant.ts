import { resolve } from 'node:path';
import { discoverSupport } from './assistant-discovery.ts';
import { loadEnv } from 'vite';
import { searchDirectory } from './directory-search.ts';
import { feedbackFields } from '../src/lib/feedback.ts';
import { needMapping } from '../ingest/needs.ts';
import type { AssistantRequest, AssistantResult, AssistantSearch, AssistantCitation } from '../src/lib/assistant.ts';
import type { DirectoryRecord, DirectorySummary } from '../src/lib/directory.ts';
import { loadAssistantRecords, evidenceFor, duplicateCandidates, feedbackForAssistant, suggestionForAssistant, type AssistantRecord } from './assistant-catalogue.ts';
import { runModelAgent, validatedClaims, AgentUnavailable, type AgentConfig, type AgentTool } from './assistant-model.ts';
export class AssistantInputError extends Error {constructor(message:string,public status=400){super(message);}}
export function agentConfig():AgentConfig{const env=loadEnv('development',process.cwd(),'OPENAI_');return {apiKey:process.env.OPENAI_API_KEY||env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||env.OPENAI_MODEL||'gpt-4.1-mini'};}
export function validateAssistantRequest(value:unknown):AssistantRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AssistantInputError('Enter a request.');const input=value as Record<string,unknown>;
 if(!['search','service','suggestion','feedback','meeting','tags','guidance'].includes(String(input.task)))throw new AssistantInputError('Unknown assistance task.');
 const out:AssistantRequest={task:input.task as AssistantRequest['task']};
 for(const [key,max] of [['question',2000],['transcript',20000],['pageContext',20000],['serviceId',200],['suggestionId',200],['feedbackId',200]] as const){if(input[key]!==undefined){if(typeof input[key]!=='string'||(input[key] as string).length>max)throw new AssistantInputError(`Check the ${key}.`);out[key]=(input[key] as string).trim();}}
 if(['search','service','guidance'].includes(out.task)&&!out.question)throw new AssistantInputError('Enter a question.');
 if(['service','tags'].includes(out.task)&&!out.serviceId||out.task==='suggestion'&&!out.suggestionId||out.task==='feedback'&&!out.feedbackId||out.task==='meeting'&&!out.transcript)throw new AssistantInputError('Required details are missing.');
 if(out.task==='guidance'&&!out.pageContext)throw new AssistantInputError('Page context is required.');
 if(input.search!==undefined){if(!input.search||typeof input.search!=='object'||Array.isArray(input.search))throw new AssistantInputError('Check the search area.');const search=input.search as Record<string,unknown>;out.search={};for(const key of ['q','area','bounds','unknown'] as const){if(search[key]!==undefined){if(typeof search[key]!=='string'||(search[key] as string).length>250)throw new AssistantInputError('Check the search area.');(out.search as Record<string,unknown>)[key]=search[key];}}
  for(const key of ['lat','lng'] as const)if(search[key]!==undefined){if(typeof search[key]!=='number'||!Number.isFinite(search[key]))throw new AssistantInputError('Check the coordinates.');out.search[key]=search[key] as number;}
 }
 return out;
}
export function assistantSearchParams(search:AssistantSearch|undefined,query:string):URLSearchParams{
 const params=new URLSearchParams({q:query,mode:'semantic',page:'1'});for(const [key,value] of Object.entries(search??{}))if(key!=='q'&&value!==undefined)params.set(key,String(value));return params;
}
const list=(values:unknown[],max=8)=>values.filter((value):value is string=>typeof value==='string'&&value.trim().length>0).slice(0,max).map(value=>value.slice(0,600));
export async function assist(input:AssistantRequest,options:{directory?:string;config?:AgentConfig;signal?:AbortSignal;records?:AssistantRecord[];fetcher?:typeof fetch}={}):Promise<AssistantResult>{
 const directory=options.directory??resolve(process.cwd(),'data');const records=options.records??loadAssistantRecords(directory);const byId=new Map(records.map(record=>[record.id,record]));
 const evidence=new Map<string,AssistantCitation>();let services:DirectorySummary[]=[];let question=input.question??'';let reviewContext:unknown=null;
 const result:AssistantResult={mode:'local',summary:'',answer:'',needs:[],nextSteps:[],citations:[],services:[],warnings:[],proposedFields:{},suggestedTags:[],duplicates:[]};
 const addEvidence=(record:AssistantRecord)=>{const citation=evidenceFor(record,question);evidence.set(record.id,citation);return citation;};
 const query=async (words:string)=>{const found=await searchDirectory(records as DirectoryRecord[],assistantSearchParams(input.search,words.slice(0,250)));const picked=found.records.slice(0,6);for(const summary of picked){const record=byId.get(summary.id);if(record)addEvidence(record);}services=[...new Map([...services,...picked].map(record=>[record.id,record])).values()].slice(0,12);return {total:found.total,services:picked,evidence:picked.map(record=>evidence.get(record.id))};};
 if(input.task==='guidance'){
  evidence.set('workspace',{id:'workspace',name:'Current workspace',url:'',excerpt:input.pageContext!});result.summary='Workspace assistance';result.answer='AI assistance is unavailable. Please try again.';reviewContext={pageContext:input.pageContext};
 }else if(input.task==='service'||input.task==='tags'){
  const record=byId.get(input.serviceId!);if(!record)throw new AssistantInputError('Service not found.',404);addEvidence(record);result.summary=input.task==='tags'?`Suggested tags for ${record.name}`:`Question about ${record.name}`;
  if(input.task==='tags'){question='Suggest concise discoverability tags supported by the service evidence.';result.suggestedTags=[...(record.needs??[]),...(record.categories??[])].filter(tag=>typeof tag==='string'&&tag.length<=40).slice(0,8);}
  const terms=question.toLowerCase();
  const checks:[RegExp,string][]=[[/referr|self.?refer/,'referralRoute'],[/cost|free|pay|price/,'cost'],[/open|evening|weekend|hours|when/,'openingTimes'],[/eligib|who|child|age/,'eligibilitySummary'],[/phone|call/,'publicPhone'],[/email/,'publicEmail'],[/where|address/,'address'],[/access|wheelchair/,'accessibility']];
  const matched=checks.filter(([pattern])=>pattern.test(terms));result.answer=matched.length?matched.map(([,field])=>`${feedbackFields[field as keyof typeof feedbackFields]??field}: ${record[field]&&(!Array.isArray(record[field])||(record[field] as unknown[]).length)?Array.isArray(record[field])?(record[field] as unknown[]).join(', '):record[field]:'Not recorded'}`).join('\n'):'An answer to this specific question is not recorded in structured fields. The retained source excerpt is shown below.';
 if(input.task==='service'&&/explain|tell me|about|details|more information|what (is|does|can)/i.test(question)){
  const details=['eligibilitySummary','referralRoute','cost','openingTimes','address','publicPhone','publicEmail'].map(field=>`${feedbackFields[field as keyof typeof feedbackFields]??'How to access'}: ${record[field]||'Not recorded'}`);
  result.answer=[`${record.name} · ${record.provider}`,record.description||'Description: Not recorded',...details].join('\n\n');
 }
 if(input.task==='tags')result.answer='Suggested tags come from the recorded service categories and needs. Review them before adding.';
 }else if(input.task==='search'){
  await query(input.search?.q||question);result.summary='Support matching your request';result.answer=services.length?`Found ${services.length} relevant services to explore. Source details are listed below.`:'No matching services were found in this search area.';
 }else if(input.task==='suggestion'){
  const entry=suggestionForAssistant(directory,input.suggestionId!);if(!entry)throw new AssistantInputError('Suggestion not found.',404);question=entry.fields.name;reviewContext={fields:entry.fields,status:entry.status,sourceFetchStatus:entry.draft?.sourceFetchStatus};result.summary=`Review draft: ${entry.fields.name}`;const draft=(entry.draft??{...entry.fields,id:`suggestion:${entry.id}`,sourceUrl:entry.fields.website,searchText:entry.fields.description,name:entry.fields.name,provider:entry.fields.provider,description:entry.fields.description}) as AssistantRecord;addEvidence(draft);
  result.duplicates=duplicateCandidates(records,entry.fields);for(const candidate of result.duplicates)evidence.set(candidate.id,candidate);
  const missing=['postcode','openingTimes','cost','eligibilitySummary','referralRoute'].filter(field=>!draft[field]);result.warnings=[...(missing.length?[`Not recorded: ${missing.join(', ')}.`]:[]),...(entry.draft?.sourceFetchStatus?[String(entry.draft.sourceFetchStatus)]:['Prepare a draft to fetch website evidence.'])];
  result.answer=result.duplicates.length?`${result.duplicates.length} possible existing listings need comparison before publication.`:'No exact name, provider/website or provider/postcode duplicates were found. This does not rule out other duplicates.';
  result.nextSteps=['Compare possible duplicates and confirm the service is distinct.','Check contacts, eligibility, cost and opening times against the source.','Record evidence before publishing the draft.'];
 }else if(input.task==='feedback'){
  const entry=feedbackForAssistant(directory,input.feedbackId!);if(!entry)throw new AssistantInputError('Feedback report not found.',404);const record=byId.get(entry.serviceId);if(!record)throw new AssistantInputError('Service not found.',404);question=[...entry.answers.issues,entry.note].join(' ');addEvidence(record);reviewContext=entry;result.summary=`Review report: ${record.name}`;result.answer=`User reported: ${entry.answers.upToDate}. ${entry.note||'No further note supplied.'}`;result.warnings=['This report is unverified. No changes have been applied.'];result.nextSteps=entry.answers.issues.map(field=>`Check ${feedbackFields[field]} against current source or provider evidence.`);if(!result.nextSteps.length)result.nextSteps=['Check the report against the provider or source before resolving it.'];
 }else{
  question=input.transcript!;result.summary='Draft from the simulated meeting transcript';result.needs=Object.entries(needMapping).filter(([,pattern])=>pattern.test(question)).map(([need])=>need);await query(result.needs.join(' ')||question.slice(0,250));result.answer='Use these extracted topics and service options to prepare a meeting action plan.';result.nextSteps=['Agree which support needs to address first.','Review relevant services with the participant and save an agreed shortlist.'];result.warnings=['This summary uses the simulated transcript, not recorded speech.'];reviewContext={simulatedTranscript:question};
 }
 result.citations=[...evidence.values()];result.services=services;
 const config=options.config??agentConfig();if(!config.apiKey){result.warnings.push('OpenAI assistance is not connected; these are local directory checks.');return result;}
 const tools:AgentTool[]=[];
 if(input.task==='search'||input.task==='meeting')tools.push({name:'search_services',description:'Search real services inside the fixed user-selected geographic area. Use short search phrases. Cannot change geography.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},run:async args=>typeof args.query==='string'&&args.query.length<=250?query(args.query):{error:'Enter a short query.'}});
 tools.push({name:'read_service',description:'Read source evidence only for services already included in the selected search or review. No write access.',parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},run:async args=>typeof args.id==='string'&&evidence.has(args.id)?evidence.get(args.id):{error:'Service is outside this task evidence.'}});
 try{
  const answer=await runModelAgent(config,{task:input.task,question:input.task==='meeting'?'Summarise the simulated transcript and propose support needs and an action plan.':question,context:reviewContext,evidence:result.citations},tools,options.signal,options.fetcher);
  const claims=validatedClaims(answer,evidence);result.mode='openai';result.summary=input.task==='service'||input.task==='search'?result.summary:answer.summary.slice(0,600);result.answer=claims.length?claims.map(claim=>claim.text).join('\n'):'An evidence-backed answer to this question is not recorded in the available sources.';result.needs=input.task==='meeting'||input.task==='search'?answer.needs.filter((need):need is {need:string;quote:string}=>!!need&&typeof need==='object'&&typeof need.need==='string'&&typeof need.quote==='string'&&need.quote.trim().length>=3&&question.includes(need.quote)).slice(0,8).map(need=>need.need.slice(0,100)):list(answer.needs);result.nextSteps=list(answer.nextSteps);result.warnings=[...result.warnings,...list(answer.warnings)];result.services=services;
  const used=new Set(claims.map(claim=>claim.evidenceId));result.citations=[...evidence.values()].filter(item=>used.has(item.id));if(!claims.length)result.citations=[...evidence.values()].slice(0,6);
  if(input.task==='suggestion'){
   for(const proposal of answer.proposedFields){if(!proposal||typeof proposal.value!=='string'||proposal.value.length>2000||!['description','cost','openingTimes','eligibilitySummary','referralRoute','publicPhone','publicEmail','address','postcode','url'].includes(proposal.field))continue;const source=evidence.get(proposal.evidenceId);if(source&&typeof proposal.quote==='string'&&proposal.quote.length>=8&&source.excerpt.includes(proposal.quote)&&proposal.quote.includes(proposal.value))result.proposedFields![proposal.field]=proposal.value;}
   }
  if(input.task==='suggestion'||input.task==='tags')result.suggestedTags=list(answer.suggestedTags,10).map(tag=>tag.slice(0,40));
  if(input.task==='search'&&claims.length)result.summary=claims.slice(0,2).map(claim=>claim.text).join(' ').slice(0,450);
  if(claims.length!==answer.claims.length)result.warnings.push('Some generated claims were omitted because their source quotes could not be matched.');
 }catch(error){if(options.signal?.aborted)throw error;if(error instanceof AgentUnavailable)result.warnings.push(error.message);result.warnings.push(input.task==='guidance'?'AI assistance is temporarily unavailable. Please try again.':'OpenAI assistance is temporarily unavailable; showing local directory checks instead.');}
 if(input.task==='search'&&!result.services.length&&config.apiKey&&!options.signal?.aborted){
  try{result.discoveries=await discoverSupport(input.search?.q||question,input.search,{config,directory,records,signal:options.signal,fetcher:options.fetcher});if(result.discoveries.length){result.mode='openai';result.summary='No matches in the directory yet. Here are relevant services found on the web.';result.answer='These services have been sent to staff for review. Their details have not yet been checked.';}}catch{result.warnings.push('Web discovery could not complete. Try another search or suggest a service.');}
 }
 return result;
}
