import ServiceAvailability from './ServiceAvailability';
import type {AvailabilityConfirmation} from '../lib/directory';
import SaveServiceButton from './SaveServiceButton';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
import { feedbackFields, type FeedbackField } from '../lib/feedback';
import { askAgent } from '../lib/agent';
import ReviewAdvisor from './ReviewAdvisor';
import { ServiceTags } from './ServiceTags';
import ServiceFeedback from './ServiceFeedback';
import { rememberService } from '../lib/notifications';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, Database, Globe, Mail, MapPin, Phone, Search, ShieldCheck } from 'lucide-react';
interface ImportedRecord {
  id: string; name: string; description: string; provider: string; postcode: string | null;
  categories: string[]; needs: string[]; source: string; vetting: string;
  publicPhone: string | null; publicEmail: string | null; lastVerified: string | null;
  sourceUpdatedAt: string | null; searchText?: string; sourceUrl?: string; url?: string;
  address?: string | null; fetchedAt?: string; contacts?: unknown[]; tags?: string[]; availabilityConfirmation?:AvailabilityConfirmation;fieldCheckedAt?: Record<string,string>;
  eligibilitySummary?: string | null; openingTimes?: string | null; cost?: string | null;
}
interface ImportReport {
  total: number; generatedAt: string;
  sources: { source: string; status: string; written?: number; error?: string }[];
}
interface ImportResponse { total: number; records: ImportedRecord[]; report: ImportReport | null; ready: boolean; pageSize?: number }
const dateLabel = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : 'Not supplied';
function organisationContacts(value: unknown): string[] {
  const collect = (v: unknown, key = ''): string[] => {
    if (typeof v === 'string' && /name|title|email|number|phone|extension|description/i.test(key)) return [v];
    if (Array.isArray(v)) return v.flatMap(item => collect(item,key));
    if (v && typeof v === 'object') return Object.entries(v).flatMap(([k,x]) => collect(x,k));
    return [];
  };
  return [...new Set(collect(value))];
}
function safeUrl(value: string | null | undefined): string | null {
  try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function ImportAdvisor({ record }: { record: ImportedRecord }) {
  const missing = [!record.postcode && 'postcode', !record.eligibilitySummary && 'eligibility', !record.openingTimes && 'opening times', !record.cost && 'cost', !record.publicPhone && !record.publicEmail && 'contact details'].filter(Boolean);
  return <ReviewAdvisor serviceId={record.id} action={missing.length ? `Confirm ${missing.join(', ')} with the provider and check current availability before approving this record.` : 'Check current availability, eligibility and source details with the provider before approving this record.'} evidence={`${record.source} import; ${record.lastVerified ? `source assured date ${dateLabel(record.lastVerified)}` : 'no source assured date supplied'}; ${missing.length ? `missing ${missing.join(', ')}` : 'core details supplied'}. Source dates are not independent verification.`} />;
}
export default function ImportedServices({ staff, enableStaff, onNavigate, initialId, directoryView = false, feedbackOpen = false, feedbackContext }: { feedbackOpen?: boolean; feedbackContext?: 'viewed' | 'recommended'; directoryView?: boolean; initialId?: string; staff: boolean; enableStaff: () => void; onNavigate: (route: string) => void }) {
  const [saved,setSaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setSaved(readDirectorySaved());window.addEventListener("directory-saved-changed",update);return () => window.removeEventListener("directory-saved-changed",update);},[]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ImportResponse | null>(null);
  const [record, setRecord] = useState<ImportedRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!staff && !directoryView) return;
    const controller = new AbortController(); setLoading(true); setError('');
    const endpoint = selectedId ? `/api/imports/service?id=${encodeURIComponent(selectedId)}` : `/api/imports?q=${encodeURIComponent(search)}&page=${page}`;
    let retry:ReturnType<typeof setTimeout>|undefined;
    function load(retryOnce:boolean){fetch(endpoint,{signal:controller.signal}).then(async response=>{
      const result=await response.json();if(!response.ok)throw Error(result.error??'Could not load the directory.');
      if(selectedId)setRecord(result.record);else setData(result);setLoading(false);
    }).catch(error=>{if(controller.signal.aborted||error.name==='AbortError')return;if(retryOnce){retry=setTimeout(()=>load(false),500);return;}setError(selectedId?'Could not load this service. Please try again.':'Could not load the directory. Please try again.');setLoading(false);});}
    load(true);
    return()=>{controller.abort();if(retry)clearTimeout(retry);};
  }, [staff, directoryView, search, page, selectedId, reload]);
  useEffect(() => { heading.current?.focus(); if (record && directoryView) rememberService(record.id,record.name,'viewed'); }, [record,directoryView]);
  if (!staff && !directoryView) return <div className="page-wrap"><div className="staff-gate panel"><Database size={34} /><h1>Imported directory</h1><p>Browse source records, published contacts and retained service text before public approval.</p><button className="button primary" onClick={enableStaff}>Enter staff demo <ArrowRight size={17} /></button></div></div>;
  return <div className="page-wrap imports-page">{!directoryView && <button className="back-link" onClick={() => selectedId ? setSelectedId(null) : onNavigate('/review')}><ArrowLeft size={15} />{selectedId ? 'Back to directory' : 'Back to review'}</button>}
    {selectedId && record ? <><div className="page-heading"><div><p className="eyebrow">{directoryView ? "SERVICE DETAILS" : "SOURCE RECORD · AWAITING PUBLIC REVIEW"}</p><h1 ref={heading} tabIndex={-1}>{record.name}</h1><p>{record.provider} · {record.postcode ?? 'Postcode not supplied'}</p></div>{directoryView && <SaveServiceButton saved={saved.some(item=>item.id===record.id)} name={record.name} onToggle={()=>toggleDirectorySaved(record)}/>}</div>{!directoryView && <div className="notice neutral"><ShieldCheck size={18} /><p>This is an imported source record. A source update date is not independent verification.</p></div>}<div className="detail-grid"><div className="detail-main"><section className="panel"><h2>About this service</h2><div className="agent-compact-help"><button className="text-button" onClick={()=>askAgent({question:'Explain this service',context:{title:record.name,searchText:record.name+' '+record.description.slice(0,180),serviceId:record.id,facts:[`${record.name}: ${record.description}`,`Provider: ${record.provider}. Who it is for: ${record.eligibilitySummary ?? 'not supplied'}.`,`Cost: ${record.cost ?? 'not supplied'}. Opening times: ${record.openingTimes ?? 'not supplied'}.`,`Address: ${record.address ?? 'not supplied'}. Postcode: ${record.postcode ?? 'not supplied'}.`,`Source: ${record.source}. Source assured date: ${dateLabel(record.lastVerified)}. Confirm eligibility and availability with the provider.`],prompts:['Explain this service','What details need checking?','Find similar provision']}})}>Ask agent about this service</button></div><p className="source-description">{record.description || 'No description supplied.'}</p><div className="detail-facts"><div><span>Who it is for</span><strong>{record.eligibilitySummary ?? 'Not supplied'}</strong></div><div><span>Address</span><strong>{record.address ?? 'Not supplied'}</strong></div><div><span>Cost</span><strong>{record.cost ?? 'Not supplied'}</strong></div><div><span>Opening times</span><strong>{record.openingTimes ?? 'Not supplied'}</strong></div></div></section><ServiceAvailability serviceId={record.id} staff={staff} initial={record.availabilityConfirmation}/><ServiceTags serviceId={record.id} staff={staff} initialTags={record.tags ?? []}/><ServiceFeedback service={record} initiallyOpen={feedbackOpen} context={feedbackContext}/></div><aside className="detail-side"><section className="panel imported-contacts"><h2>Published contacts</h2>{record.publicPhone && <a href={`tel:${record.publicPhone.replace(/[^\d+]/g,'')}`}><Phone size={16} />{record.publicPhone}</a>}{record.publicEmail && <a href={`mailto:${record.publicEmail}`}><Mail size={16} />{record.publicEmail}</a>}{!record.publicPhone && !record.publicEmail && <p>No primary phone or email supplied.</p>}{!!record.contacts?.length && <details><summary>All source contacts ({record.contacts.length})</summary>{record.contacts.map((contact,index) => <div className="contact-entry" key={index}>{organisationContacts(contact).map((line,i) => <p key={i}>{line}</p>)}</div>)}</details>}{safeUrl(record.url) && <a href={safeUrl(record.url)!} target="_blank" rel="noreferrer"><Globe size={16} />Provider website<ArrowUpRight size={13} /></a>}</section>{!directoryView && <ImportAdvisor record={record} />}<section className="panel evidence-panel"><h2>Source history</h2><dl><div><dt>Directory</dt><dd>{record.source}</dd></div><div><dt>Source assured date</dt><dd>{dateLabel(record.lastVerified)}</dd></div><div><dt>Source updated date</dt><dd>{dateLabel(record.sourceUpdatedAt)}</dd></div>{record.fieldCheckedAt && Object.entries(record.fieldCheckedAt).map(([field,date]) => <div key={field}><dt>{feedbackFields[field as FeedbackField] ?? "Service detail"} checked</dt><dd>{dateLabel(date)}</dd></div>)}<div><dt>Fetched</dt><dd>{dateLabel(record.fetchedAt)}</dd></div>{!directoryView && <div><dt>Publication</dt><dd>Internal · awaiting review</dd></div>}</dl>{safeUrl(record.sourceUrl) && <a className="text-button" href={safeUrl(record.sourceUrl)!} target="_blank" rel="noreferrer">Original source record<ArrowUpRight size={13} /></a>}</section></aside></div></> : <><div className="page-heading"><div><p className="eyebrow">STAFF WORKSPACE · SOURCE DATA</p><h1>Local knowledge, kept in full.</h1><p>Browse imported services, their contacts and the detail behind each record.</p></div><button className="button secondary small" onClick={() => setReload(reload+1)}>Reload catalogue</button></div><div className="notice neutral"><ShieldCheck size={18} /><p>Source update dates do not guarantee current availability. Confirm details with the provider.</p></div><p className="source-attribution">Contains service directory information from Bristol City Council / Well Aware, licensed under the Open Government Licence. Connected Kingston data is used under project-specific permission. No council endorsement is implied.</p>{data?.report && <div className="source-status">{data.report.sources.map(source => <div className="source-status-item" key={source.source}><Database size={18} /><div><strong>{source.source === 'bristol-oruk' ? 'Bristol · Well Aware' : 'Kingston upon Thames'}</strong><p>{source.status === 'complete' ? `${source.written ?? 0} imported services` : source.status === 'licence-blocked' ? 'Not imported · reuse licence unresolved' : source.status}</p></div></div>)}</div>}<form className="import-search" onSubmit={e => { e.preventDefault(); setSearch(draft); setPage(1); }}><label htmlFor="import-query">Search the full service text</label><div className="import-search-row"><div className="input-wrap"><Search size={17} /><input id="import-query" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Try a service, postcode, opening time or access need" maxLength={200} /></div><button className="button primary" type="submit">Search<ArrowRight size={16} /></button></div></form>
    {error && <div className="notice warning" role="alert"><CircleAlert size={18} /><p>{error}</p></div>}{loading ? <p className="loading-message" role="status">Loading source records…</p> : error ? <button className="button secondary" onClick={()=>setReload(value=>value+1)}>Try again</button> : <><div className="import-count"><strong>{data?.total ?? 0} source records{search ? ` matching “${search}”` : ''}</strong><span>Internal · awaiting review</span></div>{!data?.total && <div className="empty-state panel"><Database size={30} /><h2>{data?.ready ? 'No matching records' : 'No directory records available'}</h2><p>{data?.ready ? 'Try different words to search the retained source text.' : 'Use Reload catalogue to check again.'}</p></div>}<div className="result-list">{data?.records.map(service => <article className="service-card import-card" key={service.id}><div className="service-icon"><Database size={21} /></div><div className="service-card-body"><div className="card-title-row"><h3><button className="import-service-link" onClick={() => { setSelectedId(service.id); window.scrollTo({top:0}); }}>{service.name}<ArrowUpRight size={15} /></button></h3></div><p className="match-snippet">{service.provider}</p><div className="card-foot"><span className="delivery"><MapPin size={12} />{service.postcode ?? 'Postcode not supplied'}</span><span className="trust-line needs-check">Awaiting public review</span></div><ImportAdvisor record={service} /></div></article>)}</div>{data && data.total > (data.pageSize ?? 20) && <div className="pagination"><button className="button secondary small" disabled={page <= 1} onClick={() => { setPage(page-1); window.scrollTo({top:0}); }}><ArrowLeft size={14} />Previous</button><span>Page {page} of {Math.ceil(data.total/(data.pageSize ?? 20))}</span><button className="button secondary small" disabled={page*(data.pageSize ?? 20) >= data.total} onClick={() => { setPage(page+1); window.scrollTo({top:0}); }}>Next<ArrowRight size={14} /></button></div>}</>}
    </>}
  </div>;
}
