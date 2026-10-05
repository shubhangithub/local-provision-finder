import { readFile, writeFile } from 'node:fs/promises';
import type { ServiceRecord } from '../ingest/normalise.ts';
const records:ServiceRecord[]=JSON.parse(await readFile('data/services.cleaned.json','utf8'));
const now=new Date();
const flags:{source:string;id:string;name:string;issue:string;action:string}[]=[];
const add=(r:ServiceRecord,issue:string,action:string)=>flags.push({source:r.id.split(':')[0],id:r.id,name:r.name,issue,action});
const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]/g,'');
const summaries=Object.fromEntries(['bristol-oruk','kingston-ck'].map(source=>{
 const rows=records.filter(r=>r.id.startsWith(source+':'));
 const coverage=Object.fromEntries(['description','postcode','lat','lastVerified','sourceUpdatedAt','publicPhone','publicEmail','cost','openingTimes','categories','needs'].map(key=>[key,rows.filter(r=>{const v=r[key as keyof ServiceRecord];return Array.isArray(v)?v.length>0:v!==null&&v!=='';}).length]));

 const duplicateNames=new Map<string,ServiceRecord[]>();
 for(const r of rows){const key=normalize(r.name)+'|'+normalize(r.provider);duplicateNames.set(key,[...(duplicateNames.get(key)??[]),r]);
  if(!r.postcode&&r.scope!=='national')add(r,'Missing postcode','Use retained locations or verify area before distance filtering.');
  if(r.lat===null||r.lng===null)add(r,'Missing coordinates','Geocode approved addresses; do not invent distances.');


  if(!r.needs.length)add(r,'No mapped needs','Review taxonomy and service description; extend mapping only with evidence.');
  if(!r.publicPhone&&!r.publicEmail)add(r,'No structured phone or email','Check retained source text and approved website for public contact route.');
  if(r.description.length<80)add(r,'Very short description','Review whether enough service detail is available.');
  if(r.provider==='Provider not supplied')add(r,'Missing provider','Resolve source organisation relationship.');
  const raw=(r.raw??{}) as Record<string,any>;
  if(raw.ends_at&&Number.isFinite(Date.parse(raw.ends_at))&&new Date(raw.ends_at)<now)add(r,'Past end date','Check closure or recurring event; do not auto-delete.');
  if(raw.status&&raw.status!=='active')add(r,`Source status: ${raw.status}`,'Review availability before public use.');
 }
 const duplicates=Array.from(duplicateNames.values()).filter(group=>group.length>1).map(group=>group.map(r=>({id:r.id,name:r.name})));
 duplicates.flat().forEach(x=>{const r=rows.find(r=>r.id===x.id)!;add(r,'Possible duplicate name and provider','Compare service schedules and access routes; do not auto-merge.');});
 return [source,{total:rows.length,coverage,possibleDuplicateGroups:duplicates,needCounts:Object.fromEntries([...new Set(rows.flatMap(r=>r.needs))].sort().map(need=>[need,rows.filter(r=>r.needs.includes(need)).length])),textBeyondExcelCellLimit:rows.filter(r=>r.searchText.length>32767).length,missingProvider:rows.filter(r=>r.provider==='Provider not supplied').length}];
}));
const audit={evaluatedAt:now.toISOString(),sources:summaries,totalFlags:flags.length};
await writeFile('data/quality-audit.json',JSON.stringify(audit,null,2)+'\n');
const cols=['source','id','name','issue','action'] as const;
const quote=(v:string)=>'"'+v.replaceAll('"','""')+'"';
await writeFile('data/quality-issues.csv',[cols.join(','),...flags.map(r=>cols.map(c=>quote(r[c])).join(','))].join('\n')+'\n');
console.log(JSON.stringify(audit,null,2));
