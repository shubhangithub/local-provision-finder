import './styles/ui-polish.css';
import StaffMenu from './components/StaffMenu';
import SaveServiceButton from './components/SaveServiceButton';
import ShortlistActions from './components/ShortlistActions';
import StaffSignIn from './components/StaffSignIn';
import PageWidthClaim from './components/PageWidthClaim';
import { forgetStaffSession, readStaffSession, rememberStaffSession } from './lib/staff-session';
import ServiceSuggestions from './components/ServiceSuggestions';
import SuggestionReview from './components/SuggestionReview';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, ArrowUpRight, Bookmark, X, Check, ShieldCheck, CircleAlert, RotateCcw, ClipboardCheck, LockKeyhole, MessageSquare, CheckCircle2, Globe } from 'lucide-react';
import { catalogue, changes, pathways } from './data/catalogue';
import { effectiveStatus } from './lib/search';
import { applyDecisions, canPublish } from './lib/review';
import { readDecisions, readSaved, saveLocal } from './lib/storage';
import ServiceCard, { formatDate, serviceIcon } from './components/ServiceCard';
import ImportedServices from './components/ImportedServices';
import LocationSearch from './components/LocationSearch';
import MeetingDemo from './components/MeetingDemo';
import CustomerSummary from './components/CustomerSummary';
import DirectoryAgent from './components/DirectoryAgent';
import { askAgent, summaryAgentContext, type AgentContext } from './lib/agent';
import type { CustomerDocument } from './lib/meeting';
import { ChangeAdvisor } from './components/ReviewAdvisor';
import FeedbackReview from './components/FeedbackReview';
import RecentlyEnriched from './components/RecentlyEnriched';
import SavedDirectoryServices from './components/SavedDirectoryServices';
import { readDirectorySaved } from './lib/directory-saved';
import ServiceNotifications from './components/ServiceNotifications';
import RegionMenu from './components/RegionMenu';
import type { ProposedChange, ReviewDecision, Service, ServiceMatch } from './types';

