import { needMapping } from './needs.ts';
export type ServiceRecord = {
 id:string; name:string; description:string; provider:string; provisionType:string|null;
 categories:string[]; needs:string[]; scope:'local'|'national'|'online'; postcode:string|null;
 lat:number|null; lng:number|null; address:string|null; delivery:string|null;
 eligibilitySummary:string|null; referralRoute:string|null; cost:string|null; accessibility:string[];
 openingTimes:string|null; url:string|null; publicPhone:string|null; publicEmail:string|null;
 lastVerified:string|null; sourceUpdatedAt:string|null; verificationStatus:'Verified'|'Review due'|'Potentially outdated';
 confidence:number; vetting:'public'|'internal'; source:string; sourceUrl:string; fetchedAt:string;
 searchText:string; contacts:unknown[]; textProvenance:{sourceUrl:string;fetchedAt:string;fields:string[]};
 availability:'Available'|'Removed at source'; raw:unknown;
};
export function safeEmail(value:unknown):string|null {
 if(typeof value!=='string')return null;
 return /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(value) && !/noemail\.invalid|example\./i.test(value) ? value : null;
}
export function safePhone(value:unknown):string|null {
 if(typeof value!=='string')return null;
 return value.replace(/\D/g,'').length>=7?value:null;
}
// Service contacts are explicitly published for access to support. Preserve them,
// including named professional contacts and mobile numbers. Exclude private audit metadata.
export function sanitise(value:any):any {
 if(Array.isArray(value))return value.map(sanitise);
 if(value && typeof value==='object') {
  const out:any={};
  for(const [key,v] of Object.entries(value)) {
   if(/^(assurer_email|assured_by|user_id|username|password|token|access_token|api_key|secret|created_by|updated_by)$/i.test(key))continue;
   out[key]=sanitise(v);
  } return out;
 }
 return value;
}
export const plain=(v:any):string=>typeof v==='string'?v.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>{const c=Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&#x([a-f0-9]+);/gi,(_,n)=>{const c=parseInt(n,16);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim():'';
export function iso(value:any):string|null { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(value))return null;const d=new Date(value);return Number.isNaN(+d)?null:d.toISOString(); }
export function trust(date:string|null,now:Date){
 const age=date?(+now-+new Date(date))/86400000:null;
 if(age===null||age<0)return {verificationStatus:'Potentially outdated' as const,confidence:40};
 const cutoff=(months:number)=>{const d=new Date(now);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);const lastDay=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,lastDay));return d;};
 const six=cutoff(6),year=cutoff(12);
 return {verificationStatus:date!>=six.toISOString()?'Verified' as const:date!>=year.toISOString()?'Review due' as const:'Potentially outdated' as const,confidence:Math.max(30,Math.round(90-age*60/730))};
}
export function normalise(input:any,source:any,fetchedAt:string,evaluatedAt=new Date()):ServiceRecord {
 const r=sanitise(input);if(!r.id||!r.name)throw new Error('Service requires source id and name');
 const ck=source.sourceId==='kingston-ck';const bucks=source.kind==='bucks';
 const locations=(r.service_at_locations??[]).map((x:any)=>x.location).filter(Boolean);
 const loc=locations[0]??r.locations?.[0]??{};const addr=loc.physical_addresses?.[0]??loc.addresses?.find((a:any)=>a.address_type==='physical')??loc.addresses?.[0]??loc.address??(ck||bucks?loc:{});
 const categories=[...new Set<string>((ck?r.category_taxonomies??[]:r.service_taxonomy??r.taxonomy_terms??r.taxonomies??[]).map((x:any)=>x.taxonomy_term?.name??x.taxonomy?.name??x.name).filter(Boolean))];
 const description=plain(r.description??r.intro);const text=[r.name,description,...categories].join(' ');
 const assured=iso(r.assured_date??r.pc_metadata?.date_assured);const updated=iso(r.last_modified??r.last_modified_at??r.updated_at??r.pc_metadata?.date_modified);
 const attending=Array.isArray(r.attending_type)?r.attending_type:typeof r.attending_type==='string'?[r.attending_type]:[];
 const locationDelivery=loc.location_type==='physical'?'In person':loc.location_type==='virtual'?'Online':null;
 const delivery=attending.some((t:string)=>/online|phone|telephone/i.test(t))?(attending.some((t:string)=>/venue|person|home visit/i.test(t))?'Hybrid':'Online'):attending.some((t:string)=>/venue|person|home visit/i.test(t))?'In person':locationDelivery??(bucks&&locations.length?'In person':null);
 const costOptions=(r.cost_options??[]).map((c:any)=>`${c.option??'Cost'}: ${c.amount===0?'Free':(typeof c.amount==='number'||typeof c.amount==='string'&&/^\d+(\.\d+)?$/.test(c.amount))?`£${c.amount}${c.cost_type?` ${c.cost_type}`:''}`:c.description??'Not supplied'}`).join('; ');
 const schedules=[...(r.regular_schedules??[]),...(r.service_at_locations??[]).flatMap((x:any)=>x.regular_schedule??[])].map((x:any)=>plain(x.description)).filter(Boolean);
 const latitude=loc.latitude??loc.lat??loc.geometry?.coordinates?.[1];const longitude=loc.longitude??loc.lon??loc.geometry?.coordinates?.[0];
 const ckHours=(r.service_at_locations??[]).flatMap((x:any)=>x.regular_opening_hours??[]).map((h:any)=>`${h.frequency??'Schedule'}; weekday ${h.weekday??'not supplied'}: ${h.opens_at??'not supplied'}–${h.closes_at??'not supplied'}`);
 const ckEligibility=ck?[...Object.entries(r.eligibility_types?.custom??{}).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>`${k.replaceAll('_',' ')}: ${plain(v)}`),...(r.eligibility_types?.taxonomies??[]).map((t:any)=>plain(t.name)).filter(Boolean)].join('; '):'';
 const geoValid=Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180&&!(latitude===0&&longitude===0);
 const phones=[...(r.phones??[]),...(r.contacts??[]).flatMap((c:any)=>c.phones??[])];
 const dates=trust(assured,evaluatedAt);
 const sourceUrl=`${source.baseUrl}/services/${encodeURIComponent(r.id)}`;
 const textFields=['name','description','intro','organization','organisation','eligibility','eligibility_types','pc_targetAudience','application_process','fees','fees_text','schedule','schedules','service_at_locations','locations','useful_infos','offerings','category_taxonomies','service_taxonomy','taxonomy_terms','accessibility','contacts','contact_name','contact_phone','contact_email'];
 const collect=(v:any):string=>Array.isArray(v)?v.map(collect).join(' '):v&&typeof v==='object'?Object.entries(v).filter(([k])=>!/^id$|_id$|^slug$|^uri$/.test(k)).map(([,x])=>collect(x)).join(' '):plain(typeof v==='number'||typeof v==='boolean'?String(v):v);
 const present=[...new Set([...textFields,...Object.keys(r)])].filter(k=>r[k]!=null&&!k.startsWith('_source')); 
 const contacts=[...(ck&&r.organisation&&(r.organisation.phone||r.organisation.email)?[{name:r.organisation.name,phone:r.organisation.phone??null,email:r.organisation.email??null,sourceUrl:r._relatedProvenance?.organisation?.sourceUrl,fetchedAt:r._relatedProvenance?.organisation?.fetchedAt}]:[]),...(r.contacts??[]).map((c:any)=>({...c,sourceUrl,fetchedAt})),...(ck&&(r.contact_phone||r.contact_email||r.contact_name)?[{name:r.contact_name??null,phone:r.contact_phone??null,email:r.contact_email??null,sourceUrl,fetchedAt}]:[])];
 return {searchText:present.map(k=>`${k}: ${collect(r[k])}`).join('\n'),contacts,textProvenance:{sourceUrl,fetchedAt,fields:present},id:`${source.sourceId}:${r.id}`,name:plain(r.name),description,provider:plain(r.organization?.name??r.organisation?.name)||'Provider not supplied',provisionType:null,categories,needs:Object.entries(needMapping).filter(([,p])=>p.test(text)).map(([n])=>n),scope:r.national===true||(r.service_areas??[]).some((a:any)=>/^(national|nationwide|uk|united kingdom)$/i.test(a.name??''))?'national':'local',postcode:addr.postal_code??addr.postcode??loc.postcode??null,lat:geoValid?latitude:null,lng:geoValid?longitude:null,address:[addr.address_1??addr.address_line_1,addr.address_2??addr.address_line_2,addr.address_line_3,addr.city,addr.state_province??addr.county,addr.postal_code??addr.postcode].filter(Boolean).join(', ')||null,delivery,eligibilitySummary:plain(r.eligibility?.description??r.eligibility??r.pc_targetAudience?.map((a:any)=>a.audienceType).join(', '))||ckEligibility||null,referralRoute:plain(r.application_process??r.referral_method??r.attending_access??(bucks&&r.needs_referral===true?'Referral required':bucks&&r.needs_referral===false?'No referral required':null))||null,cost:r.is_free===true||r.free===true?'Free':plain(r.fees??r.fees_text)||costOptions||null,accessibility:[...(loc.accessibility??loc.accessibilities??[]).map((a:any)=>plain(a.description??a.name??(a.accessibility!=='false'?a.accessibility:null))).filter(Boolean),...(loc.has_wheelchair_access===true?['Wheelchair access']:[]),...(loc.has_induction_loop===true?['Induction loop']:[]),...(loc.has_accessible_toilet===true?['Accessible toilet']:[]),...(loc.accessibility_info?[plain(loc.accessibility_info)]:[])],openingTimes:plain(r.schedule?.description??r.schedules?.[0]?.description)||[...new Set([...schedules,...ckHours])].join('; ')||null,url:/^https?:\/\//.test(r.url??'')?r.url:null,publicPhone:safePhone(r.contact_phone)??(r.contacts??[]).map((c:any)=>safePhone(c.phone)).find(Boolean)??phones.map((p:any)=>safePhone(p.number)).find(Boolean)??safePhone(r.organisation?.phone)??null,publicEmail:safeEmail(r.email??r.contact_email)??(r.contacts??[]).map((c:any)=>safeEmail(c.email)).find(Boolean)??safeEmail(r.organisation?.email),lastVerified:assured,sourceUpdatedAt:updated,...dates,vetting:'internal',source:source.name,sourceUrl:`${source.baseUrl}/services/${encodeURIComponent(r.id)}`,fetchedAt,availability:r.status==='inactive'?'Removed at source':'Available',raw:r};
}
export function isJobListing(r:any):boolean {return ['job','job_listing','vacancy','employer'].includes(r.type)||/^(job vacancy|job vacancies|vacancy:|vacancies:|employer listing)\b/i.test(r.name??'');}
