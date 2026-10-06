import { useState, type FormEvent } from 'react';
import { staffHeaders } from './ServiceEnrichment';
import '../styles/follow-ups.css';
const MAX = 5;
interface Service { id: string; name: string }
/** Shown when a meeting ends: arranges a follow-up call about the services the customer ticked. Staff enter the details with the customer present. */
export default function FollowUpOffer({ services }: { services: Service[] }) {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<'form' | 'saved' | 'skipped'>('form');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = services.slice(0, MAX);
  if (!services.length) return <section className="followup-offer" aria-labelledby="followup-offer-title"><h3 id="followup-offer-title">Follow-up call</h3><p>Tick services during the meeting to arrange a follow-up call about them.</p></section>;
  if (state === 'skipped') return <section className="followup-offer" aria-labelledby="followup-offer-title"><h3 id="followup-offer-title">Follow-up call</h3><p role="status">No follow-up call arranged.</p></section>;
  if (state === 'saved') return <section className="followup-offer" aria-labelledby="followup-offer-title"><h3 id="followup-offer-title">Follow-up call</h3>
    <p role="status"><strong>Follow-up arranged</strong> for {firstName.trim() || 'the customer'}, about {chosen.length} {chosen.length === 1 ? 'service' : 'services'}. <span className="followup-sandbox">Sandbox demo</span></p>
    <p>It will be placed in about a week. To place it now, open <a href="#/follow-ups">Follow-ups</a>.</p></section>;
  async function submit(event: FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const response = await fetch('/api/follow-ups', { method: 'POST', headers: staffHeaders, body: JSON.stringify({ firstName, phone, agreed, services: chosen.map(service => ({ id: service.id })) }) });
      const data = await response.json();if (!response.ok) throw new Error(data.error);
      setPhone('');setState('saved');window.dispatchEvent(new Event('follow-ups-changed'));
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not arrange the follow-up.');} finally {setBusy(false);}
  }
  return <section className="followup-offer" aria-labelledby="followup-offer-title">
    <h3 id="followup-offer-title">Ask for a follow-up call</h3>
    <p>About a week from now we can ring the customer to ask how it went with the services they chose.</p>
    <ul className="followup-services" aria-label="Services the call will ask about">{chosen.map(service => <li key={service.id}>{service.name}</li>)}</ul>
    {services.length > MAX && <p className="field-hint">Only the first {MAX} can be asked about on one call.</p>}
    <form onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="followup-name">Customer's first name (optional)</label><input id="followup-name" autoComplete="off" maxLength={40} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
      <div className="field"><label htmlFor="followup-phone">Customer's phone number</label><input id="followup-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <label className="checkbox-label"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>The customer agreed to a follow-up call</span></label>
      <p className="field-hint">Only staff can see the number, and it is deleted after the call. <span className="followup-sandbox">Sandbox demo: no real call is made yet.</span></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="followup-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Arrange follow-up call'}</button><button className="text-button" type="button" onClick={() => setState('skipped')}>Skip</button></div>
    </form>
  </section>;
}
