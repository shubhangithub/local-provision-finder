import { useState, type FormEvent } from 'react';
import { staffHeaders } from './ServiceEnrichment';
import '../styles/follow-ups.css';
const MAX = 5;
interface Service { id: string; name: string }
/** Shown when a meeting ends: arranges a follow-up call about the services the customer ticked. Staff enter the details with the customer present. */
export default function FollowUpOffer({ services }: { services: Service[] }) {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = services.slice(0, MAX);
  if (!services.length) return <section className="followup-offer" aria-labelledby="followup-offer-title"><h3 id="followup-offer-title">Follow-up call</h3><p>Tick services during the meeting to arrange a follow-up call about them.</p></section>;
  if (saved) return <section className="followup-offer" aria-labelledby="followup-offer-title"><h3 id="followup-offer-title">Follow-up call</h3>
    <p role="status"><strong>Follow-up arranged</strong> for {firstName.trim() || 'the customer'}. <a href="#/follow-ups">Follow-ups</a></p></section>;
  async function submit(event: FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const response = await fetch('/api/follow-ups', { method: 'POST', headers: staffHeaders, body: JSON.stringify({ firstName, phone, agreed: true, services: chosen.map(service => ({ id: service.id })) }) });
      const data = await response.json();if (!response.ok) throw new Error(data.error);
      setPhone('');setSaved(true);window.dispatchEvent(new Event('follow-ups-changed'));
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not arrange the follow-up.');} finally {setBusy(false);}
  }
  return <section className="followup-offer" aria-labelledby="followup-offer-title">
    <h3 id="followup-offer-title">Ask for a follow-up call</h3>
    <form onSubmit={submit} noValidate>
      <div className="followup-fields">
        <div className="field"><label htmlFor="followup-name">First name (optional)</label><input id="followup-name" autoComplete="off" maxLength={40} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
        <div className="field"><label htmlFor="followup-phone">Phone number</label><input id="followup-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="followup-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Arrange call'}</button></div>
    </form>
  </section>;
}
