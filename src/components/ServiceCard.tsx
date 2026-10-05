import { ArrowUpRight, Bookmark, CheckCircle2, CircleAlert, HeartHandshake, GraduationCap, Monitor, Wallet, Languages, BriefcaseBusiness, MapPin, Globe } from 'lucide-react';
import { effectiveStatus, isRemote, practicalLabels } from '../lib/search';
import type { Service, ServiceMatch } from '../types';

export function serviceIcon(service: Service) {
  if (/health|confidence/i.test(service.category)) return HeartHandshake;
  if (/digital/i.test(service.category)) return Monitor;
  if (/financial/i.test(service.category)) return Wallet;
  if (/language/i.test(service.category)) return Languages;
  if (/self-employment/i.test(service.category)) return BriefcaseBusiness;
  return GraduationCap;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
}
export function TrustLine({ service }: { service: Service }) {
  const status = effectiveStatus(service);
  const warning = service.coverageConflict ? 'Coverage needs checking' : service.venueConflict ? 'Venue may have changed' : status === 'Potentially outdated' ? 'Details need checking' : status === 'Review due' ? 'Review due' : '';
  const Icon = warning ? CircleAlert : CheckCircle2;
  return <span className={`trust-line ${warning ? 'needs-check' : ''}`}><Icon size={14} aria-hidden="true" /><span>{warning || 'Checked'}{warning ? ' · ' : ' '}{formatDate(service.lastVerified)}</span></span>;
}
export default function ServiceCard({ match, saved, toggleSaved, onNavigate }: {
  match: ServiceMatch; saved: boolean; toggleSaved: (id: string) => void; onNavigate: (route: string) => void;
}) {
  const { service } = match;
  const Icon = serviceIcon(service);
  const remoteOutside = isRemote(service) && service.delivery !== 'In person';
  const snippet = match.reasons.slice(0, 2).join(' · ');
  return <article className="service-card">
    <div className="service-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></div>
    <div className="service-card-body">
      <div className="card-title-row"><h3><a href={`#/service/${service.id}`} onClick={e => { e.preventDefault(); onNavigate(`/service/${service.id}`); }}>{service.name}<ArrowUpRight size={16} aria-hidden="true" /></a></h3>
        <button type="button" className={`icon-button bookmark ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? 'Unsave' : 'Save'} ${service.name}`} aria-pressed={saved} onClick={() => toggleSaved(service.id)}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
      <p className="match-snippet">{snippet}</p>
      <div className="card-foot"><span className="delivery"><span>{service.delivery}</span><span className="meta-dot">·</span>{service.delivery === 'Online' ? <><Globe size={12} aria-hidden="true" /><span>{service.postcodePrefixes.join(', ')}</span></> : <><MapPin size={12} aria-hidden="true" /><span>{service.distanceMiles} mi{remoteOutside ? ' / remote' : ''}</span></>}</span><TrustLine service={service} /></div>
      {!!match.missingPractical.length && <p className="unknown-access">Check {match.missingPractical.map(n => practicalLabels[n].toLowerCase()).join(', ')} with the provider.</p>}
    </div>
  </article>;
}
