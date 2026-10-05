import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, ArrowUpRight, Search, MapPin, SlidersHorizontal, Bookmark, ChevronDown, X, Check, ShieldCheck, CircleAlert, Compass, Printer, RotateCcw, ClipboardCheck, FileText, LockKeyhole, ExternalLink, MessageSquare, CheckCircle2, Clock3, Globe, Layers3 } from 'lucide-react';
import { catalogue, changes, pathways } from './data/catalogue';
import { defaultQuery, findServices, inferNeeds, needLabels, parsePostcode, practicalLabels, effectiveStatus } from './lib/search';
import { applyDecisions, canPublish } from './lib/review';
import { readDecisions, readSaved, saveLocal } from './lib/storage';
import ServiceCard, { formatDate, serviceIcon } from './components/ServiceCard';
import ImportedServices from './components/ImportedServices';
import LocationSearch from './components/LocationSearch';
import ServiceSuggestions from './components/ServiceSuggestions';
import SuggestionReview from './components/SuggestionReview';
import MeetingDemo from './components/MeetingDemo';
import FeedbackReview from './components/FeedbackReview';
import SavedDirectoryServices from './components/SavedDirectoryServices';
import { readDirectorySaved } from './lib/directory-saved';
import ServiceNotifications from './components/ServiceNotifications';
import type { Need, PracticalNeed, ProposedChange, ReviewDecision, SearchQuery, Service, ServiceMatch } from './types';

