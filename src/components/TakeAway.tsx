import { useState, type FormEvent } from 'react';
import '../styles/next-steps.css';
/** The last box of the ended meeting: print the next steps or send the customer a copy. */
export default function TakeAway({ hasSteps }: { hasSteps: boolean }) {
  const [panel, setPanel] = useState<'email' | 'phone'>('email');
  const [sharing, setSharing] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState('');
  const [fieldError, setFieldError] = useState('');
  function send(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) { setFieldError(panel === 'email' ? 'Enter an email address' : 'Enter a mobile phone number'); return; }
    setFieldError(''); setSent(`${panel === 'email' ? 'Email' : 'Text message'} to ${value.trim()}`); setSharing(false); setValue('');
  }
  if (!hasSteps) return null;
  return <section className="meeting-box take-away no-print" aria-labelledby="take-away-title">
    <h3 id="take-away-title">Take this away</h3>
    <p>Give the customer a copy of their next steps.</p>
    <div className="ns-actions">
      <button type="button" className="button primary" onClick={() => window.print()}>Print or save as PDF</button>
      <button type="button" className="button secondary" aria-expanded={sharing} onClick={() => { setSharing(!sharing); setSent(''); setFieldError(''); }}>Send a copy</button>
    </div>
    {sharing && <form className="ns-share" onSubmit={send} noValidate>
      <fieldset><legend>Send these steps by</legend>
        <label className="ns-choice"><input type="radio" name="ns-via" checked={panel === 'email'} onChange={() => { setPanel('email'); setFieldError(''); }} /> Email</label>
        <label className="ns-choice"><input type="radio" name="ns-via" checked={panel === 'phone'} onChange={() => { setPanel('phone'); setFieldError(''); }} /> Text message</label>
      </fieldset>
      <label htmlFor="ns-share">{panel === 'email' ? 'Email address' : 'Mobile phone number'}</label>
      {fieldError && <p className="ns-error" role="alert">Error: {fieldError}</p>}
      <input id="ns-share" type={panel === 'email' ? 'email' : 'tel'} autoComplete={panel === 'email' ? 'email' : 'tel'} value={value} onChange={event => setValue(event.target.value)} autoFocus />
      <button className="button primary">{panel === 'email' ? 'Send email' : 'Send text message'}</button> <button type="button" className="text-button" onClick={() => setSharing(false)}>Cancel</button>
    </form>}
    {sent && <div className="ns-banner" role="status"><strong>Not sent (prototype)</strong><p>{sent} is not wired up yet, so nothing was sent. Use “Print or save as PDF” to keep a copy.</p></div>}
  </section>;
}
