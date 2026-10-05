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

export function visibleServices(concept: LiveConcept, dismissed: Set<string>) {
  const { filtered, results } = concept;
  const list = filtered.status === 'done' ? filtered.ids.map(id => results.find(r => r.id === id)).filter((r): r is MeetingService => !!r)
    : filtered.status === 'error' ? results : results.slice(0, VISIBLE + 1);
  return list.filter(service => !dismissed.has(service.id)).slice(0, VISIBLE);
}

export default function LiveServices({ concepts, dismissed, onDismiss, shortlist, newestFirst }: { concepts: LiveConcept[]; dismissed: Set<string>; onDismiss: (id: string) => void; shortlist: ReturnType<typeof useMeetingShortlist>; newestFirst?: boolean }) {
  if (!concepts.length) return <div className="live-empty" role="status"><p><strong>Listening for what support is needed.</strong></p><p>Matching services appear here as the conversation moves to a topic, such as work, housing or childcare.</p></div>;
  return <div className="live-services">{(newestFirst ? [...concepts].reverse() : concepts).map(concept => {
    const pending = concept.filtered.status === 'pending';
    const shown = visibleServices(concept, dismissed);
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
            <p className="live-snippet">{service.snippet}</p>
            {service.postcode && <p className="field-hint">{service.postcode}</p>}
          </div>
          <div className="live-vote">
            <button type="button" className="live-yes" aria-pressed={isSaved} disabled={pending} onClick={() => shortlist.toggle(service, concept.label)}><Check size={22} aria-hidden="true"/><span className="live-vote-label" aria-hidden="true">{isSaved ? 'Saved' : 'Save'}</span><span className="visually-hidden">{isSaved ? 'Remove from shortlist' : 'Save'} {service.name}</span></button>
            <button type="button" className="live-no" disabled={pending} onClick={() => onDismiss(service.id)}><X size={22} aria-hidden="true"/><span className="live-vote-label" aria-hidden="true">Hide</span><span className="visually-hidden">Hide {service.name}, not relevant</span></button>
          </div>
        </li>;
      })}</ul>
    </section>;
  })}</div>;
}
