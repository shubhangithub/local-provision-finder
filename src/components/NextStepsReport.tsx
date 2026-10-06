import { useEffect, useState } from 'react';
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
  return <section className="ns-report" aria-labelledby="ns-heading">
    <p className="ns-print-head">Your next steps · {longDate(endedAt)}</p>
    <div className="ns-top">
      <h3 id="ns-heading">Your next steps</h3>
    </div>
    <p className="ns-lead">{steps.length ? `You talked about ${topics.map(topic => topic.toLowerCase()).join(' and ') || 'support'}. Here ${steps.length === 1 ? 'is the service' : `are ${steps.length} services`} to contact.` : 'No services were suggested during the conversation.'}</p>
    {usingFallback && steps.length > 0 && <p className="ns-inset">No services were saved, so these are the top suggestions from the conversation.</p>}
    <ol className="ns-steps">{steps.map(({ service, concept }, index) => {
      const { action, rows } = stepRows(details[service.id], service.postcode);
      const open = expanded.has(service.id);
      return <li key={service.id} className="ns-step">
        <span className="ns-num" aria-hidden="true">{index + 1}</span>
        <div className="ns-body">
          <h4>Contact {service.name}</h4>
          <p className="ns-action">{action}</p>
          <p className="ns-why">{service.provider && service.provider !== service.name ? `${service.provider} · ` : ''}For: {concept}</p>
          {!!rows.length && <button type="button" className="text-button ns-toggle no-print" aria-expanded={open} aria-controls={`ns-facts-${service.id}`} onClick={() => setExpanded(previous => { const next = new Set(previous); if (open) next.delete(service.id); else next.add(service.id); return next; })}>{open ? 'Hide details' : 'Show details'}<span className="visually-hidden"> for {service.name}</span></button>}
          <dl id={`ns-facts-${service.id}`} className={open ? 'ns-facts' : 'ns-facts is-collapsed'}>{rows.map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
        </div>
        <span className="ns-check" aria-hidden="true" />
      </li>;
    })}</ol>
  </section>;
}