const topics: Need[] = ['wellbeing', 'training', 'money', 'digital', 'housing', 'childcare', 'confidence', 'transport', 'language', 'enterprise'];
const providerTypes = [...new Set(catalogue.map(service => service.providerType))].sort();
const referenceDate = '2026-10-05';
function queryFromUrl(): SearchQuery | null {
  const p = new URLSearchParams(location.search);
  if (!p.has('postcode')) return null;
  const validNeeds = (p.get('needs') ?? '').split(',').filter((n): n is Need => n in needLabels);
  const validPractical = (p.get('access') ?? '').split(',').filter((n): n is PracticalNeed => n in practicalLabels);
  const radius = Number(p.get('radius') ?? 3);
  return { ...defaultQuery, text: p.get('q') ?? '', postcode: p.get('postcode') ?? '', radius: [1,2,3,5,6,8,10].includes(radius) ? radius : 3, includeRemote: p.get('remote') !== '0', needs: validNeeds, practical: validPractical, providerType: providerTypes.includes(p.get('type') ?? '') ? p.get('type')! : '' };
}
function persistQuery(query: SearchQuery | null) {
  const url = new URL(location.href);
  url.search = '';
  if (query) {
    const p = url.searchParams;
    p.set('q', query.text); p.set('postcode', query.postcode); p.set('radius', String(query.radius));
    p.set('remote', query.includeRemote ? '1' : '0');
    if (query.needs.length) p.set('needs', query.needs.join(','));
    if (query.practical.length) p.set('access', query.practical.join(','));
    if (query.providerType) p.set('type', query.providerType);
  }
  history.replaceState(null, '', url);
}
function ToggleChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`chip ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}>{selected && <Check size={13} aria-hidden="true" />}{label}</button>;
}
function SearchOptions({ query, update, showType = false }: { query: SearchQuery; update: (query: SearchQuery) => void; showType?: boolean }) {
  return <div className="search-options">
    <div className="options-row"><div className="field"><label htmlFor="radius">Travel distance</label><select id="radius" value={query.radius} onChange={e => update({ ...query, radius: Number(e.target.value) })}>{[1,2,3,5,6,8,10].map(n => <option key={n} value={n}>Up to {n} {n === 1 ? 'mile' : 'miles'}</option>)}</select></div>
      {showType && <div className="field"><label htmlFor="provider-type">Service provider</label><select id="provider-type" value={query.providerType} onChange={e => update({ ...query, providerType: e.target.value })}><option value="">All provider types</option>{providerTypes.map(type => <option key={type}>{type}</option>)}</select></div>}
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={query.includeRemote} onChange={e => update({ ...query, includeRemote: e.target.checked })} /><span>Include online and phone options serving this area</span></label>
    <div className="option-group"><span className="field-label">Access and practical needs</span><div className="chips">{(Object.keys(practicalLabels) as PracticalNeed[]).map(n => <ToggleChip key={n} label={practicalLabels[n]} selected={query.practical.includes(n)} onClick={() => update({ ...query, practical: query.practical.includes(n) ? query.practical.filter(x => x !== n) : [...query.practical, n] })} />)}</div><p className="field-hint">We show listed features and flag anything you still need to check.</p></div>
  </div>;
}

function DetailPage({ service, saved, toggleSaved, onNavigate, feedback, report }: {
  service: Service; saved: boolean; toggleSaved: (id: string) => void; onNavigate: (route: string) => void;
  feedback: string | undefined; report: (id: string, note: string) => void;
}) {
  const Icon = serviceIcon(service);
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState('');
  const pathway = pathways.find(p => p.Suggested_Provision_IDs.split(';').includes(service.id));
  const status = effectiveStatus(service);
  return <div className="page-wrap detail-page">
    <button className="back-link" onClick={() => onNavigate('/')}><ArrowLeft size={16} />Back to results</button>
    <div className="detail-hero"><div className="service-icon large"><Icon size={29} strokeWidth={1.5} /></div><div className="detail-title"><p className="eyebrow">{service.providerType} · {service.id}</p><h1>{service.name}</h1><p>{service.category} · {service.delivery}</p></div><button className={`button secondary ${saved ? 'saved-button' : ''}`} aria-pressed={saved} onClick={() => toggleSaved(service.id)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save service'}</button></div>
    {(service.coverageConflict || service.venueConflict || status !== 'Verified') && <div className="notice warning"><CircleAlert size={19} /><div><strong>{service.coverageConflict ? 'Check area coverage before using this service' : service.venueConflict ? 'Check the venue before travelling' : 'Some details need checking'}</strong><p>{service.coverageConflict ? 'The catalogue lists AB4, but a proposed update says sources disagree about North and East coverage. This needs human verification.' : service.venueConflict ? 'A provider update suggests a venue change. The proposed address has not been verified.' : 'The record is due for review or potentially outdated. Confirm the details with the provider.'}</p></div></div>}
    <div className="detail-grid"><div className="detail-main">
      <section className="panel"><h2>What help is available?</h2><p>{service.name} is listed for {service.needs.join(', ')}.</p><div className="detail-facts"><div><span>Availability</span><strong>{service.availability}</strong></div><div><span>Delivery</span><strong>{service.delivery}</strong></div><div><span>Cost</span><strong>Not supplied — check with provider</strong></div><div><span>Opening times</span><strong>Not supplied — check with provider</strong></div>{service.endDate && <div><span>Course end date</span><strong>{service.endDate} (year not supplied)</strong></div>}</div>{service.availability === 'Closed' && <p className="inline-warning">This service is closed and is excluded from active results.</p>}{service.availability === 'Opening soon' && <p className="field-hint">The catalogue and proposed opening-date update may be out of sync. Confirm the start date.</p>}</section>
      <section className="panel"><h2>Who is it for?</h2><p>{service.eligibilitySummary}.</p><p className="field-hint">This is the provider's summary, not confirmation that someone can use the service.</p><div className="inset"><strong>Checks before taking the next step</strong><p>{pathway?.Check ?? 'Coverage, entry requirements and availability'}. Confirm these with the provider or a work coach.</p></div></section>
      <section className="panel"><h2>How to access it</h2><div className="detail-facts"><div><span>Access route</span><strong>{service.referralRoute}</strong></div><div><span>Area listed</span><strong>{service.postcodePrefixes.join(', ')}</strong></div><div><span>Venue</span><strong>{service.venue ?? 'Address not supplied in the catalogue'}</strong>{service.venueCheckedOn && <small>Venue checked {formatDate(service.venueCheckedOn)}</small>}</div><div><span>Accessibility listed</span><strong>{service.accessibility.join(', ')}</strong></div></div><p className="field-hint">{service.distanceMiles} miles is a sample distance, not a live calculation. Confirm access needs before travelling.</p><div className="demo-link"><Globe size={17} /><div><strong>Provider website</strong><code>{service.sourceUrl}</code><small>Fictional .example URL · no live link verification</small></div></div></section>
    </div><aside className="detail-side"><section className="panel evidence-panel"><div className="section-icon"><ShieldCheck size={20} /><h2>About this information</h2></div><dl><div><dt>Record status</dt><dd>{status === 'Potentially outdated' ? 'Details need checking' : status}</dd></div><div><dt>Last checked</dt><dd>{formatDate(service.lastVerified)}</dd></div><div><dt>Source</dt><dd>Synthetic DWP catalogue</dd></div><div><dt>Owner</dt><dd>{service.ownerRole} · {service.ownerType}</dd></div><div><dt>Provider response</dt><dd>{service.contactStatus}</dd></div></dl><p className="evidence-note">{service.confidence >= 85 ? 'The sample record has stronger supporting evidence.' : service.confidence >= 60 ? 'Some supporting evidence needs refreshing.' : 'Supporting evidence is limited or outdated.'} This does not guarantee availability or suitability.</p>{service.venueCheckedOn && <p className="evidence-note">Only the venue change was checked in this demo. The original record date and confidence are preserved.</p>}</section>
      <section className="panel feedback-panel"><MessageSquare size={21} /><h2>Is something incorrect?</h2><p>Help keep this information useful.</p>{feedback ? <div className="feedback-success"><CheckCircle2 size={17} />Feedback recorded in this browser session.</div> : <><button className="text-button" onClick={() => setReportOpen(!reportOpen)}>Report incorrect information <ArrowRight size={15} /></button>{reportOpen && <form onSubmit={e => { e.preventDefault(); report(service.id, note); }}><label htmlFor="report-note">What needs checking?</label><textarea id="report-note" value={note} onChange={e => setNote(e.target.value)} required maxLength={500} placeholder="For example, the venue has changed" /><p className="field-hint">Don't include personal details. Feedback stays in this browser session; it isn't sent.</p><button className="button primary" type="submit">Record feedback</button></form>}</>}</section>
    </aside></div>
  </div>;
}

function ReviewPage({ staff, enableStaff, services, decisions, decide, reset, onNavigate }: {
  staff: boolean; enableStaff: () => void; services: Service[]; decisions: ReviewDecision[];
  decide: (change: ProposedChange, status: ReviewDecision['status'], verified: boolean) => void;
  reset: () => void; onNavigate: (route: string) => void;
}) {
  const [selected, setSelected] = useState<ProposedChange | null>(null);
  const [verified, setVerified] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'history'>('pending');
  const [resetOpen, setResetOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  function closeDialog() { dialog.current?.close(); setSelected(null); setVerified(false); opener.current?.focus(); }
  const priority: Record<string, number> = { Closure: 0, Eligibility: 1, Venue: 2, Accessibility: 3, 'End date': 4, 'New service': 5 };
  const pending = changes.filter(c => !decisions.some(d => d.updateId === c.id));
  const listed = (filter === 'pending' ? pending : changes.filter(c => decisions.some(d => d.updateId === c.id))).slice().sort((a,b) => (priority[a.field] ?? 6) - (priority[b.field] ?? 6));
  if (!staff) return <div className="page-wrap"><div className="staff-gate panel"><LockKeyhole size={34} /><h1>Keep local information current</h1><p>Review proposed changes against the evidence before publishing.</p><button className="button primary" onClick={enableStaff}>Enter staff demo <ArrowRight size={17} /></button><p className="field-hint">Demo mode only. No real authentication or restricted contacts are included.</p></div></div>;
  return <div className="page-wrap review-page"><div className="page-heading"><div><p className="eyebrow">STAFF WORKSPACE</p><h1>Review proposed changes</h1><p>Agents spot changes. You check the evidence and decide.</p></div><div className="review-count"><ClipboardCheck size={22} /><strong>{pending.length}</strong><span>awaiting review</span></div></div>
    <div className="notice neutral"><ShieldCheck size={18} /><p>Demo decisions stay in this browser. Publishing updates only the checked field; it does not verify the whole service.</p></div>
    <div className="import-entry"><div><strong>Browse the imported directory</strong><p>Full service text and published contacts, held for review.</p></div><button className="text-button" onClick={() => onNavigate('/imports')}>Imported services<ArrowRight size={15} /></button></div><div className="review-toolbar"><div className="tabs" role="group" aria-label="Review list"><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>To review <span>{pending.length}</span></button><button className={filter === 'history' ? 'active' : ''} onClick={() => setFilter('history')}>Decision history <span>{decisions.length}</span></button></div><button className="text-button muted" onClick={() => setResetOpen(!resetOpen)}><RotateCcw size={14} />Reset demo</button></div>
    {resetOpen && <div className="notice warning"><div><strong>Reset all review decisions?</strong><p>This restores the original catalogue. Your saved list is kept.</p><div className="button-row"><button className="button secondary small" onClick={() => { reset(); setResetOpen(false); }}>Reset decisions</button><button className="text-button" onClick={() => setResetOpen(false)}>Cancel</button></div></div></div>}
    <div className="review-list">{!listed.length && <div className="empty-state panel"><CheckCircle2 size={32} /><h2>{filter === 'pending' ? 'All caught up' : 'No decisions yet'}</h2><p>{filter === 'pending' ? 'Your decisions are in the history tab.' : 'Review a proposed change to start the history.'}</p></div>}{listed.map(change => {
      const service = services.find(s => s.id === change.serviceId)!;
      const decision = decisions.find(d => d.updateId === change.id);
      return <article className="review-card" key={change.id}><div className="review-card-heading"><div><div className="review-meta"><span className={`change-type ${['Closure','Eligibility'].includes(change.field) ? 'high-risk' : ''}`}>{change.field} change</span><span>{change.id} · {change.sourceType}</span></div><h2><a href={`#/service/${service.id}`} onClick={e => { e.preventDefault(); onNavigate(`/service/${service.id}`); }}>{service.name}<ArrowUpRight size={16} /></a></h2></div><span className="confidence-tag">{change.confidence} evidence</span></div><div className="diff-row"><div><span>Previously listed</span><p>{change.oldValue}</p></div><ArrowRight size={18} /><div><span>Proposed update</span><p>{change.newValue}</p></div></div><div className="review-bottom"><p><CircleAlert size={14} />{change.recommendedAction}{change.field === 'New service' && ' · already in catalogue; reconcile before publication'}</p>{decision ? <span className={`decision-badge ${decision.status}`}><Check size={14} />{decision.status === 'published' ? 'Published' : decision.status === 'held' ? 'Held for checking' : 'Rejected'} · {formatDate(decision.decidedOn.slice(0,10))}</span> : <button className="button secondary small" onClick={e => { opener.current = e.currentTarget; setSelected(change); setVerified(false); }}>Review change <ArrowRight size={15} /></button>}</div></article>;
    })}</div>
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); closeDialog(); }} className="review-dialog" aria-labelledby="dialog-title"><div className="dialog-heading"><p className="eyebrow">HUMAN REVIEW</p><button className="icon-button" aria-label="Close review" onClick={closeDialog}><X size={20} /></button></div>{selected && <><h2 id="dialog-title">Check this {selected.field.toLowerCase()} change</h2><p>{services.find(s => s.id === selected.serviceId)?.name}</p><div className="inset"><strong>{selected.oldValue} → {selected.newValue}</strong><p>Detected {formatDate(selected.detectedOn)} from {selected.sourceType.toLowerCase()}. Evidence: {selected.confidence.toLowerCase()}.</p></div><p className="field-hint">This is a fictional verification exercise. No live provider has been contacted.</p>{selected.field === 'New service' ? <div className="notice warning"><p>This service is already listed. Hold for reconciliation or reject the duplicate proposal. New public listings also need vetting and a verified link.</p></div> : <label className="checkbox-label verify-checkbox"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /><span>I have checked the evidence for this specific field in the demo.</span></label>}<div className="dialog-actions"><button className="button primary" disabled={!canPublish(selected, verified)} onClick={() => { decide(selected, 'published', verified); closeDialog(); }}>Publish checked change</button><button className="button secondary" onClick={() => { decide(selected, 'held', false); closeDialog(); }}>Hold for checking</button><button className="text-button danger" onClick={() => { decide(selected, 'rejected', false); closeDialog(); }}>Reject change</button></div></>}</dialog>
  </div>;
}

