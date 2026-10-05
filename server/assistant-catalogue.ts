import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FeedbackStore } from './feedback-store.ts';
import { TagsStore } from './tags-store.ts';
import { SuggestionsStore } from './suggestions-store.ts';
import type { DirectoryRecord } from '../src/lib/directory.ts';
import type { AssistantCitation } from '../src/lib/assistant.ts';
export type AssistantRecord=DirectoryRecord & Record<string,unknown>;
export function loadAssistantRecords(directory:string):AssistantRecord[] {
 const path=resolve(directory,'services.sqlite');if(!existsSync(path))return [];
 const db=new DatabaseSync(path,{readOnly:true});db.exec('PRAGMA busy_timeout=5000');
 const feedback=existsSync(resolve(directory,'feedback.sqlite'))?new FeedbackStore(resolve(directory,'feedback.sqlite')):null;
 const tags=existsSync(resolve(directory,'tags.sqlite'))?new TagsStore(resolve(directory,'tags.sqlite')):null;
 try{return db.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source'").all().map(row=>{
  const record=JSON.parse(String(row.record_json)) as AssistantRecord;const updated=feedback?.corrected(record)??record;const serviceTags=tags?.get(record.id)??[];
  return {...updated,tags:serviceTags,searchText:serviceTags.length?`Tags: ${serviceTags.join(', ')}\n${updated.searchText}`:updated.searchText};
 });}finally{db.close();feedback?.close();tags?.close();}
}
export function suggestionForAssistant(directory:string,id:string){
 const path=resolve(directory,'suggestions.sqlite');if(!existsSync(path))return null;const store=new SuggestionsStore(path);try{return store.get(id);}catch{return null;}finally{store.close();}
}
export function feedbackForAssistant(directory:string,id:string){
 const path=resolve(directory,'feedback.sqlite');if(!existsSync(path))return null;const store=new FeedbackStore(path);try{return store.get(id);}finally{store.close();}
}
export function safeSourceUrl(value:unknown):string {try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
export function evidenceFor(record:AssistantRecord,question:string):AssistantCitation {
 const terms=question.toLowerCase().match(/[a-z]{3,}/g)??[];
 // Keep the checked structured values first; retained text may include superseded source facts.
 const facts=Object.fromEntries(['name','provider','description','postcode','address','cost','openingTimes','eligibilitySummary','referralRoute','publicPhone','publicEmail','url','availability','lastVerified','sourceUpdatedAt','fieldCheckedAt','needs','tags'].map(key=>[key,record[key]??null]));
 const chunks=record.searchText.split(/\n\n+/).map((text,index)=>({text,index,score:terms.reduce((sum,term)=>sum+(text.toLowerCase().includes(term)?1:0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const retained=chunks.slice(0,3).map(chunk=>chunk.text.slice(0,1200)).join('\n\n');
 return {id:record.id,name:record.name,url:safeSourceUrl(record.sourceUrl??record.url),excerpt:`Current listed fields:\n${JSON.stringify(facts)}\nRetained source text (may include older facts):\n${retained}`.slice(0,6500)};
}
export function duplicateCandidates(records:AssistantRecord[],fields:Record<string,string>):AssistantCitation[]{
 const normal=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');const name=normal(fields.name??'');const provider=normal(fields.provider??'');const website=safeSourceUrl(fields.website);const postcode=normal(fields.postcode??'');
 const hostname=(url:string)=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}};
 return records.filter(record=>{
  const exactName=!!name&&normal(record.name)===name;
  const sameProvider=!!provider&&normal(record.provider)===provider;
  const sameSite=!!website&&hostname(website)===hostname(safeSourceUrl(record.url));
  return exactName || sameProvider&&sameSite || !!postcode&&normal(record.postcode??'')===postcode&&sameProvider;
 }).slice(0,5).map(record=>evidenceFor(record,fields.name??''));
}
