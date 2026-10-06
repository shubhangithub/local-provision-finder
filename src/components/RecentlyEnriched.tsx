import {useEffect,useState} from 'react';
import {ArrowRight,Sparkles} from 'lucide-react';
import {ChangeLine,staffHeaders,type Overwrite} from './ServiceEnrichment';
interface Props {staff:boolean;enableStaff:()=>void}
export default function RecentlyEnriched({staff,enableStaff}:Props) {
  const [items,setItems]=useState<Overwrite[] | null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function load() {try {const response=await fetch('/api/enrichment/recent',{headers:staffHeaders});const data=await response.json();if (!response.ok) throw new Error(data.error);setItems(data.overwrites);} catch (e) {setError(e instanceof Error ? e.message : 'Could not load the list.');}}
  useEffect(()=>{if (staff) void load();},[staff]);
  async function revert(id:string) {
    setBusy(true);setError('');
    try {const response=await fetch('/api/enrichment/revert',{method:'POST',headers:staffHeaders,body:JSON.stringify({id})});const data=await response.json();if (!response.ok) throw new Error(data.error);window.dispatchEvent(new Event('directory-updated'));await load();} catch (e) {setError(e instanceof Error ? e.message : 'Could not revert.');} finally {setBusy(false);}
  }
  if (!staff) return <div className="page-wrap"><div className="panel staff-gate"><Sparkles size={34}/><h1>Recently enriched</h1><p>See what web enrichment has changed and undo it.</p><button className="button primary" onClick={enableStaff}>Enter staff workspace<ArrowRight size={17}/></button></div></div>;
  return <div className="page-wrap recent-enriched"><div className="page-heading"><div><h1>Recently enriched</h1><p>Details replaced automatically from the web, newest first. Revert any that look wrong.</p></div></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {items===null ? !error && <p role="status">Loading…</p> : !items.length ? <div className="panel empty-state"><h2>Nothing enriched yet</h2><p>Open a service and choose Enrich from web.</p></div> : <ul className="change-list">{items.map(item => <ChangeLine key={item.id} item={item} showService onRevert={revert} busy={busy}/>)}</ul>}
  </div>;
}
