import { resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { directoryAreas, distanceMiles } from '../src/lib/directory.ts';
import type { AssistantDiscovery, AssistantSearch } from '../src/lib/assistant.ts';
import { safeSourceUrl, duplicateCandidates, type AssistantRecord } from './assistant-catalogue.ts';
import type { AgentConfig } from './assistant-model.ts';
import { fetchSuggestionWebsite } from './suggestions-fetch.ts';
import { SuggestionsStore } from './suggestions-store.ts';
interface Candidate {name:string;provider:string;description:string;url:string;quote:string;providerType:'public'|'charity'|'community'|'commercial'|'unknown';providerQuote:string;scope:'local'|'national'|'unclear';coverageQuote:string}
export function discoveryArea(search:AssistantSearch|undefined):string{
 if(search?.area)return search.area;
 let origin: {lat:number;lng:number}|undefined;if(search?.lat!==undefined&&search.lng!==undefined)origin={lat:search.lat,lng:search.lng};
 if(search?.bounds){const [west,south,east,north]=search.bounds.split(',').map(Number);if([west,south,east,north].every(Number.isFinite))origin={lat:(south+north)/2,lng:(west+east)/2};}
 return origin?[...directoryAreas].sort((a,b)=>distanceMiles(origin!,a)-distanceMiles(origin!,b))[0].label:'United Kingdom';
}
const candidateSchema={type:'object',properties:{...Object.fromEntries(['name','provider','description','url','quote','providerQuote','coverageQuote'].map(field=>[field,{type:'string'}])),providerType:{type:'string',enum:['public','charity','community','commercial','unknown']},scope:{type:'string',enum:['local','national','unclear']}},required:['name','provider','description','url','quote','providerType','providerQuote','scope','coverageQuote'],additionalProperties:false};
export function discoveryInstructions():string {return readFileSync(resolve(process.cwd(),'docs/discovery-agent-guidelines.md'),'utf8');}
function allowsCommercial(question:string):boolean {return /\b(?:private|paid|fee[- ]paying)\b/i.test(question)&&! /\b(?:not|no|avoid|dont want|do not want)\b.{0,20}\b(?:private|paid)\b/i.test(question.replace(/[’']/g,''));}
export function acceptableDiscovery(candidate:Candidate,body:string,question:string,area:string):boolean {
 const providerPatterns={public:/\b(?:nhs|council|local authority|public service|government)\b/i,charity:/\b(?:charity|charitable organisation|charitable organization|not[- ]for[- ]profit|cic|community interest company)\b/i,community:/\b(?:community|voluntary|volunteer|support group)\b/i,commercial:/\b(?:private|commercial|paid|fees|prices|clinic)\b/i};
 if(!['public','charity','community','commercial'].includes(candidate.providerType)||candidate.providerQuote.trim().length<(candidate.providerType==='public'?3:8)||!body.includes(normalize(candidate.providerQuote)))return false;
 if(!providerPatterns[candidate.providerType as keyof typeof providerPatterns].test(candidate.providerQuote))return false;
 if(candidate.providerType==='commercial'&&!allowsCommercial(question))return false;
 if(!allowsCommercial(question)&&/\b(?:private (?:clinic|hospital|practice)|premium (?:treatment|therapy)|cosmetic (?:clinic|surgery)|paid diagnostic)\b/i.test([candidate.name,candidate.provider,candidate.quote].join(' ')))return false;
 if(!['local','national','unclear'].includes(candidate.scope))return false;
 if(candidate.scope==='unclear')return true;
 if(candidate.coverageQuote.trim().length<8||!body.includes(normalize(candidate.coverageQuote)))return false;
 if(candidate.scope==='national')return /\b(?:uk|united kingdom|nationwide|england|nationally|throughout|across the country|across britain)\b/i.test(candidate.coverageQuote);
 const place=normalize(area).replace(' upon thames','');
 return place!=='united kingdom'&&normalize(candidate.coverageQuote).includes(place);
}

export function sourceIdentity(value:string):string{try{const url=new URL(value);for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['gclid','fbclid'].includes(key))url.searchParams.delete(key);url.hash='';return url.href.replace(/\/$/,'');}catch{return '';}}
const normalize=(value:string)=>value.toLowerCase().replace(/\s+/g,' ').trim();
export async function discoverSupport(question:string,search:AssistantSearch|undefined,options:{config:AgentConfig;directory:string;records:AssistantRecord[];signal?:AbortSignal;fetcher?:typeof fetch;websiteFetcher?:typeof fetchSuggestionWebsite}):Promise<AssistantDiscovery[]>{
 if(!options.config.apiKey||question.trim().length<4)return [];
 const area=discoveryArea(search);const fetcher=options.fetcher??fetch;
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.config.apiKey}`},signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000),body:JSON.stringify({model:options.config.model??'gpt-4.1-mini',store:false,max_output_tokens:2200,max_tool_calls:3,tools:[{type:'web_search',search_context_size:'low'}],tool_choice:'required',include:['web_search_call.action.sources'],instructions:discoveryInstructions(),input:`Need: ${question.slice(0,250)}. Area: ${area}. ${allowsCommercial(question)?'The user explicitly requested private or paid provision.':'Search NHS, council, registered charity and voluntary support pages first. Exclude private clinics, paid home care and commercial suppliers. Use public or charitable access/advice routes if no direct local service is found.'} Search separately for relevant local support and national charity/helpline help. Return no more than two practical candidates. Provider and coverage quotes must be actual explanatory text from the source, not just an organisation name or country name. Do not add quotation marks around excerpts.`,text:{format:{type:'json_schema',name:'discovered_services',strict:true,schema:{type:'object',properties:{candidates:{type:'array',items:candidateSchema,maxItems:2}},required:['candidates'],additionalProperties:false}}}})});
 if(!response.ok)throw new Error('Web discovery is unavailable.');
 const data=await response.json() as {output?:{type:string;action?:{sources?:{url?:string}[]};content?:{type:string;text?:string;annotations?:{type:string;url?:string}[]}[]}[]};
 const sources=new Set<string>();for(const item of data.output??[]){for(const source of item.action?.sources??[]){const url=safeSourceUrl(source.url);if(url)sources.add(sourceIdentity(url));}for(const content of item.content??[])for(const annotation of content.annotations??[]){const url=safeSourceUrl(annotation.url);if(annotation.type==='url_citation'&&url)sources.add(sourceIdentity(url));}}
 const text=(data.output??[]).flatMap(item=>item.content??[]).filter(item=>item.type==='output_text').map(item=>item.text??'').join('');let candidates:Candidate[];try{const parsed=JSON.parse(text);candidates=Array.isArray(parsed.candidates)?parsed.candidates:[];}catch{return [];}
 const output:AssistantDiscovery[]=[];mkdirSync(options.directory,{recursive:true});const store=new SuggestionsStore(resolve(options.directory,'suggestions.sqlite'));
 try{for(const candidate of candidates.slice(0,6)){
  if(output.length>=2)break;
  if(options.signal?.aborted)break;
  if(!candidate||['name','provider','description','url','quote','providerType','providerQuote','scope','coverageQuote'].some(field=>typeof candidate[field as keyof Candidate]!=='string'))continue;
  const url=safeSourceUrl(candidate.url);if(!url.startsWith('https:')||!sources.has(sourceIdentity(url))||candidate.name.length>200||candidate.provider.length>200||candidate.quote.length<15)continue;
  if(duplicateCandidates(options.records,{name:candidate.name,provider:candidate.provider,website:url}).length)continue;
  try{const website=await (options.websiteFetcher??fetchSuggestionWebsite)(url);const body=normalize(website.text);const quote=normalize(candidate.quote);if(!acceptableDiscovery(candidate,body,question,area)||!body.includes(quote)||(!body.includes(normalize(candidate.name))&&!body.includes(normalize(candidate.provider))))continue;
   if(options.signal?.aborted)break;
   // Public preview is an exact source excerpt, rather than an unchecked model paraphrase.
   const fields={name:candidate.name,provider:candidate.provider,description:candidate.quote.slice(0,1200),website:url,phone:'',email:'',address:'',postcode:'',cost:''};
   const entry=store.enqueueDiscovery(fields,{query:question.slice(0,250),area,sourceUrls:[url],providerType:candidate.providerType,providerQuote:candidate.providerQuote,scope:candidate.scope,coverageQuote:candidate.coverageQuote},website);if(entry)output.push({suggestionId:entry.id,name:entry.fields.name,provider:entry.fields.provider,description:entry.fields.description,url:entry.fields.website,postcode:entry.fields.postcode||null,reviewStatus:'pending',scope:candidate.scope,providerType:candidate.providerType});
  }catch{/* No fetchable, attributable evidence means no fabricated fallback card. */}
 }}finally{store.close();}
 return output;
}
