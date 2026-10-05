import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
import type { LiveConcept, MeetingService } from '../lib/live-meeting';

const VISIBLE = 4;

export interface MeetingChoice { service: MeetingService; concept: string }

/** Services ticked during this meeting. Ticks also go into the normal saved shortlist. */
export function useMeetingShortlist() {
  const [saved, setSaved] = useState(readDirectorySaved);
  const [choices, setChoices] = useState<Map<string, MeetingChoice>>(new Map());
  useEffect(() => {
    const update = () => setSaved(readDirectorySaved());
    window.addEventListener('directory-saved-changed', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('directory-saved-changed', update); window.removeEventListener('storage', update); };
  }, []);
  const savedIds = new Set(saved.map(item => item.id));
  const toggle = (service: MeetingService, concept: string) => {
    toggleDirectorySaved(service);
    setChoices(previous => { const next = new Map(previous); if (savedIds.has(service.id)) next.delete(service.id); else next.set(service.id, { service, concept }); return next; });
  };
  // Only services still saved count, in case someone unsaves from the shortlist page.
  const picked = [...choices.values()].filter(choice => savedIds.has(choice.service.id));
  return { savedIds, toggle, picked, clear: () => setChoices(new Map()) };
}

export function visibleServices(concept: LiveConcept, dismissed: Set<string>, urgent=false) {
  const { filtered, results } = concept;
  const list = filtered.status === 'done' ? filtered.ids.map(id => results.find(r => r.id === id)).filter((r): r is MeetingService => !!r)
    : filtered.status === 'error' ? results : results;
  return list.filter(service => !dismissed.has(service.id)).sort((a,b)=>urgent?Number(!!b.urgentSupportEvidence)-Number(!!a.urgentSupportEvidence):0).slice(0, VISIBLE);
}

export default function LiveServices({ concepts, dismissed, onDismiss, shortlist, urgent=false }: { urgent?:boolean; concepts: LiveConcept[]; dismissed: Set<string>; onDismiss: (id: string) => void; shortlist: ReturnType<typeof useMeetingShortlist> }) {
  if (!concepts.length) return <p className="meeting-note" role="status">Suggested services appear here as the conversation moves to what is needed.</p>;
  return <div className="live-services">{concepts.map(concept => {
    const pending = concept.filtered.status === 'pending';
    const shown = visibleServices(concept, dismissed, urgent);
    return <section key={concept.label} className="live-concept" aria-label={concept.label}>
      <h4>{concept.label}</h4>
      <p className="live-query" key={concept.query}><span className="live-flash">Searching for “{concept.query}”</span></p>
      {pending && <p className="live-checking" role="status">Checking which are most relevant…</p>}
      {!pending && !shown.length && <p className="meeting-note">No services that fit yet.</p>}
      <ul className={pending ? 'live-list is-pending' : 'live-list'}>{shown.map(service => {
        const isSaved = shortlist.savedIds.has(service.id);
        return <li key={service.id} className={isSaved ? 'live-service is-saved' : 'live-service'}>
          <div className="live-service-body">
            <h5><a href={`/#/directory/${encodeURIComponent(service.id)}`} target="_blank" rel="noreferrer">{service.name}<span className="visually-hidden"> (opens in a new tab)</span></a></h5>
            {service.provider && service.provider !== service.name && <p className="directory-provider">{service.provider}</p>}
            {urgent&&service.urgentSupportEvidence&&<span className="urgent-service-label" title={service.urgentSupportEvidence}>Urgent support listed</span>}
            <p className="live-snippet">{service.snippet}</p>
            {service.postcode && <p className="field-hint">{service.postcode}</p>}
          </div>
          <div className="live-vote">
            <button type="button" className="live-yes" aria-pressed={isSaved} disabled={pending} onClick={() => shortlist.toggle(service, concept.label)}><Check size={22} aria-hidden="true"/><span className="visually-hidden">{isSaved ? 'Remove from shortlist' : 'Save'} {service.name}</span></button>
            <button type="button" className="live-no" disabled={pending} onClick={() => onDismiss(service.id)}><X size={22} aria-hidden="true"/><span className="visually-hidden">Hide {service.name}, not relevant</span></button>
          </div>
        </li>;
      })}</ul>
    </section>;
  })}</div>;
}
