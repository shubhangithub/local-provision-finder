import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/staff-menu.css';
interface Counts { reports?: number; listings?: number }
interface Item { path: string; label: string; count?: number }
const waiting = (entries: { status: string }[], states: string[]) => entries.filter(entry => states.includes(entry.status)).length;
/** The one place staff pages are reached from. A count shows only when something is waiting. */
export default function StaffMenu({ route, onNavigate, onSignOut }: { route: string; onNavigate: (route: string) => void; onSignOut: () => void }) {
  const [counts, setCounts] = useState<Counts>({});
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [feedback, suggestions] = await Promise.allSettled(['/api/feedback', '/api/suggestions'].map(async url => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error();
      return (await response.json()).entries as { status: string }[];
    }));
    if (signal?.aborted) return;
    setCounts({
      reports: feedback.status === 'fulfilled' ? waiting(feedback.value, ['pending', 'checking']) : undefined,
      listings: suggestions.status === 'fulfilled' ? waiting(suggestions.value, ['submitted', 'draft']) : undefined,
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => { void refresh(controller.signal); };
    update();
    window.addEventListener('directory-updated', update);
    window.addEventListener('suggestions-updated', update);
    return () => { controller.abort(); window.removeEventListener('directory-updated', update); window.removeEventListener('suggestions-updated', update); };
  }, [refresh, route]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | FocusEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('focusin', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('focusin', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const total = (counts.reports ?? 0) + (counts.listings ?? 0);
  const review: Item[] = [{ path: '/feedback', label: 'Service reports', count: counts.reports }, { path: '/suggestions', label: 'New listings to approve', count: counts.listings }];
  const more: Item[] = [{ path: '/add-provision', label: 'Add a service' }, { path: '/follow-ups', label: 'Follow-ups' }, { path: '/enriched', label: 'Enrichment log' }, { path: '/meeting', label: 'Start meeting' }, { path: '/imports', label: 'Directory records' }];
  const link = (item: Item) => <li key={item.path}>
    <a href={`#${item.path}`} aria-current={route === item.path ? 'page' : undefined} onClick={event => { event.preventDefault(); setOpen(false); onNavigate(item.path); }}>
      {item.label}{!!item.count && <span className="workspace-count" aria-label={`${item.count} awaiting review`}>{item.count}</span>}
    </a>
  </li>;
  return <div className="staff-menu" ref={wrapper}>
    <button ref={trigger} type="button" className="staff-toggle enabled staff-menu-trigger" aria-expanded={open} aria-controls={panelId}
      onClick={() => { setOpen(value => !value); if (!open) void refresh(); }}>
      <span className="live-dot" aria-hidden="true" />Staff
      {total > 0 && <span className="workspace-count" aria-label={`${total} awaiting review`}>{total}</span>}
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div id={panelId} className="staff-menu-panel" role="navigation" aria-label="Staff menu">
      <p className="staff-menu-heading">Review</p>
      <ul>{review.map(link)}</ul>
      <ul className="staff-menu-more">{more.map(link)}</ul>
      <button type="button" className="staff-menu-signout" onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
    </div>}
  </div>;
}
