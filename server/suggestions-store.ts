import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { needMapping } from '../ingest/needs.ts';
export type SuggestionFields={name:string;provider:string;description:string;website:string;phone:string;email:string;address:string;postcode:string;cost:string};
export type SuggestionEntry={id:string;status:'submitted'|'draft'|'published'|'rejected';createdAt:string;updatedAt:string;fields:SuggestionFields;draft:Record<string,unknown>|null;reviewNote:string|null;serviceId:string|null};
export class SuggestionError extends Error {constructor(message:string,public status=400){super(message);}}
export function validateSuggestion(value:unknown):SuggestionFields {
 if (!value || typeof value!=='object' || Array.isArray(value)) throw new SuggestionError('Enter service details.');const input=value as Record<string,unknown>;const out={} as SuggestionFields;
 for (const field of ['name','provider','description','website','phone','email','address','postcode','cost'] as const) {const value=input[field] ?? '';if (typeof value!=='string' || value.length>(field==='description'?20000:field==='address'?1000:500)) throw new SuggestionError(`Check the ${field}.`);out[field]=value.trim();}
 for (const field of ['name','provider','description'] as const) if (!out[field]) throw new SuggestionError('Enter the service name, provider and description.');
 if (!out.website && !out.phone && !out.email) throw new SuggestionError('Provide a website, phone number or email so staff can check the service.');
 if (out.website) {let url:URL;try {url=new URL(out.website);} catch {throw new SuggestionError('Enter a full website address beginning with https://.');}if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new SuggestionError('Enter a public http or https website address.');out.website=url.href;}
 if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new SuggestionError('Enter a valid email address.');
 if (out.phone && out.phone.replace(/\D/g,'').length<7) throw new SuggestionError('Enter a valid phone number.');
 if (out.postcode) {out.postcode=out.postcode.toUpperCase().replace(/\s+/g,'');if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(out.postcode)) throw new SuggestionError('Enter a full UK postcode.');out.postcode=out.postcode.slice(0,-3)+' '+out.postcode.slice(-3);}
 return out;
}
export class SuggestionsStore {
 private db:DatabaseSync;
 constructor(path:string,private cataloguePath?:string) {this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000');this.db.exec('CREATE TABLE IF NOT EXISTS suggestions(id TEXT PRIMARY KEY,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,entry_json TEXT NOT NULL)');}
 list():SuggestionEntry[] {return this.db.prepare('SELECT entry_json FROM suggestions ORDER BY created_at DESC').all().map(row=>JSON.parse(String(row.entry_json)));}
 get(id:string):SuggestionEntry {const row=this.db.prepare('SELECT entry_json FROM suggestions WHERE id=?').get(id);if (!row) throw new SuggestionError('Suggestion not found.',404);return JSON.parse(String(row.entry_json));}
 private write(entry:SuggestionEntry) {this.db.prepare('INSERT INTO suggestions VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,entry_json=excluded.entry_json').run(entry.id,entry.status,entry.createdAt,entry.updatedAt,JSON.stringify(entry));return entry;}
 submit(input:unknown) {const now=new Date().toISOString();return this.write({id:randomUUID(),status:'submitted',createdAt:now,updatedAt:now,fields:validateSuggestion(input),draft:null,reviewNote:null,serviceId:null});}
 enqueueDiscovery(fields:SuggestionFields,discovery:{query:string;area:string;sourceUrls:string[];scope?:string;coverageQuote?:string;providerType?:string;providerQuote?:string},website:{text:string;contacts:{phone?:string;email?:string}[];url:string;fetchedAt:string}) {
  const key=(value:string)=>{try{const url=new URL(value);url.hash='';url.search='';return url.href.replace(/\/$/,'').toLowerCase();}catch{return value.toLowerCase();}};
  const existing=this.list().find(entry=>key(entry.fields.website)===key(fields.website)&&entry.fields.name.toLowerCase()===fields.name.toLowerCase());
  if(existing)return ['submitted','draft'].includes(existing.status)?existing:null;
  const entry=this.submit(fields);this.prepare(entry.id);const enriched=this.enrich(entry.id,website);enriched.draft!.discovery=discovery;enriched.draft!.textProvenance={...(enriched.draft!.textProvenance as object),collectionMethod:'AI web discovery with public source page fetch; awaiting staff review'};enriched.draft!.raw={...(enriched.draft!.raw as object),discovery};return this.write(enriched);
 }
 prepare(id:string,input?:unknown) {
  const entry=this.get(id);if (!['submitted','draft'].includes(entry.status)) throw new SuggestionError('This suggestion has already been decided.');const fields=validateSuggestion(input ?? entry.fields);const serviceId=`community-suggested:${entry.id}`;
  const discovery=entry.draft?.discovery;
  const searchText=Object.entries(fields).filter(([,value])=>value).map(([key,value])=>`${key}: ${value}`).join('\n');
  entry.fields=fields;entry.draft={id:serviceId,name:fields.name,provider:fields.provider,description:fields.description,provisionType:null,categories:[],needs:Object.entries(needMapping).filter(([,regex])=>regex.test(searchText)).map(([need])=>need),scope:'local',postcode:fields.postcode||null,lat:null,lng:null,address:fields.address||null,delivery:null,eligibilitySummary:null,referralRoute:null,cost:fields.cost||null,accessibility:[],openingTimes:null,url:fields.website||null,publicPhone:fields.phone||null,publicEmail:fields.email||null,lastVerified:null,sourceUpdatedAt:null,vetting:'internal',source:'Community suggestion',sourceUrl:fields.website||'',fetchedAt:entry.createdAt,availability:'Available',searchText,contacts:[{phone:fields.phone||null,email:fields.email||null,source:'Community submission'}],textProvenance:{sourceUrl:fields.website||'',fetchedAt:entry.createdAt,fields:Object.keys(fields),collectionMethod:'User submission; website not fetched'},locations:[],sourceRecordIds:[serviceId],sourceRecordUrls:fields.website?[fields.website]:[],raw:{submission:fields,submittedAt:entry.createdAt},sourceFetchStatus:'Not fetched — check the website or contact the provider before publication.'};if(discovery){entry.draft.discovery=discovery;entry.draft.raw={...(entry.draft.raw as object),discovery};}entry.status='draft';entry.updatedAt=new Date().toISOString();return this.write(entry);
 }
 enrich(id:string,result:{text?:string;contacts?:{phone?:string;email?:string}[];url?:string;fetchedAt?:string;error?:string}) {
  const entry=this.get(id);if (entry.status!=='draft' || !entry.draft) throw new SuggestionError('Prepare a draft first.');
  if (result.error) entry.draft.sourceFetchStatus=`Website fetch failed: ${result.error} Check with the provider before publishing.`;
  else {entry.draft.searchText=`${entry.draft.searchText}\n\nWebsite content (${result.url}):\n${result.text}`;entry.draft.contacts=[...(entry.draft.contacts as unknown[]),...(result.contacts??[])];entry.draft.publicPhone=entry.draft.publicPhone||(result.contacts??[]).find(contact=>contact.phone)?.phone||null;entry.draft.publicEmail=entry.draft.publicEmail||(result.contacts??[]).find(contact=>contact.email)?.email||null;entry.draft.fetchedAt=result.fetchedAt;entry.draft.sourceFetchStatus='Website fetched. Content still needs staff checking.';entry.draft.textProvenance={sourceUrl:result.url,fetchedAt:result.fetchedAt,fields:['submission','website text','published website contacts'],collectionMethod:'Public website fetch and user submission'};entry.draft.raw={submission:entry.fields,websiteText:result.text,websiteContacts:result.contacts,fetchedUrl:result.url,fetchedAt:result.fetchedAt,...(entry.draft.discovery?{discovery:entry.draft.discovery}:{})};}
  entry.updatedAt=new Date().toISOString();return this.write(entry);
 }
 review(id:string,input:unknown) {
  const entry=this.get(id);if (entry.status==='published' || entry.status==='rejected') throw new SuggestionError('This suggestion has already been decided.');const body=input as {action?:unknown;verified?:unknown;note?:unknown};const note=typeof body?.note==='string'?body.note.trim():'';if (!note || note.length>4000) throw new SuggestionError('Record your evidence or reason (up to 4,000 characters).');
  if (body.action==='reject') {entry.status='rejected';entry.reviewNote=note;entry.updatedAt=new Date().toISOString();return this.write(entry);}
  if (body.action!=='publish' || entry.status!=='draft' || !entry.draft) throw new SuggestionError('Prepare a draft before publishing.');if (body.verified!==true) throw new SuggestionError('Check the source and confirm the evidence before publishing.');if (!this.cataloguePath) throw new SuggestionError('Catalogue is unavailable.',503);
  const record:Record<string,unknown>={...entry.draft,vetting:'public',staffReview:{checkedAt:new Date().toISOString(),evidence:note},raw:entry.draft.raw};const canonical={...record};delete (canonical as Record<string,unknown>).raw;
  this.db.prepare('ATTACH DATABASE ? AS catalogue').run(this.cataloguePath);
  try {this.db.exec('BEGIN IMMEDIATE');const id=String(record.id);const args=[id,'community-suggested',record.postcode as string|null,null,null,'public','Available'];this.db.prepare('INSERT INTO catalogue.services VALUES(?,?,?,?,?,?,?,?,?)').run(...args,JSON.stringify(record),String(record.searchText));this.db.prepare('INSERT INTO catalogue.catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(...args,JSON.stringify(canonical),String(record.searchText));for (const need of record.needs as string[]) this.db.prepare('INSERT INTO catalogue.service_needs VALUES(?,?)').run(id,need);entry.status='published';entry.serviceId=id;entry.reviewNote=note;entry.updatedAt=new Date().toISOString();this.write(entry);this.db.exec('COMMIT');return entry;} catch(error){this.db.exec('ROLLBACK');throw error;} finally {this.db.exec('DETACH DATABASE catalogue');}
 }
 close(){this.db.close();}
}
