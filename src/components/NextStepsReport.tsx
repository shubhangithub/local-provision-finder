import { useEffect, useState, type FormEvent } from 'react';
import '../styles/next-steps.css';
import type { MeetingChoice } from './LiveServices';

interface Detail {
  publicPhone?: string | null; publicEmail?: string | null; url?: string | null; address?: string | null;
  openingTimes?: string | null; referralRoute?: string | null; eligibilitySummary?: string | null; cost?: string | null; postcode?: string | null;
}
const ACCESS: Record<string, string> = {
  none: 'Contact them directly', 'self referral': 'Refer yourself', assessment: 'You will have an assessment first',
  appointment: 'Book an appointment', 'drop-in': 'Drop in, no booking needed', internal: 'Ask a professional to refer you', external: 'Ask a professional to refer you',
};
const clean = (value?: string | null) => (value ?? '').trim();
const address = (value?: string | null) => clean(value).split(',').map(part => part.trim()).filter(part => part && !/^(n\/a|telephone only)$/i.test(part)).join(', ');
const website = (value?: string | null) => { try { const url = new URL(clean(value)); return ['http:', 'https:'].includes(url.protocol) && !/example\.(com|org)$/.test(url.hostname) ? url.href : ''; } catch { return ''; } };
export const longDate = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function stepRows(detail: Detail | undefined, fallbackPostcode: string | null) {
  const d = detail ?? {};
  const phone = clean(d.publicPhone), email = clean(d.publicEmail), site = website(d.url), where = address(d.address) || clean(d.postcode) || clean(fallbackPostcode);
  const action = phone ? `Call ${phone}` : email ? `Email ${email}` : site ? `Visit ${site}` : where ? `Go to ${where}` : 'Look up their contact details';
  const access = clean(d.referralRoute);
  const rows: [string, string][] = [
    ['Phone', phone], ['Email', email], ['Website', site], ['Address', where],
    ['Opening times', clean(d.openingTimes).split(';').map(part => part.trim()).filter(Boolean).join('; ')],
    ['How to get this help', ACCESS[access.toLowerCase()] ?? access],
    ['Who it is for', clean(d.eligibilitySummary).replace(/\s*>\s*/g, ': ')], ['Cost', clean(d.cost)],
  ];
  return { action, rows: rows.filter(([, value]) => value) };
}

export default function NextStepsReport({ choices, fallback, topics, endedAt }: { choices: MeetingChoice[]; fallback: MeetingChoice[]; topics: string[]; endedAt: number }) {
  const usingFallback = !choices.length;
  const steps = usingFallback ? fallback : choices;
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [panel, setPanel] = useState<'email' | 'phone' | null>(null);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState('');
  const [fieldError, setFieldError] = useState('');
  const key = steps.map(step => step.service.id).join(',');
  useEffect(() => {
    let current = true;
    steps.forEach(async ({ service }) => {
      try {
        const response = await fetch(`/api/imports/service?id=${encodeURIComponent(service.id)}`);
        const data = await response.json();
        if (current && response.ok && data.record) setDetails(previous => ({ ...previous, [service.id]: data.record }));
      } catch { /* The step still shows what the search already knew. */ }
    });
    return () => { current = false; };
  }, [key]);
  function send(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) { setFieldError(panel === 'email' ? 'Enter an email address' : 'Enter a mobile phone number'); return; }
    setFieldError(''); setSent(`${panel === 'email' ? 'Email' : 'Text message'} to ${value.trim()}`); setPanel(null); setValue('');
  }
  return <section className="ns-report" aria-labelledby="ns-heading">
    <p className="ns-print-head">Your next steps · {longDate(endedAt)}</p>
    <h3 id="ns-heading">Your next steps</h3>
    <p className="ns-lead">{steps.length ? `You talked about ${topics.map(topic => topic.toLowerCase()).join(' and ') || 'support'}. Here ${steps.length === 1 ? 'is the service' : `are ${steps.length} services`} to contact.` : 'No services were suggested during the conversation.'}</p>
    {sent && <div className="ns-banner no-print" role="status"><strong>Not sent (prototype)</strong><p>{sent} is not wired up yet, so nothing was sent. Use “Print or save as PDF” to keep a copy.</p></div>}
    {usingFallback && steps.length > 0 && <p className="ns-inset">No services were saved, so these are the top suggestions from the conversation.</p>}
    <ol className="ns-steps">{steps.map(({ service, concept }, index) => {
      const { action, rows } = stepRows(details[service.id], service.postcode);
      return <li key={service.id} className="ns-step">
        <span className="ns-num" aria-hidden="true">{index + 1}</span>
        <div className="ns-body">
          <h4>Contact {service.name}</h4>
          <p className="ns-action">{action}</p>
          <p className="ns-why">{service.provider && service.provider !== service.name ? `${service.provider} · ` : ''}For: {concept}</p>
          <dl className="ns-facts">{rows.map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
        </div>
        <span className="ns-check" aria-hidden="true" />
      </li>;
    })}</ol>
    <div className="ns-actions no-print">
      <button type="button" className="button primary" onClick={() => window.print()}>Print or save as PDF</button>
      <button type="button" className="button secondary" onClick={() => { setPanel('email'); setSent(''); }}>Email these steps</button>
      <button type="button" className="button secondary" onClick={() => { setPanel('phone'); setSent(''); }}>Send to my phone</button>
    </div>
    {panel && <form className="ns-share no-print" onSubmit={send} noValidate>
      <label htmlFor="ns-share">{panel === 'email' ? 'Email address' : 'Mobile phone number'}</label>
      {fieldError && <p className="ns-error" role="alert">Error: {fieldError}</p>}
      <input id="ns-share" type={panel === 'email' ? 'email' : 'tel'} autoComplete={panel === 'email' ? 'email' : 'tel'} value={value} onChange={event => setValue(event.target.value)} autoFocus />
      <button className="button primary">{panel === 'email' ? 'Send email' : 'Send text message'}</button> <button type="button" className="text-button" onClick={() => setPanel(null)}>Cancel</button>
    </form>}
  </section>;
}
