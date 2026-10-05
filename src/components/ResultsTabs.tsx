import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface ResultsTab { id: string; label: string; panel: ReactNode }

/** Accessible tab strip (arrow keys, Home/End). Only the selected panel is rendered. */
export default function ResultsTabs({ tabs, label }: { tabs: ResultsTab[]; label: string }) {
  const [selected, setSelected] = useState(tabs[0]?.id ?? '');
  const base = useId();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = tabs.find(tab => tab.id === selected) ?? tabs[0];
  function move(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setSelected(tabs[next].id);
    buttons.current[tabs[next].id]?.focus();
  }
  return <div className="results-tabs no-print">
    <div role="tablist" aria-label={label} className="results-tablist">{tabs.map((tab, index) => <button
      key={tab.id} type="button" role="tab" id={`${base}-${tab.id}-tab`} aria-selected={tab.id === active.id} aria-controls={`${base}-panel`}
      tabIndex={tab.id === active.id ? 0 : -1} ref={element => { buttons.current[tab.id] = element; }}
      onClick={() => setSelected(tab.id)} onKeyDown={event => move(event, index)}>{tab.label}</button>)}</div>
    <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${active.id}-tab`} className="results-panel">{active.panel}</div>
  </div>;
}
