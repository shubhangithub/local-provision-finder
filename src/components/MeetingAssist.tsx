import { useEffect, useState } from 'react';
import { Check, ExternalLink, Sparkles, Plus, MessageSquare, MapPin } from 'lucide-react';
import { meetingNeeds, meetingPrompts, type MeetingProvision } from '../lib/meeting';
import { askAgent } from '../lib/agent';
import { needLabels } from '../lib/search';
import type { DirectoryResponse } from '../lib/directory';

export default function MeetingAssist({ customerText, selected, onToggle }: { customerText: string; selected: MeetingProvision[]; onToggle: (provision: MeetingProvision) => void }) {
  const needs = meetingNeeds(customerText);
  const key = needs.join(',');
  const [suggestions, setSuggestions] = useState<MeetingProvision[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!key) { setSuggestions([]); return; }
    const controller = new AbortController();
    setLoading(true); setFailed(false); setSuggestions([]);
    const timer = window.setTimeout(async () => {
      const results = await Promise.allSettled(needs.map(async need => {
        const query = ({wellbeing:'anxiety',confidence:'confidence',training:'employment',money:'money',childcare:'childcare',transport:'transport',housing:'housing',digital:'digital',language:'language',enterprise:'business'} as const)[need];
        const response = await fetch(`/api/imports?${new URLSearchParams({q:query,mode:'semantic',page:'1'})}`, {signal:controller.signal});
        if (!response.ok) throw new Error();
        const data: DirectoryResponse = await response.json();
        return data.records.slice(0,2).map(record => ({...record,reason:`Worth exploring for ${needLabels[need].toLowerCase()}.`}));
      }));
      if (controller.signal.aborted) return;
      const records = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      setSuggestions([...new Map(records.map(record => [record.id,record])).values()].slice(0,6));
      setFailed(results.some(result => result.status === 'rejected'));setLoading(false);
    }, 500);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [key, retry]);
  return <aside className="meeting-assist" aria-label="AI assist"><div className="assist-title"><span className="assist-icon"><Sparkles size={20}/></span><div><h2>AI assist</h2><p>Provision ideas for this conversation</p></div><span className="assist-count">{selected.length} added</span></div>
    <div className="agent-compact-help"><button className="text-button" onClick={()=>askAgent({context:{title:'Customer meeting',searchText:customerText,facts:[customerText ? `Customer statements: ${customerText}` : 'No customer statements have been captured yet.',`Needs identified: ${needs.map(need=>needLabels[need]).join(', ') || 'none yet'}.`,selected.length ? `Provision selected: ${selected.map(item=>item.name).join(', ')}.` : 'No provision has been added to the summary yet.'],prompts:['What should I ask next?','Find relevant provision','What needs checking?']}})}>Ask agent about this conversation</button></div>
    {!needs.length ? <div className="assist-empty"><MessageSquare size={28}/><h3>Ready when the customer speaks</h3><p>Suggestions appear as needs come up in the conversation.</p></div> : <><div className="meeting-needs" aria-label="Needs identified">{needs.map(need => <span key={need}>{needLabels[need]}</span>)}</div><section className="assist-question"><p className="assist-eyebrow">A useful question to ask</p><p>{meetingPrompts[needs[needs.length-1]]}</p></section>{loading && <p role="status">Finding relevant provision…</p>}{failed && <div className="assist-load-error"><p>Some suggestions couldn’t be loaded.</p><button className="text-button" onClick={() => setRetry(value => value+1)}>Try again</button></div>}{!loading && !failed && !suggestions.length && <p>No matching provision found. Discuss alternatives with the customer.</p>}<div className="assist-suggestions">{suggestions.map(provision => {const added=selected.some(item=>item.id===provision.id);return <article className="assist-provision" key={provision.id}><p className="assist-eyebrow">Suggested provision</p><h3>{provision.name}</h3><p>{provision.reason}</p><p className="assist-snippet">{provision.snippet}</p><p className="assist-place"><MapPin size={14}/>{provision.postcode ?? 'Area not supplied'} · {provision.provider}</p><div className="assist-checks">Check eligibility, location and availability.</div><div className="assist-provision-actions"><button className={`button small ${added ? 'secondary' : 'primary'}`} aria-pressed={added} onClick={()=>onToggle(provision)}>{added ? <Check size={15}/> : <Plus size={15}/>}{added ? 'Added to summary' : 'Add to summary'}</button><a href={`#/directory/${encodeURIComponent(provision.id)}`} target="_blank" rel="noreferrer" aria-label={`View details for ${provision.name}`}>Details<ExternalLink size={14}/></a></div></article>;})}</div></>}
  </aside>;
}
