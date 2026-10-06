import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { staffHeaders } from './ServiceEnrichment';
import '../styles/follow-ups.css';
interface FollowUp { id: string; personName: string | null; services: { id: string; name: string }[]; status: 'scheduled' | 'requested' | 'completed' | 'denied' | 'failed' | 'expired'; consentedAt: string; outcome: string | null; reason: string | null; reportIds: string[] }
const outcomeLabels: Record<string, string> = { answered: 'Customer answered.', partly_answered: 'Customer answered some questions.', declined: 'Customer declined to talk.', wrong_person: 'Someone else answered, so nothing was recorded.' };
const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export default function FollowUps({ staff, enableStaff, onNavigate }: { staff: boolean; enableStaff: () => void; onNavigate: (route: string) => void }) {
  const [items, setItems] = useState<FollowUp[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/follow-ups', { headers: staffHeaders });const data = await response.json();if (!response.ok) throw new Error(data.error);
      setConfigured(data.configured);setItems(data.followUps);setError('');
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not load follow-ups.');}
  }, []);
  useEffect(() => { if (staff) void load(); }, [staff, load]);
  // A placed call is checked every few seconds until it ends; checking is what records its result.
  const waiting = (items ?? []).filter(item => item.status === 'requested').map(item => item.id).join(',');
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(async () => {
      for (const id of waiting.split(',')) {await fetch(`/api/follow-ups?id=${encodeURIComponent(id)}`, { headers: staffHeaders }).catch(() => undefined);}
      await load();window.dispatchEvent(new Event('directory-updated'));
    }, 3000);
    return () => clearTimeout(timer);
  }, [waiting, items, load]);
  async function call(id: string) {
    setBusy(id);setError('');
    try {
      const response = await fetch('/api/follow-ups/call', { method: 'POST', headers: staffHeaders, body: JSON.stringify({ id }) });const data = await response.json();if (!response.ok) throw new Error(data.error);
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not place the call.');} finally {setBusy('');await load();}
  }
  if (!staff) return <div className="page-wrap"><div className="panel staff-gate"><Phone size={34} /><h1>Follow-ups</h1><p>See the follow-up calls arranged at the end of meetings, and place them.</p><button className="button primary" onClick={enableStaff}>Enter staff workspace<ArrowRight size={17} /></button></div></div>;
  return <div className="page-wrap follow-ups-page">
    <div className="page-heading"><div><h1>Follow-ups</h1><p>Calls arranged at the end of meetings. They are due in about a week; place one now to see how it works. <span className="followup-sandbox">Sandbox demo</span></p></div></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!configured && <p className="field-hint" role="note">Follow-up calls are not configured. Set GOV_HACK_URL and GOV_HACK_API_TOKEN on the server.</p>}
    {items === null ? !error && <p role="status">Loading…</p> : !items.length ? <div className="panel empty-state"><h2>No follow-ups yet</h2><p>Follow-ups are arranged at the end of a meeting, once the customer has ticked services.</p></div> : <ul className="follow-up-list">
      {items.map(item => <li key={item.id} className="follow-up-row">
        <div className="follow-up-main">
          <h2>{item.personName || 'Customer'}</h2>
          <p className="follow-up-services">{item.services.map(service => service.name).join(' · ')}</p>
          <p className="follow-up-status">
            {item.status === 'scheduled' && <>Arranged {date(item.consentedAt)}. Scheduled in about 1 week.</>}
            {item.status === 'requested' && <span role="status">Call in progress…</span>}
            {item.status === 'completed' && <span role="status">Done. {outcomeLabels[item.outcome ?? ''] ?? ''}{item.reportIds.length ? <> {item.reportIds.length} {item.reportIds.length === 1 ? 'change' : 'changes'} to review in <a href="#/feedback" onClick={e => { e.preventDefault(); onNavigate('/feedback'); }}>Service reports</a>.</> : ' Nothing to review.'}</span>}
            {(item.status === 'denied' || item.status === 'failed') && <span role="alert">The call did not go ahead: {item.reason || 'no reason given'}</span>}
            {item.status === 'expired' && <>The number was deleted after 30 days, so this call can no longer be placed.</>}
          </p>
        </div>
        <div className="follow-up-actions">
          {['scheduled', 'denied', 'failed'].includes(item.status) && <button type="button" className="button primary" disabled={!configured || busy === item.id} onClick={() => void call(item.id)}>{item.status === 'scheduled' ? 'Follow up now' : 'Try again'}<span className="visually-hidden"> for {item.personName || 'the customer'}</span></button>}
          <span className="followup-sandbox">Sandbox demo</span>
        </div>
      </li>)}
    </ul>}
  </div>;
}