export default function App() {
  const initial = useRef(queryFromUrl());
  const [query, setQuery] = useState<SearchQuery>(initial.current ?? defaultQuery);
  const [submitted, setSubmitted] = useState<SearchQuery | null>(initial.current);
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  const [staff, setStaff] = useState(false);
  const [directorySaved,setDirectorySaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setDirectorySaved(readDirectorySaved());window.addEventListener("directory-saved-changed",update);window.addEventListener("storage",update);return () => {window.removeEventListener("directory-saved-changed",update);window.removeEventListener("storage",update);};},[]);
  const [saved, setSaved] = useState(readSaved);
  const [decisions, setDecisions] = useState(readDecisions);
  const [feedback, setFeedback] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [browse, setBrowse] = useState(false);
  const [options, setOptions] = useState(false);
  const [filters, setFilters] = useState(false);
  const [editing, setEditing] = useState(false);
  const postcodeRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const services = useMemo(() => applyDecisions(catalogue, changes, decisions), [decisions]);
  const result = useMemo(() => submitted ? findServices(services, submitted) : null, [services, submitted]);
  const pendingCount = changes.length - decisions.length;
  useEffect(() => {
    const handleRoute = () => { setRoute(location.hash.slice(1) || '/'); const parsed = queryFromUrl(); setSubmitted(parsed); setQuery(parsed ?? defaultQuery); setEditing(false); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', handleRoute); window.addEventListener('popstate', handleRoute);
    return () => { window.removeEventListener('hashchange', handleRoute); window.removeEventListener('popstate', handleRoute); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const title = route === '/add-provision' ? 'Add provision' : route.startsWith('/service/') ? services.find(s => s.id === route.split('/')[2])?.name : route === '/suggest' ? 'Suggest a service' : route === '/suggestions' ? 'Review suggested services' : route === '/feedback' ? 'Review feedback' : route.startsWith('/directory/') ? 'Service details' : route === '/imports' ? 'Imported services' : route === '/review' ? 'Review changes' : route === '/saved' ? 'Saved services' : submitted ? 'Search results' : 'Find your next step';
    document.title = `${title ?? 'Service not found'} — Local Provision`;
  }, [route, submitted, services]);
  function navigate(next: string) {
    if (route === next) return;
    location.hash = next;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function runSearch(next = query) {
    if (!parsePostcode(next.postcode)) { setError('Enter a demo postcode from AB1 to AB8, for example AB4.'); postcodeRef.current?.focus(); return; }
    const clean = { ...next, postcode: parsePostcode(next.postcode)! };
    setError(''); setQuery(clean); setSubmitted(clean); persistQuery(clean); setEditing(false); setFilters(false); navigate('/');
    setTimeout(() => resultsRef.current?.focus(), 40);
  }
  function submit(e: FormEvent) { e.preventDefault(); runSearch(); }
  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    setSaved(next);
    const persisted = saveLocal('lp-saved-v1', next);
    setNotice(`${next.includes(id) ? 'Service saved' : 'Service removed from saved list'}${persisted ? '' : ' for this session only'}.`);
  }
  function decide(change: ProposedChange, status: ReviewDecision['status'], verified: boolean) {
    if (status === 'published' && !canPublish(change, verified)) return;
    const next = [...decisions.filter(d => d.updateId !== change.id), { updateId: change.id, status, verified, decidedOn: new Date().toISOString() }];
    setDecisions(next); const persisted = saveLocal('lp-decisions-v1', next);
    setNotice(`${status === 'published' ? 'Checked change published' : status === 'held' ? 'Change held for further checking' : 'Change rejected'}${persisted ? ' in this browser' : ' for this session only'}.`);
  }
  const [homeVisit, setHomeVisit] = useState(0);
  function freshSearch() { setHomeVisit(value => value + 1); setQuery(defaultQuery); setSubmitted(null); setEditing(false); setOptions(false); setFilters(false); setError(''); persistQuery(null); navigate('/'); }
  function demoSearch() { runSearch({ ...defaultQuery, text: 'anxiety and housing', postcode: 'AB4', radius: 2, practical: ['quiet'] }); }
  const detailService = route.startsWith('/service/') ? services.find(s => s.id === route.split('/')[2]) : null;
  const savedServices = services.filter(s => saved.includes(s.id));
  const savedMatch = (service: Service): ServiceMatch => ({ service, score: 0, matchedNeeds: [], reasons: [service.category], missingPractical: [] });
  const searchForm = (compact: boolean) => <form className={`search-form ${compact ? 'compact' : ''}`} onSubmit={submit}>
    <div className="search-fields"><div className="field circumstances"><label htmlFor="circumstances" className={compact ? undefined : 'visually-hidden'}>What do you need help with?</label><div className="input-wrap"><Search size={18} aria-hidden="true" /><input id="circumstances" type="text" maxLength={250} value={query.text} onChange={e => setQuery({ ...query, text: e.target.value })} placeholder="For example, anxiety or help getting into work" autoComplete="off" /></div></div><div className="field postcode-field"><label htmlFor="postcode">Postcode</label><div className={`input-wrap ${error ? 'invalid' : ''}`}><MapPin size={17} aria-hidden="true" /><input id="postcode" ref={postcodeRef} value={query.postcode} onChange={e => { setQuery({ ...query, postcode: e.target.value }); setError(''); }} placeholder="e.g. AB4" autoComplete="postal-code" maxLength={8} aria-invalid={!!error} aria-describedby={error ? 'postcode-error' : 'postcode-hint'} /></div></div><button className="button primary search-submit" type="submit">{compact ? 'Update search' : 'Find support'}<ArrowRight size={18} /></button></div>
    {error && <p id="postcode-error" className="form-error" role="alert">{error}</p>}
    <div className="form-bottom"><button type="button" className="text-button" aria-expanded={options} aria-controls="search-options" onClick={() => setOptions(!options)}><SlidersHorizontal size={15} />Search options<ChevronDown size={14} className={options ? 'rotated' : ''} /></button><span id="postcode-hint" className="field-hint">Demo postcodes AB1–AB8</span></div>
    {options && <div id="search-options"><SearchOptions query={query} update={setQuery} showType={compact} /></div>}
    {query.needs.length > 0 && <div className="selected-topics chips">{query.needs.map(n => <ToggleChip key={n} label={needLabels[n]} selected onClick={() => setQuery({ ...query, needs: query.needs.filter(x => x !== n) })} />)}</div>}
  </form>;

  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="site-header"><div className="header-inner"><a className="brand" href="#/" onClick={e => { e.preventDefault(); freshSearch(); }} aria-label="Local Provision Finder home">Local Provision Finder</a><nav aria-label="Main navigation"><ServiceNotifications staff={staff} onNavigate={navigate}/><a className={route === '/' ? 'nav-link active' : 'nav-link'} href="#/" onClick={e => { e.preventDefault(); navigate('/'); }}>Find support</a><a className={`nav-link saved-nav ${route === '/saved' ? 'active' : ''}`} href="#/saved" onClick={e => { e.preventDefault(); navigate('/saved'); }}><Bookmark size={16} />Saved<span className="nav-count">{saved.length+directorySaved.length}</span></a>{staff ? <><a className={`nav-link review-nav ${route === '/feedback' ? 'active' : ''}`} href="#/feedback" onClick={e => { e.preventDefault(); navigate('/feedback'); }}><ClipboardCheck size={16} />Review</a><button className="staff-toggle enabled" onClick={() => { setStaff(false); if (route === '/review' || route === '/add-provision' || route === '/imports' || route === '/feedback' || route === '/suggestions') navigate('/'); }}><span className="live-dot" />Staff demo<X size={12} /></button></> : <button className="staff-toggle" onClick={() => { setStaff(true); setNotice('Staff demo enabled. Search rankings stay the same.'); }}>Staff sign in</button>}</nav></div></header>
    {staff && <div className="staff-strip"><div><ShieldCheck size={13} /><span>Staff demo · no real sign-in or restricted contacts</span><a href="#/feedback" onClick={e => { e.preventDefault(); navigate('/feedback'); }}>Review feedback<ArrowRight size={13} /></a></div></div>}
    <main id="main-content" tabIndex={-1}>
      {staff && ['/','/feedback','/suggestions','/imports','/add-provision'].includes(route) && <nav className="workspace-nav page-wrap" aria-label="Staff workspace"><a href="#/add-provision" aria-current={route==='/add-provision'?'page':undefined} onClick={e=>{e.preventDefault();navigate('/add-provision');}}>Add provision</a><a href="#/feedback" aria-current={route==='/feedback' ? 'page' : undefined} onClick={e=>{e.preventDefault();navigate('/feedback');}}>Service reports</a><a href="#/suggestions" aria-current={route==='/suggestions' ? 'page' : undefined} onClick={e=>{e.preventDefault();navigate('/suggestions');}}>Suggested services</a><a href="#/imports" aria-current={route==='/imports' ? 'page' : undefined} onClick={e=>{e.preventDefault();navigate('/imports');}}>Directory records</a></nav>}
      <div className="directory-home" hidden={route !== '/' || !!submitted}><section className="hero page-wrap"><div className="hero-copy"><h1>What do you need help with?</h1><p>Describe it in your own words. You don't need the right term.</p></div></section><section className="page-wrap finder-section" aria-label="Search local support"><MeetingDemo enabled={staff && route === '/' && !submitted}/><LocationSearch key={homeVisit} staff={staff}/><div className="suggest-service-entry"><p>Know a service that is missing?</p><button className="text-button" onClick={() => navigate("/suggest")}>Suggest a service<ArrowRight size={16}/></button></div></section></div>
      {route === '/add-provision' ? staff ? <ServiceSuggestions staff onNavigate={navigate}/> : <div className="page-wrap staff-gate"><h1>Add provision</h1><button className="button primary" onClick={()=>setStaff(true)}>Enter staff workspace</button></div> : route === '/suggest' ? <ServiceSuggestions onNavigate={navigate}/> : route === '/suggestions' ? <SuggestionReview staff={staff} enableStaff={() => setStaff(true)} onNavigate={navigate}/> : route.startsWith('/directory/') ? <div className="page-wrap directory-route"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={16}/>Back to results</button><ImportedServices key={route} staff={staff} directoryView initialId={decodeURIComponent(route.split('/')[2].split('?')[0])} feedbackOpen={route.includes('feedback=1')} feedbackContext={route.includes('context=recommended') ? 'recommended' : 'viewed'} enableStaff={() => {}} onNavigate={() => navigate('/')}/></div> : route === '/feedback' ? <FeedbackReview staff={staff} enableStaff={() => setStaff(true)} onNavigate={navigate}/> : route === '/imports' ? <ImportedServices staff={staff} enableStaff={() => setStaff(true)} onNavigate={navigate} /> : route === '/review' ? <ReviewPage staff={staff} enableStaff={() => setStaff(true)} services={services} decisions={decisions} decide={decide} reset={() => { setDecisions([]); saveLocal('lp-decisions-v1', []); setNotice('Review demo reset.'); }} onNavigate={navigate} /> : route === '/saved' ? <div className="page-wrap saved-page"><div className="page-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h1>Saved services</h1><p>{saved.length+directorySaved.length ? `${saved.length+directorySaved.length} saved services. Check the details before using them.` : 'Save services as you search, then compare them here.'}</p></div><button className="button secondary print-button" disabled={!saved.length && !directorySaved.length} onClick={() => window.print()}><Printer size={17} />Print shortlist</button></div><SavedDirectoryServices onNavigate={navigate}/>{savedServices.length ? <div className="saved-grid">{savedServices.map(service => <ServiceCard key={service.id} match={savedMatch(service)} saved toggleSaved={toggleSaved} onNavigate={navigate} />)}</div> : directorySaved.length ? null : <div className="empty-state panel"><Bookmark size={35} strokeWidth={1.3} /><h2>Your shortlist starts here</h2><p>Use the bookmark beside a service to keep it handy.</p><button className="button primary" onClick={() => navigate('/')}>Find support <ArrowRight size={17} /></button></div>}<p className="print-note">Your shortlist stays in this browser. Confirm details with the provider.</p></div> : route.startsWith('/service/') ? detailService ? <DetailPage key={detailService.id} service={detailService} saved={saved.includes(detailService.id)} toggleSaved={toggleSaved} onNavigate={navigate} feedback={feedback[detailService.id]} report={(id,note) => { setFeedback({ ...feedback, [id]: note }); setNotice('Feedback recorded for this browser session.'); }} /> : <div className="page-wrap empty-state"><h1>Service not found</h1><button className="button primary" onClick={() => navigate('/')}>Return to search</button></div> : route !== '/' && route !== '/demo' ? <div className="page-wrap empty-state"><h1>Page not found</h1><button className="button primary" onClick={freshSearch}>Return to search</button></div> : !submitted ? route === '/demo' ? <>
      <section className="hero page-wrap"><div className="hero-copy"><h1>What do you need help with?</h1><p>Describe it in your own words. You don't need the right term.</p></div></section>
      <section className="page-wrap finder-section" aria-label="Search local support">{route !== "/demo" ? <LocationSearch key={homeVisit} staff={staff}/> : <><div className="search-panel"><p className="field-hint">Fictional example search · AB1–AB8</p>{searchForm(false)}</div><div className="browse-row"><span>Not sure where to start?</span><button className="text-button" onClick={() => setBrowse(!browse)} aria-expanded={browse} aria-controls="browse-topics">Browse support topics<ChevronDown size={14} className={browse ? 'rotated' : ''} /></button></div>{browse && <div className="browse-topics chips" id="browse-topics">{topics.map(n => <ToggleChip key={n} label={needLabels[n]} selected={query.needs.includes(n)} onClick={() => setQuery({ ...query, needs: query.needs.includes(n) ? query.needs.filter(x => x !== n) : [...query.needs, n] })} />)}</div>}
        <div className="demo-example"><span className="demo-example-icon"><FileText size={19} /></span><div><strong>Take a quick look</strong><p>Try wellbeing and housing support in AB4.</p></div><button className="text-button" onClick={demoSearch}>Try example<ArrowRight size={16} /></button></div></>}
      </section>
      </> : null : <div className="page-wrap results-page"><div className="search-summary"><div><span className="eyebrow">YOUR SEARCH</span><h2>{submitted.text || submitted.needs.map(n => needLabels[n]).join(', ') || 'All support'}<span>in {submitted.postcode}</span></h2><p>Up to {submitted.radius} {submitted.radius === 1 ? 'mile' : 'miles'}{submitted.includeRemote ? ' · online & phone included' : ''}{submitted.practical.length ? ` · ${submitted.practical.map(n => practicalLabels[n].toLowerCase()).join(', ')}` : ''}</p></div><div className="button-row"><button className="button secondary small" onClick={() => { setEditing(!editing); setQuery(submitted); }} aria-expanded={editing}>Change search</button><button className="icon-button" aria-label="Start a new search" onClick={freshSearch}><RotateCcw size={17} /></button></div></div>{editing && <div className="search-panel edit-panel">{searchForm(true)}</div>}
      {result?.urgent && <div className="notice urgent"><CircleAlert size={20} /><div><strong>Urgent support may be needed</strong><p>These fictional listings are not verified emergency routes. Address immediate concerns before comparing longer-term support.</p></div></div>}
      <div className="results-toolbar"><div><h1 ref={resultsRef} tabIndex={-1}>{result?.matches.length ?? 0} {result?.matches.length === 1 ? 'service' : 'services'} to explore<span className="result-dot" /></h1><p>Matched to your needs, with checks made clear.</p></div><button className={`button secondary small ${filters ? 'pressed' : ''}`} aria-expanded={filters} aria-controls="results-filters" onClick={() => { setFilters(!filters); setQuery(submitted); }}><SlidersHorizontal size={15} />Filters{(submitted.practical.length > 0 || !!submitted.providerType) && <span className="filter-dot" />}</button></div>
      {filters && <form id="results-filters" className="filter-panel panel" onSubmit={submit}><div className="filter-heading"><h2>Refine these results</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={() => setFilters(false)}><X size={18} /></button></div><SearchOptions query={query} update={setQuery} showType /><div className="button-row"><button className="button primary small" type="submit">Apply filters<ArrowRight size={15} /></button><button className="text-button" type="button" onClick={() => { const clean = { ...submitted, practical: [], providerType: '' }; setQuery(clean); runSearch(clean); }}>Clear extra filters</button></div></form>}
      {result && result.needs.length > 0 && <div className="interpreted-needs"><span>Looking for</span>{result.needs.map(n => <span className="need-label" key={n}>{needLabels[n]}</span>)}</div>}
      {result && result.unmetNeeds.length > 0 && <div className="coverage-gap"><div className="gap-icon"><Layers3 size={19} /></div><div><strong>{result.matches.length ? 'Part of your search still needs support' : 'There’s a gap in this search'}</strong><p>No matching {result.unmetNeeds.map(n => needLabels[n].toLowerCase()).join(' or ')} service is listed for {submitted.postcode} with these options. The demo catalogue may be incomplete.</p></div></div>}
      <div className="result-list" aria-live="polite">{result?.matches.map(match => <ServiceCard key={match.service.id} match={match} saved={saved.includes(match.service.id)} toggleSaved={toggleSaved} onNavigate={navigate} />)}</div>
      {!result?.matches.length && <div className="empty-state panel"><Search size={30} strokeWidth={1.5} /><h2>No matching services in this search</h2><p>Try different words or change the distance. We won’t invent services to fill the gap.</p><div className="button-row"><button className="button secondary small" onClick={() => { setEditing(true); setQuery(submitted); }}>Change search</button>{submitted.radius < 10 && <button className="button secondary small" onClick={() => runSearch({ ...submitted, radius: 10 })}>Widen to 10 miles</button>}{!submitted.includeRemote && <button className="button secondary small" onClick={() => runSearch({ ...submitted, includeRemote: true })}>Include online & phone</button>}</div></div>}
      {!!result?.farther.length && <div className="farther-panel"><MapPin size={21} /><div><strong>{result.farther.length} more {result.farther.length === 1 ? 'option' : 'options'} outside your travel distance</strong><p>Closest is {Math.min(...result.farther.map(m => m.service.distanceMiles))} miles away. Your current limit is {submitted.radius} miles.</p></div><button className="text-button" onClick={() => runSearch({ ...submitted, radius: Math.max(3, ...result.farther.map(m => Math.ceil(m.service.distanceMiles))) })}>Show farther options<ArrowRight size={16} /></button></div>}
      <div className="results-end"><ShieldCheck size={15} /><p>Sample distances, fictional providers. Check requirements and availability before taking the next step.</p></div>
      </div>}
    </main>
    <footer className="site-footer"><div className="footer-inner"><div><a className="footer-brand" href="#/" onClick={e => { e.preventDefault(); freshSearch(); }}>Local Provision Finder</a></div><div className="footer-note"><p>Bristol · Kingston upon Thames · Buckinghamshire</p></div></div></footer>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><CheckCircle2 size={17} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></>}</div>
  </>;
}
