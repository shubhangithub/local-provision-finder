import {useCallback,useEffect,useRef,useState} from 'react';
import {feedbackFields} from '../lib/feedback';
import '../styles/enrichment.css';
export const enrichmentFieldLabels:Record<string,string>={...feedbackFields,accessibility:'Accessibility',referralRoute:'How to access'};
export const staffHeaders={'X-Staff-Demo':'true','Content-Type':'application/json'};
const date=(value?:string|null)=>value ? new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
const safe=(value?:string)=>{try {const url=new URL(value ?? '');return ['http:','https:'].includes(url.protocol) ? url.href : null;} catch {return null;}};
const short=(value:string,max=90)=>value.length>max ? `${value.slice(0,max).trimEnd()}…` : value;
export interface Overwrite {id:string;field:string;original:string;value:string;sourceUrl:string;quote:string;appliedAt:string;revertedAt?:string|null;serviceName?:string;serviceId?:string}
interface Gap {topic:string;reason:string;detail?:string;status?:string;flag_reason?:string}
interface Detail {configured:boolean;run:{status:'running'|'completed'|'error';outcome:string|null;error:string|null;startedAt:string;finishedAt:string|null}|null;overwrites:Overwrite[];gaps:Gap[];candidates:{name:string;url?:string;locality?:string}[];notes:string;unavailableSources:{url:string;reason:string}[]}
const notConfigured='Web enrichment is not configured. Set GOV_HACK_URL and GOV_HACK_API_TOKEN on the server.';
/** One change on one line: what it was, what it is now, where it came from, and an undo. */
export function ChangeLine({item,onRevert,busy,showService}:{item:Overwrite;onRevert?:(id:string)=>void;busy?:boolean;showService?:boolean}) {
  const label=enrichmentFieldLabels[item.field] ?? item.field;
  return <li className="change-line" title={item.quote || undefined}>
    {showService && <a className="change-service" href={`#/directory/${encodeURIComponent(item.serviceId ?? '')}`}>{item.serviceName}</a>}
    <strong>{label}:</strong> <del>{short(item.original || 'not listed')}</del> <span aria-hidden="true">→</span><span className="visually-hidden"> changed to</span> {item.revertedAt ? <span className="was-reverted">{short(item.value)} (reverted)</span> : <ins>{short(item.value)}</ins>}
    {' '}<span className="change-source">{safe(item.sourceUrl) ? <a href={safe(item.sourceUrl)!} target="_blank" rel="noreferrer">Source</a> : 'Source'} · {date(item.appliedAt)}</span>
    {!item.revertedAt && onRevert && <button type="button" className="text-button" disabled={busy} onClick={() => onRevert(item.id)}>Undo<span className="visually-hidden"> {label.toLowerCase()} change</span></button>}
  </li>;
}
/** Undoes one overwrite. Throws with the server's message if it can't. */
export async function revertOverwrite(id:string,serviceId:string) {
  const response=await fetch('/api/enrichment/revert',{method:'POST',headers:staffHeaders,body:JSON.stringify({id,serviceId})});const data=await response.json();if (!response.ok) throw new Error(data.error);
}
const gapsOf=(detail:Detail | null)=>(detail?.gaps ?? []).filter(gap => gap.status!=='resolved');
/** Admin control for one service: enrich, see when it last ran, and undo what it changed. The details themselves show in the main section. */
export default function EnrichServiceProfile({serviceId,refreshKey,onChanged,onChanges}:{serviceId:string;refreshKey:number;onChanged:()=>void;onChanges:(changes:Overwrite[])=>void}) {
  const [detail,setDetail]=useState<Detail | null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const wasRunning=useRef(false);
  const load=useCallback(async()=>{
    try {const response=await fetch(`/api/enrichment?serviceId=${encodeURIComponent(serviceId)}`,{headers:staffHeaders});const data=await response.json();if (!response.ok) throw new Error(data.error);setDetail(data);setError('');} catch (e) {setError(e instanceof Error ? e.message : 'Could not load enrichment.');}
  },[serviceId]);
  useEffect(()=>{setDetail(null);onChanges([]);},[serviceId,onChanges]);
  useEffect(()=>{void load();},[load,refreshKey]);
  // The changes themselves are shown on the fields they changed, so hand them to the page.
  useEffect(()=>{if (detail) onChanges(detail.overwrites);},[detail,onChanges]);
  const running=detail?.run?.status==='running';
  useEffect(()=>{
    if (running) {wasRunning.current=true;const timer=setTimeout(()=>void load(),3000);return ()=>clearTimeout(timer);}
    if (wasRunning.current && detail?.run) {wasRunning.current=false;window.dispatchEvent(new Event('directory-updated'));onChanged();}
  },[running,detail,load,onChanged]);
  async function post(path:string,payload:unknown,after:(data:any)=>void) {
    setBusy(true);setError('');
    try {const response=await fetch(path,{method:'POST',headers:staffHeaders,body:JSON.stringify(payload)});const data=await response.json();if (!response.ok) throw new Error(data.error);after(data);} catch (e) {setError(e instanceof Error ? e.message : 'Something went wrong.');} finally {setBusy(false);}
  }
  const start=()=>post('/api/enrichment',{serviceId},setDetail);
  const run=detail?.run;const gaps=gapsOf(detail);const unidentified=run?.status==='completed' && ['ambiguous','not_found'].includes(run.outcome ?? '');
  return <section className="panel enrich-profile" aria-label="Service profile enrichment">
    <button type="button" className="button secondary enrich-button" onClick={() => void start()} disabled={busy || running || !detail?.configured} aria-busy={running}>
      {running && <span className="spinner" aria-hidden="true"/>}{running ? 'Enriching…' : run ? 'Refresh service profile' : 'Enrich service profile'}
    </button>
    <p className="enrich-status" role="status">
      {!detail ? (error ? '' : 'Loading…') : !detail.configured ? notConfigured : running ? 'Researching this service. This takes about a minute.' : run?.status==='error' ? `Enrichment failed: ${run.error}` : unidentified ? (run!.outcome==='ambiguous' ? 'Could not identify this service. Nothing was changed.' : 'Nothing was found for this service. Nothing was changed.') : run ? `Last enriched ${date(run.finishedAt)}.` : 'Not enriched yet.'}
    </p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {gaps.length>0 && <p className="enrich-gaps" title={gaps.map(gap => gap.topic).join(', ')}>{gaps.length} {gaps.length===1 ? 'gap' : 'gaps'} not confirmed<span className="visually-hidden">: {gaps.map(gap => gap.topic).join(', ')}</span></p>}
    {!!detail?.overwrites.length && <p className="enrich-gaps">{detail.overwrites.length} {detail.overwrites.length===1 ? 'detail' : 'details'} updated. Changes are shown on each field.</p>}
  </section>;
}