/** The retired #/demo address lands on the standard search page. */
function currentRoute() {
  const route = location.hash.slice(1) || '/';
  if (route !== '/demo') return route;
  history.replaceState(null, '', location.pathname);
  return '/';
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
    <div className="detail-hero"><div className="service-icon large"><Icon size={29} strokeWidth={1.5} /></div><div className="detail-title"><p className="eyebrow">{service.providerType} · {service.id}</p><h1>{service.name}</h1><p>{service.category} · {service.delivery}</p></div><SaveServiceButton saved={saved} name={service.name} onToggle={()=>toggleSaved(service.id)}/></div>
    {(service.coverageConflict || service.venueConflict || status !== 'Verified') && <div className="notice warning"><CircleAlert size={19} /><div><strong>{service.coverageConflict ? 'Check area coverage before using this service' : service.venueConflict ? 'Check the venue before travelling' : 'Some details need checking'}</strong><p>{service.coverageConflict ? 'The catalogue lists AB4, but a proposed update says sources disagree about North and East coverage. This needs human verification.' : service.venueConflict ? 'A provider update suggests a venue change. The proposed address has not been verified.' : 'The record is due for review or potentially outdated. Confirm the details with the provider.'}</p></div></div>}
    <div className="detail-grid grid-main-side"><div className="detail-main">
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
    <div className="import-entry"><div><strong>Browse the imported directory</strong><p>Full service text and published contacts, held for review.</p></div><button className="text-button" onClick={() => onNavigate('/imports')}>Imported services<ArrowRight size={15} /></button></div><div className="review-toolbar"><div className="tabs" role="group" aria-label="Review list"><button aria-pressed={filter==='pending'} className={filter==='pending'?'active':''} onClick={() => setFilter('pending')}>To review <span>{pending.length}</span></button><button aria-pressed={filter==='history'} className={filter==='history'?'active':''} onClick={() => setFilter('history')}>Decision history <span>{decisions.length}</span></button></div><button className="text-button muted" onClick={() => setResetOpen(!resetOpen)}><RotateCcw size={14} />Reset demo</button></div>
    {resetOpen && <div className="notice warning"><div><strong>Reset all review decisions?</strong><p>This restores the original catalogue. Your saved list is kept.</p><div className="button-row"><button className="button secondary small" onClick={() => { reset(); setResetOpen(false); }}>Reset decisions</button><button className="text-button" onClick={() => setResetOpen(false)}>Cancel</button></div></div></div>}
    <div className="review-list">{!listed.length && <div className="empty-state panel"><CheckCircle2 size={32} /><h2>{filter === 'pending' ? 'All caught up' : 'No decisions yet'}</h2><p>{filter === 'pending' ? 'Your decisions are in the history tab.' : 'Review a proposed change to start the history.'}</p></div>}{listed.map(change => {
      const service = services.find(s => s.id === change.serviceId)!;
      const decision = decisions.find(d => d.updateId === change.id);
      return <article className="review-card" key={change.id}><div className="review-card-heading"><div><div className="review-meta"><span className={`change-type ${['Closure','Eligibility'].includes(change.field) ? 'high-risk' : ''}`}>{change.field} change</span><span>{change.id} · {change.sourceType}</span></div><h2><a href={`#/service/${service.id}`} onClick={e => { e.preventDefault(); onNavigate(`/service/${service.id}`); }}>{service.name}<ArrowUpRight size={16} /></a></h2></div><span className="confidence-tag">{change.confidence} evidence</span></div><div className="diff-row"><div><span>Previously listed</span><p>{change.oldValue}</p></div><ArrowRight size={18} /><div><span>Proposed update</span><p>{change.newValue}</p></div></div>{!decision && <ChangeAdvisor change={change} />}<div className="review-bottom"><p><CircleAlert size={14} />{change.recommendedAction}{change.field === 'New service' && ' · already in catalogue; reconcile before publication'}</p>{decision ? <span className={`decision-badge ${decision.status}`}><Check size={14} />{decision.status === 'published' ? 'Published' : decision.status === 'held' ? 'Held for checking' : 'Rejected'} · {formatDate(decision.decidedOn.slice(0,10))}</span> : <button className="button secondary small" onClick={e => { opener.current = e.currentTarget; setSelected(change); setVerified(false); }}>Review change <ArrowRight size={15} /></button>}</div></article>;
    })}</div>
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); closeDialog(); }} className="review-dialog" aria-labelledby="dialog-title"><div className="dialog-heading"><p className="eyebrow">HUMAN REVIEW</p><button className="icon-button" aria-label="Close review" onClick={closeDialog}><X size={20} /></button></div>{selected && <><h2 id="dialog-title">Check this {selected.field.toLowerCase()} change</h2><p>{services.find(s => s.id === selected.serviceId)?.name}</p><div className="inset"><strong>{selected.oldValue} → {selected.newValue}</strong><p>Detected {formatDate(selected.detectedOn)} from {selected.sourceType.toLowerCase()}. Evidence: {selected.confidence.toLowerCase()}.</p></div><ChangeAdvisor change={selected} /><p className="field-hint">This is a fictional verification exercise. No live provider has been contacted.</p>{selected.field === 'New service' ? <div className="notice warning"><p>This service is already listed. Hold for reconciliation or reject the duplicate proposal. New public listings also need vetting and a verified link.</p></div> : <label className="checkbox-label verify-checkbox"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /><span>I have checked the evidence for this specific field in the demo.</span></label>}<div className="dialog-actions"><button className="button primary" disabled={!canPublish(selected, verified)} onClick={() => { decide(selected, 'published', verified); closeDialog(); }}>Publish checked change</button><button className="button secondary" onClick={() => { decide(selected, 'held', false); closeDialog(); }}>Hold for checking</button><button className="text-button danger" onClick={() => { decide(selected, 'rejected', false); closeDialog(); }}>Reject change</button></div></>}</dialog>
  </div>;
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [staff, setStaff] = useState(readStaffSession);
  const [customerDocument, setCustomerDocument] = useState<CustomerDocument|null>(null);
  const meetingPage = route === '/meeting' || route === '/meeting/summary';
  const [directorySaved,setDirectorySaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setDirectorySaved(readDirectorySaved());window.addEventListener("directory-saved-changed",update);window.addEventListener("storage",update);return () => {window.removeEventListener("directory-saved-changed",update);window.removeEventListener("storage",update);};},[]);
  const [saved, setSaved] = useState(readSaved);
  const [decisions, setDecisions] = useState(readDecisions);
  const [feedback, setFeedback] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [signInOpen,setSignInOpen]=useState(false);
  const services = useMemo(() => applyDecisions(catalogue, changes, decisions), [decisions]);
  const pendingCount = changes.length - decisions.length;
  useEffect(() => {
    const handleRoute = () => { setRoute(currentRoute()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', handleRoute); window.addEventListener('popstate', handleRoute);
    return () => { window.removeEventListener('hashchange', handleRoute); window.removeEventListener('popstate', handleRoute); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const title = route === '/suggest-service' ? 'Suggest a provision or resource' : route === '/add-provision' ? 'Add a service' : route === '/meeting/summary' ? 'Customer summary' : route === '/meeting' ? 'Customer meeting' : route.startsWith('/service/') ? services.find(s => s.id === route.split('/')[2])?.name : route === '/feedback' ? 'Review feedback' : route.startsWith('/directory/') ? 'Service details' : route === '/imports' ? 'Imported services' : route === '/review' ? 'Review changes' : route === '/saved' ? 'Saved services' : 'Find your next step';
    document.title = `${title ?? 'Service not found'} — Local Provision`;
  }, [route, services]);
  // True while the open service was reached from the results list, so Back returns to them instead of adding history.
  const openedFromResults = useRef(false);
  const directoryId = route.startsWith('/directory/') ? decodeURIComponent(route.split('/')[2].split('?')[0]) : null;
  function signOut() {
    forgetStaffSession();setStaff(false);
    if (['/review','/add-provision','/imports','/feedback','/enriched','/suggestions'].includes(route) || meetingPage) navigate('/');
  }
  function navigate(next: string) {
    if (route === next) return;
    if (!next.startsWith('/directory/')) openedFromResults.current = false;
    location.hash = next;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
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
  function freshSearch() { setHomeVisit(value => value + 1); navigate('/'); }
  const detailService = route.startsWith('/service/') ? services.find(s => s.id === route.split('/')[2]) : null;
  const savedServices = services.filter(s => saved.includes(s.id));
  const savedMatch = (service: Service): ServiceMatch => ({ service, score: 0, matchedNeeds: [], reasons: [service.category], missingPractical: [] });
  const agentContext:AgentContext|undefined = route === '/meeting/summary' && customerDocument ? summaryAgentContext(customerDocument) : detailService ? {title:detailService.name,searchText:detailService.category+' '+detailService.needs.join(' '),facts:[`${detailService.name}: ${detailService.category}.`, `Availability: ${detailService.availability}. Who it is for: ${detailService.eligibilitySummary}.`, `Listed areas: ${detailService.postcodePrefixes.join(', ')}. Access: ${detailService.referralRoute}.`, `Record status: ${effectiveStatus(detailService)}. Last checked: ${detailService.lastVerified}.`, detailService.coverageConflict ? 'Resolve the conflicting coverage information before recommending this service.' : detailService.venueConflict ? 'Confirm the current venue before recommending this service.' : 'Confirm current availability and practical access with the provider.'],prompts:['Explain this service','What details need checking?','Find similar provision']} : route === '/saved' ? {title:'Saved provision',facts:[...savedServices.map(service=>`${service.name}: ${service.category}; ${service.availability}; listed for ${service.postcodePrefixes.join(', ')}.`),...directorySaved.map(service=>`${service.name}: ${service.provider}; ${service.postcode ?? 'postcode not supplied'}.`),savedServices.length+directorySaved.length ? 'Compare eligibility, location, current availability and accessibility with the providers.' : 'No services are saved yet. Use a service’s bookmark to start your shortlist.'],prompts:['Compare my saved provision','Find alternatives','What should I check before a referral?']} : undefined;

  return <><StaffSignIn open={signInOpen} onClose={()=>setSignInOpen(false)} onSuccess={()=>{rememberStaffSession();setStaff(true);setSignInOpen(false);setNotice('Staff demo enabled.');}}/><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="site-header"><div className="header-inner"><a className="brand" href="#/" onClick={e => { e.preventDefault(); freshSearch(); }} aria-label="Local Provision Finder home">Local Provision Finder</a><nav aria-label="Main navigation"><RegionMenu/><ServiceNotifications onNavigate={navigate}/><button className="agent-header-trigger" onClick={()=>askAgent()}><MessageSquare size={17}/>Ask agent</button><a className={route === '/' ? 'nav-link active' : 'nav-link'} href="#/" onClick={e => { e.preventDefault(); navigate('/'); }}>Find support</a><a className={`nav-link saved-nav ${route === '/saved' ? 'active' : ''}`} href="#/saved" onClick={e => { e.preventDefault(); navigate('/saved'); }}><Bookmark size={18} strokeWidth={1.75} aria-hidden="true"/>Saved<span className="nav-count">{saved.length+directorySaved.length}</span></a>{staff ? <StaffMenu route={route} onNavigate={navigate} onSignOut={signOut}/> : <button className="staff-toggle" onClick={() => { setSignInOpen(true); }}>Staff sign in</button>}</nav></div></header>
    <main id="main-content" tabIndex={-1} className={meetingPage ? 'meeting-main' : undefined}>
      {route === '/meeting' && <PageWidthClaim width="wide"/>}
      <div className="page-wrap" hidden={route !== '/meeting'}><MeetingDemo enabled={staff && meetingPage}/></div>
      {(route === '/' || directoryId) && <LocationSearch key={homeVisit} staff={staff} selectedId={directoryId} feedbackOpen={route.includes('feedback=1')} feedbackContext={route.includes('context=recommended') ? 'recommended' : 'viewed'} onSelect={id => {openedFromResults.current=true;navigate(`/directory/${encodeURIComponent(id)}`);}} onBack={() => {if (openedFromResults.current) {openedFromResults.current=false;history.back();} else navigate('/');}}/>}
      {route === '/suggest-service' ? <ServiceSuggestions onNavigate={navigate}/> : route === '/add-provision' ? staff ? <ServiceSuggestions staff onNavigate={navigate}/> : <div className="page-wrap staff-gate"><h1>Add a service</h1><button className="button primary" onClick={()=>setSignInOpen(true)}>Enter staff workspace</button></div> : route === '/meeting/summary' ? <CustomerSummary document={customerDocument} onChange={setCustomerDocument} onBack={()=>navigate('/meeting')} onNotify={setNotice}/> : route === '/meeting' ? !staff && <div className="page-wrap staff-gate"><h1>Customer meeting</h1><button className="button primary" onClick={()=>setSignInOpen(true)}>Enter staff workspace</button></div> : route === '/suggestions' ? <SuggestionReview staff={staff} enableStaff={()=>setSignInOpen(true)} onNavigate={navigate}/> : route === '/enriched' ? <RecentlyEnriched staff={staff} enableStaff={() => setSignInOpen(true)}/> : route === '/feedback' ? <FeedbackReview staff={staff} enableStaff={() => setSignInOpen(true)} onNavigate={navigate}/> : route === '/imports' ? <ImportedServices staff={staff} enableStaff={() => setSignInOpen(true)} onNavigate={navigate} /> : route === '/review' ? <ReviewPage staff={staff} enableStaff={() => setSignInOpen(true)} services={services} decisions={decisions} decide={decide} reset={() => { setDecisions([]); saveLocal('lp-decisions-v1', []); setNotice('Review demo reset.'); }} onNavigate={navigate} /> : route === '/saved' ? <div className="page-wrap saved-page"><div className="page-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h1>Saved services</h1><p>{saved.length+directorySaved.length ? `${saved.length+directorySaved.length} saved ${saved.length+directorySaved.length===1?'service':'services'}. Check the details before using them.` : 'Save services as you search, then compare them here.'}</p></div></div><ShortlistActions items={[...directorySaved.map(item=>({...item,directory:true})),...savedServices.map(item=>({id:item.id,name:item.name,provider:item.providerType,eligibilitySummary:item.eligibilitySummary,referralRoute:item.referralRoute,url:item.sourceUrl}))]}/><SavedDirectoryServices onNavigate={navigate}/>{savedServices.length ? <div className="saved-grid">{savedServices.map(service => <ServiceCard key={service.id} headingLevel={2} match={savedMatch(service)} saved toggleSaved={toggleSaved} onNavigate={navigate} />)}</div> : directorySaved.length ? null : <div className="empty-state panel"><Bookmark size={36} strokeWidth={1.5} aria-hidden="true"/><h2>Your shortlist starts here</h2><p>Use the bookmark beside a service to keep it handy.</p><button className="button primary" onClick={() => navigate('/')}>Find support <ArrowRight size={17} /></button></div>}<p className="print-note">Your shortlist stays in this browser. Confirm details with the provider.</p></div> : route.startsWith('/service/') ? detailService ? <DetailPage key={detailService.id} service={detailService} saved={saved.includes(detailService.id)} toggleSaved={toggleSaved} onNavigate={navigate} feedback={feedback[detailService.id]} report={(id,note) => { setFeedback({ ...feedback, [id]: note }); setNotice('Feedback recorded for this browser session.'); }} /> : <div className="page-wrap empty-state"><h1>Service not found</h1><button className="button primary" onClick={() => navigate('/')}>Return to search</button></div> : route !== '/' ? <div className="page-wrap empty-state"><h1>Page not found</h1><button className="button primary" onClick={freshSearch}>Return to search</button></div> : null}
    </main>
    <DirectoryAgent route={route} staff={staff} context={agentContext} onNavigate={navigate}/>
    {!meetingPage && <footer className="site-footer"><div className="footer-inner"><div><a className="footer-brand" href="#/" onClick={e => { e.preventDefault(); freshSearch(); }}>Local Provision Finder</a></div><div className="footer-note"><a href="#/suggest-service" onClick={event=>{event.preventDefault();navigate('/suggest-service');}}>Suggest a provision or resource</a><p>Bristol · Kingston upon Thames · Buckinghamshire</p></div></div></footer>}
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><CheckCircle2 size={17} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></>}</div>
  </>;
}
