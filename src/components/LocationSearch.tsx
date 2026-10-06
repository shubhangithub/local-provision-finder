import SearchAutocomplete from './SearchAutocomplete';
import { usePageWidth } from '../lib/page-width';
import UrgencyNotice from './UrgencyNotice';
import { needsHelpToday, type UrgencyMode } from '../lib/urgency';
import SaveServiceButton from './SaveServiceButton';
import '../styles/location-tags.css';
import { askAgent } from '../lib/agent';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, Map as MapIcon, List } from 'lucide-react';
import ImportedServices from './ImportedServices';
import ServicesMap from './ServicesMap';
import ResizableResults from './ResizableResults';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
import { rememberService } from '../lib/notifications';
import { type DirectoryResponse, type MapBounds } from '../lib/directory';
import { openRegionMenu, regionParams, regionSearch, useRegion } from '../lib/region';
const sameBounds=(a:MapBounds|null,b:MapBounds)=>!!a && ['west','north','east','south'].every(key => Math.abs(a[key as keyof MapBounds]-b[key as keyof MapBounds])<0.000001);
export default function LocationSearch({staff=false,selectedId=null,onSelect,onBack,feedbackOpen=false,feedbackContext}:{staff?:boolean;selectedId?:string|null;onSelect?:(id:string)=>void;onBack?:()=>void;feedbackOpen?:boolean;feedbackContext?:'viewed'|'recommended'}) {
  const [saved,setSaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setSaved(readDirectorySaved());window.addEventListener("directory-saved-changed",update);return () => window.removeEventListener("directory-saved-changed",update);},[]);
  const heading=useRef<HTMLHeadingElement>(null);
  const [region]=useRegion();
  const [mapBounds,setMapBounds]=useState<MapBounds | null>(null);
  const bounds=mapBounds ?? region?.bounds ?? null;
  const [searched,setSearched]=useState(false);
  const [words,setWords]=useState('');
  const [urgency,setUrgency]=useState<UrgencyMode>('auto');const urgent=needsHelpToday(words,urgency);
  const [searchText,setSearchText]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [reload,setReload]=useState(0);
  useEffect(() => {const update=() => setReload(value=>value+1);window.addEventListener("directory-updated",update);return () => window.removeEventListener("directory-updated",update);},[]);
  const [page,setPage]=useState(1);
  const [data,setData]=useState<DirectoryResponse | null>(null);
  const selected=selectedId;const previousSelected=useRef<string|null>(selectedId);previousSelected.current=selectedId;const closeDetail=()=>onBack?.();
  const [view,setView]=useState<'list' | 'map'>('list');
  const [hoveredService,setHoveredService]=useState<string|null>(null);const [mapSelectedService,setMapSelectedService]=useState<string|null>(null);const activeService=hoveredService??mapSelectedService;
  const [includeUnknown,setIncludeUnknown]=useState(!region?.bounds);
  const previousRegion=useRef(region);
  // Changing the region in the header re-runs the current search from page 1.
  useEffect(() => {
    if (previousRegion.current===region) return;
    previousRegion.current=region;
    setMapBounds(null);setIncludeUnknown(!region?.bounds);setPage(1);if (previousSelected.current) onBack?.();setError('');
    setSearchText(words.trim());setSearched(true);
  },[region]);
  const searchParams=() => ({...regionParams(region,bounds),unknown:includeUnknown ? '1' : '0',urgency:urgent?'today':'normal'});
  useEffect(() => {
    if (!searched) return;
    const controller=new AbortController();setLoading(true);setError('');
    const params=new URLSearchParams({q:searchText,page:String(page),mode:'semantic',...searchParams()});
    fetch(`/api/imports?${params}`,{signal:controller.signal}).then(async response => {const result=await response.json();if (!response.ok) throw new Error(result.error ?? 'Search unavailable');setData(result);setLoading(false);}).catch(e => {if (e.name!=='AbortError') {setError('Could not load the local directory. Please try again.');setLoading(false);}});
    return () => controller.abort();
  },[searched,region,page,searchText,includeUnknown,bounds,reload,urgent]);
  useEffect(() => {if (!selected && data) heading.current?.focus();},[selected]);
  useEffect(() => {if (!bounds && searchText && data?.searchMode==='semantic') data.records.slice(0,1).forEach(record => rememberService(record.id,record.name,'recommended'));},[data,searchText]);
  function select(id:string) {onSelect?.(id);window.scrollTo({top:0});}
  function search(text:string) {setSearchText(text);setPage(1);setSearched(true);}
  const state=selected ? 'detail' : searched ? 'results' : 'home';
  usePageWidth(state==='results' ? 'wide' : 'reading');
  const shell=useRef<HTMLDivElement>(null);const bar=useRef<HTMLDivElement>(null);
  // The map sticks below the compact search bar, whose height varies with wrapping.
  useEffect(() => {
    const element=bar.current;if (state!=='results' || !element || !shell.current) return;
    const apply=() => shell.current?.style.setProperty('--results-bar-h',`${element.offsetHeight}px`);
    apply();const observer=new ResizeObserver(apply);observer.observe(element);return () => observer.disconnect();
  },[state]);
  const searchForm=<form className="directory-search-form" onSubmit={e => {e.preventDefault();search(words.trim());}}>
    <div className="directory-search-row">
      <SearchAutocomplete value={words} onChange={value=>{setWords(value);setUrgency('auto');}} area={region?.area} onChoose={value=>{setWords(value);setUrgency(urgent?'today':'normal');search(value);}}/>
      <button className="button primary" type="submit">Find support<ArrowRight size={18}/></button>
    </div>
  </form>;
  const urgencyNotice=<UrgencyNotice text={words} mode={urgency} onChange={mode=>{setUrgency(mode);setPage(1);}}/>;
  if (state==='detail') return <div className="location-search directory-home" data-state="detail"><section className="page-wrap finder-section directory-service-detail" aria-label="Real directory results"><button className="back-link" type="button" onClick={closeDetail}><ArrowLeft size={16}/>Back to results</button><ImportedServices key={selected!} initialId={selected!} directoryView feedbackOpen={feedbackOpen} feedbackContext={feedbackContext} staff={staff} enableStaff={() => {}} onNavigate={closeDetail}/></section></div>;
  if (state==='home') return <div className="location-search directory-home" data-state="home">
    <section className="hero page-wrap"><div className="hero-copy"><h1>What do you need help with?</h1></div></section>
    <section className="page-wrap finder-section" aria-label="Search local support">{searchForm}{urgencyNotice}</section>
  </div>;
  return <div ref={shell} className="location-search directory-home results-shell" data-state="results">
    <div ref={bar} className="results-bar"><div className="results-bar-inner">{searchForm}</div></div>
    <div className="results-urgency">{urgencyNotice}</div>
    <section className="results-main" aria-label="Real directory results">
      <ResizableResults view={view}>
        <div className="directory-results-list">
          <div className="results-controls">
            <h2 ref={heading} tabIndex={-1} className="visually-hidden">Search results</h2>
            <p role="status" className="visually-hidden results-count">{data?.total ?? 0} services</p>
            {data?.searchMode==='keyword' && searchText && <p className="field-hint">Keyword results · meaning-based search is unavailable</p>}
            {(region?.lat!==undefined || bounds) && <div className="nearby-options"><p className="field-hint">{bounds ? 'Services inside the visible map area.' : 'Recorded sites within 10 miles. Distances are straight line.'}</p><label className="checkbox-label"><input type="checkbox" checked={includeUnknown} onChange={e => {setIncludeUnknown(e.target.checked);setPage(1);}}/><span>{bounds ? 'Include services without map locations' : 'Also show services with unknown distance'}</span></label></div>}
            {mapBounds && <button type="button" className="text-button" onClick={() => {setMapBounds(null);setPage(1);setIncludeUnknown(!region?.bounds);}}>Reset to selected location</button>}
          </div>
          {loading && <p role="status">Finding services…</p>}
          {error ? <p role="alert" className="form-error">{error}</p> : <>
            {!data?.total ? !loading && data && !searchText.trim() && <div className="empty-state panel"><Search size={32} aria-hidden="true"/><h3>No matching services</h3><p>Try different words or choose another region from the settings in the header.</p><button className="button secondary" onClick={openRegionMenu}>Change region</button></div> : <div className="result-list-wrap"><div className="result-list">{data.records.map(record => <article className={`service-card ${activeService===record.id?'is-highlighted':''}`} data-service-id={record.id} key={record.id} onMouseEnter={()=>setHoveredService(record.id)} onMouseLeave={()=>setHoveredService(null)} onFocus={()=>setHoveredService(record.id)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHoveredService(null);}}><div className="service-card-body"><div className="card-title-row"><h3><button className="import-service-link" onClick={() => select(record.id)}>{record.name}<ArrowRight size={16}/></button></h3><SaveServiceButton compact saved={saved.some(item=>item.id===record.id)} name={record.name} onToggle={()=>toggleDirectorySaved(record)}/></div><p className="directory-provider">{record.provider}</p>{urgent && record.urgentSupportEvidence && <span className="urgent-service-label" title={record.urgentSupportEvidence}>Urgent support listed</span>}{!!record.tags?.length && <ul className="directory-result-tags" aria-label="Service tags">{record.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}{(record.distanceMiles!==null || record.postcode) && <p className="field-hint">{record.distanceMiles!==null ? `${record.distanceMiles.toFixed(1)} miles${record.postcode ? ' · ' : ''}` : ''}{record.postcode}</p>}<button className="text-button agent-inline-link" onClick={()=>askAgent({question:'Explain this service',context:{title:record.name,serviceId:record.id,searchText:record.name+' '+record.snippet,facts:[`${record.name}: ${record.provider}.`,record.snippet,`Postcode: ${record.postcode ?? 'not supplied'}.`, 'Check eligibility, coverage, costs and current availability in the full service record and with the provider.'],prompts:['Explain this service','What details need checking?','Find similar provision']}})}>Ask agent about this service</button></div></article>)}</div>{data.total>20 && <div className="pagination"><button className="button secondary" disabled={page===1} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} of {Math.ceil(data.total/20)}</span><button className="button secondary" disabled={page*20>=data.total} onClick={() => setPage(page+1)}>Next</button></div>}</div>}
          </>}
        </div>
        <aside className="directory-results-map" aria-label="Service map"><ServicesMap activeId={activeService} onHighlight={id=>{setMapSelectedService(id);setHoveredService(null);const card=[...document.querySelectorAll<HTMLElement>('[data-service-id]')].find(card=>card.dataset.serviceId===id);card?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}} services={data?.mapRecords ?? []} area={region?.area} origin={region?.lat!==undefined ? {lat:region.lat,lng:region.lng!} : undefined} onSelect={select} bounds={bounds} onBoundsChange={next => {if (!sameBounds(bounds,next)) setMapBounds(next);setIncludeUnknown(false);setPage(1);}}/>{!!data?.unmappedCount && <p className="map-caption">{data.unmappedCount} services have no recorded coordinates and appear in the list.</p>}</aside>
      </ResizableResults>
      <div className="directory-view-toggle results-view-toggle" role="group" aria-label="Results view"><button type="button" aria-pressed={view==='list'} onClick={() => setView('list')}><List size={17}/>List</button><button type="button" aria-pressed={view==='map'} onClick={() => setView('map')}><MapIcon size={17}/>Map</button></div>
    </section>
  </div>;
}
