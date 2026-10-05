import SearchAutocomplete from './SearchAutocomplete';
import UrgencyNotice from './UrgencyNotice';
import { needsHelpToday, type UrgencyMode } from '../lib/urgency';
import {AvailabilityStamp} from './ServiceAvailability';
import SaveServiceButton from './SaveServiceButton';
import '../styles/location-tags.css';
import { askAgent } from '../lib/agent';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, ArrowLeft, ArrowRight, Search, Map as MapIcon, List } from 'lucide-react';
import ImportedServices from './ImportedServices';
import PublicAssistant from './PublicAssistant';
import ServicesMap from './ServicesMap';
import ResizableResults from './ResizableResults';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
import { rememberService } from '../lib/notifications';
import { directoryAreas, type DirectoryResponse, type MapBounds, type MapService } from '../lib/directory';
interface Place { label: string; area?: string; lat?: number; lng?: number; bounds?: MapBounds }
export default function LocationSearch({staff=false}:{staff?:boolean}) {
  const [saved,setSaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setSaved(readDirectorySaved());window.addEventListener("directory-saved-changed",update);return () => window.removeEventListener("directory-saved-changed",update);},[]);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const [place,setPlace]=useState<Place | null>(null);
  const [bounds,setBounds]=useState<MapBounds | null>(null);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [pickerArea,setPickerArea]=useState('Bristol');
  const [pickerBounds,setPickerBounds]=useState<MapBounds | null>(null);
  const [pickerServices,setPickerServices]=useState<MapService[]>([]);
  const [draft,setDraft]=useState('');
  const [words,setWords]=useState('');
  const [urgency,setUrgency]=useState<UrgencyMode>('auto');const urgent=needsHelpToday(words,urgency);
  const [searchText,setSearchText]=useState('');
  const [assistantSearch,setAssistantSearch]=useState(0);
  const [error,setError]=useState('');
  const [locationError,setLocationError]=useState('');
  const [locating,setLocating]=useState(false);
  const [loading,setLoading]=useState(false);
  const [reload,setReload]=useState(0);
  useEffect(() => {const update=()=>setReload(value=>value+1);window.addEventListener("directory-updated",update);return () => window.removeEventListener("directory-updated",update);},[]);
  const [page,setPage]=useState(1);
  const [data,setData]=useState<DirectoryResponse | null>(null);
  const [selected,setSelected]=useState<string | null>(null);
  const [view,setView]=useState<'list' | 'map'>('list');
  const [hoveredService,setHoveredService]=useState<string|null>(null);const [mapSelectedService,setMapSelectedService]=useState<string|null>(null);const activeService=hoveredService??mapSelectedService;
  const [includeUnknown,setIncludeUnknown]=useState(true);
  const geoRequest=useRef(0);
  function close() {geoRequest.current++;setLocating(false);setPickerOpen(false);dialog.current?.close();trigger.current?.focus();}
  function choose(next:Place) {setBounds(next.bounds ?? null);setIncludeUnknown(!next.bounds);setPlace(next);setPage(1);setSelected(null);setSearchText(words.trim());if(words.trim())setAssistantSearch(value=>value+1);setError('');close();}
  function currentLocation() {
    if (!navigator.geolocation) {setLocationError('Your browser does not support location. Choose an area or enter a postcode.');return;}
    setLocating(true);setLocationError('');const request=++geoRequest.current;
    navigator.geolocation.getCurrentPosition(position => {if (request!==geoRequest.current) return;choose({label:'Your current location',lat:position.coords.latitude,lng:position.coords.longitude});},failure => {if (request!==geoRequest.current) return;setLocating(false);setLocationError(failure.code===1 ? 'Location access was declined. Choose an area or enter a postcode instead.' : 'We could not find your location. Choose an area or enter a postcode instead.');},{timeout:10000,maximumAge:60000,enableHighAccuracy:false});
  }
  useEffect(() => {
    if (!place) return;
    const controller=new AbortController();setLoading(true);setError('');
    const params=new URLSearchParams({q:searchText,page:String(page),mode:'semantic',unknown:includeUnknown ? '1' : '0',urgency:urgent?'today':'normal'});
    if (bounds) params.set('bounds',[bounds.west,bounds.south,bounds.east,bounds.north].join(','));
    if (place.area) params.set('area',place.area);
    else if (place.lat!==undefined && place.lng!==undefined) {params.set('lat',String(place.lat));params.set('lng',String(place.lng));}
    fetch(`/api/imports?${params}`,{signal:controller.signal}).then(async response => {const result=await response.json();if (!response.ok) throw new Error(result.error ?? 'Search unavailable');setData(result);setLoading(false);}).catch(e => {if (e.name!=='AbortError') {setError('Could not load the local directory. Please try again.');setLoading(false);}});
    return () => controller.abort();
  },[place,page,searchText,includeUnknown,bounds,reload,urgent]);
  useEffect(() => {if (!pickerOpen) return;const controller=new AbortController();fetch('/api/imports?area=&mode=semantic',{signal:controller.signal}).then(response => response.json()).then(result => setPickerServices(result.mapRecords ?? [])).catch(() => {});return () => controller.abort();},[pickerOpen]);
  useEffect(() => {if (!selected && data) heading.current?.focus();},[selected]);
  useEffect(() => () => {geoRequest.current++;},[]);
  useEffect(() => {if (!bounds && searchText && data?.searchMode==='semantic') data.records.slice(0,1).forEach(record => rememberService(record.id,record.name,'recommended'));},[data,searchText]);
  function select(id:string) {setSelected(id);window.scrollTo({top:0});}
  return <div className="location-search">
    {!selected && <form className="directory-search-form" onSubmit={e => {e.preventDefault();if (!place) {setLocationError('');setPickerOpen(true);dialog.current?.showModal();return;}setSearchText(words.trim());setPage(1);if(words.trim())setAssistantSearch(value=>value+1);}}>
      <SearchAutocomplete value={words} onChange={value=>{setWords(value);setUrgency('auto');}} params={{...(place?.area?{area:place.area}:{}),...(place?.lat!==undefined?{lat:String(place.lat),lng:String(place.lng)}:{}),...(bounds?{bounds:[bounds.west,bounds.south,bounds.east,bounds.north].join(',')}:{}),unknown:includeUnknown?'1':'0',urgency:urgent?'today':'normal'}} onChoose={value=>{setWords(value);setUrgency(urgent?'today':'normal');setPage(1);if(place){setSearchText(value);setAssistantSearch(key=>key+1);}else{setLocationError('');setPickerOpen(true);dialog.current?.showModal();}}}/>
      <div className="directory-search-controls"><button ref={trigger} type="button" className="location-trigger" aria-haspopup="dialog" onClick={() => {setLocationError('');setPickerOpen(true);dialog.current?.showModal();}}><MapPin size={20} aria-hidden="true"/><span><strong>Location</strong><span>{place?.label ?? 'Choose an area or use your location'}</span></span></button><button className="button primary" type="submit">Find support<ArrowRight size={18}/></button></div>
    </form>}
    {!selected && <UrgencyNotice text={words} mode={urgency} onChange={mode=>{setUrgency(mode);setPage(1);}}/>}
    <dialog ref={dialog} className="location-dialog" aria-labelledby="location-title" onCancel={e => {e.preventDefault();close();}}>
      <div className="location-dialog-heading"><h2 id="location-title">Choose location</h2><button type="button" className="icon-button" aria-label="Close location picker" onClick={close}><X size={20}/></button></div>
      <form onSubmit={e => {e.preventDefault();if (draft.trim()) choose({label:draft.trim().toUpperCase(),area:/^bristol$/i.test(draft.trim()) ? 'Bristol' : /^kingston(?: upon thames)?$/i.test(draft.trim()) ? 'Kingston' : /^bucks|buckinghamshire$/i.test(draft.trim()) ? 'Buckinghamshire' : draft.trim()});}}><label className="visually-hidden" htmlFor="location-query">Town or service postcode</label><input autoFocus id="location-query" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Town or postcode" maxLength={80}/><button className="button primary" type="submit" aria-label="Search this area" disabled={!draft.trim()}>Search<ArrowRight size={16}/></button></form>
      <div className="location-picker-tools"><button type="button" className="location-current" disabled={locating} onClick={currentLocation}><Navigation size={19}/>{locating ? 'Finding your location…' : 'Use current location'}</button><div className="field"><label className="visually-hidden" htmlFor="picker-map-centre">Choose an area on the map</label><select id="picker-map-centre" value={pickerArea} onChange={e => setPickerArea(e.target.value)}>{directoryAreas.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}</select></div></div>
      {locationError && <p role="alert" className="form-error">{locationError}</p>}
      <div className="picker-map-section">{pickerOpen && <ServicesMap picker services={pickerServices} area={pickerArea} bounds={place?.bounds} onSelect={id=>{choose({label:pickerArea,area:pickerArea});select(id);}} onBoundsChange={setPickerBounds}/>}<button type="button" className="button primary" disabled={!pickerBounds} onClick={() => {if (pickerBounds) choose({label:'Selected map area',bounds:pickerBounds});}}>Use this map area<ArrowRight size={16}/></button></div>

    </dialog>
    {place && <section className={`location-results ${selected ? "directory-service-detail" : ""}`} aria-label="Real directory results">
      {selected ? <><button className="back-link" type="button" onClick={() => setSelected(null)}><ArrowLeft size={16}/>Back to results</button><ImportedServices key={selected} initialId={selected} directoryView staff={staff} enableStaff={() => {}} onNavigate={() => setSelected(null)}/></> : <>
        <div className="location-results-heading"><div><h2 ref={heading} tabIndex={-1}>Support in {bounds ? 'this map area' : place.label}</h2>{searchText && <p className="field-hint">Results for “{searchText}”</p>}</div><div className="directory-view-toggle" role="group" aria-label="Results view"><button type="button" aria-pressed={view==='list'} onClick={() => setView('list')}><List size={17}/>List</button><button type="button" aria-pressed={view==='map'} onClick={() => setView('map')}><MapIcon size={17}/>Map</button></div></div>
        {(place.lat!==undefined || bounds) && <div className="nearby-options"><p className="field-hint">{bounds ? 'Services inside the visible map area.' : 'Recorded sites within 10 miles. Distances are straight line.'}</p><label className="checkbox-label"><input type="checkbox" checked={includeUnknown} onChange={e => {setIncludeUnknown(e.target.checked);setPage(1);}}/><span>{bounds ? 'Include services without map locations' : 'Also show services with unknown distance'}</span></label></div>}
        {bounds && <button type="button" className="text-button" onClick={() => {setBounds(place.bounds ?? null);setPage(1);setIncludeUnknown(!place.bounds);}}>Reset to selected location</button>}{loading && <p role="status">Finding services…</p>}{error ? <p role="alert" className="form-error">{error}</p> : <>
          {data && <PublicAssistant autoRequestKey={assistantSearch} task="search" question={searchText} search={{q:searchText,area:place.area,lat:place.lat,lng:place.lng,bounds:bounds ? [bounds.west,bounds.south,bounds.east,bounds.north].join(',') : undefined,unknown:includeUnknown ? '1' : '0',urgency:urgent?'today':'normal'}} onSelect={select}/>}
          <div className="directory-results-count"><p role="status">{data?.total ?? 0} services</p>{data?.searchMode==='keyword' && searchText && <span className="field-hint">Keyword results · meaning-based search is unavailable</span>}</div>
          {!data?.total ? !loading && !error && data && <>{!searchText.trim() && <div className="empty-state panel"><Search size={32} aria-hidden="true"/><h3>No matching services</h3><p>Try different words or another area.</p><button className="button secondary" onClick={()=>{setPickerOpen(true);dialog.current?.showModal();}}>Change location</button></div>}</> : <ResizableResults view={view}>
            <div className="directory-results-list"><div className="result-list">{data.records.map(record => <article className={`service-card ${activeService===record.id?'is-highlighted':''}`} data-service-id={record.id} key={record.id} onMouseEnter={()=>setHoveredService(record.id)} onMouseLeave={()=>setHoveredService(null)} onFocus={()=>setHoveredService(record.id)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHoveredService(null);}}><div className="service-card-body"><div className="card-title-row"><h3><button className="import-service-link" onClick={() => select(record.id)}>{record.name}<ArrowRight size={16}/></button></h3><SaveServiceButton compact saved={saved.some(item=>item.id===record.id)} name={record.name} onToggle={()=>toggleDirectorySaved(record)}/></div><p className="directory-provider">{record.provider}</p><AvailabilityStamp confirmation={record.availabilityConfirmation}/>{urgent && record.urgentSupportEvidence && <span className="urgent-service-label" title={record.urgentSupportEvidence}>Urgent support listed</span>}{!!record.tags?.length && <ul className="directory-result-tags" aria-label="Service tags">{record.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}{(record.distanceMiles!==null || record.postcode) && <p className="field-hint">{record.distanceMiles!==null ? `${record.distanceMiles.toFixed(1)} miles${record.postcode ? ' · ' : ''}` : ''}{record.postcode}</p>}<button className="text-button agent-inline-link" onClick={()=>askAgent({question:'Explain this service',context:{title:record.name,area:place.area,serviceId:record.id,searchText:record.name+' '+record.snippet,facts:[`${record.name}: ${record.provider}.`,record.snippet,`Postcode: ${record.postcode ?? 'not supplied'}.`, 'Check eligibility, coverage, costs and current availability in the full service record and with the provider.'],prompts:['Explain this service','What details need checking?','Find similar provision']}})}>Ask agent about this service</button></div></article>)}</div>{data.total>20 && <div className="pagination"><button className="button secondary" disabled={page===1} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} of {Math.ceil(data.total/20)}</span><button className="button secondary" disabled={page*20>=data.total} onClick={() => setPage(page+1)}>Next</button></div>}</div>
            <aside className="directory-results-map" aria-label="Service map"><ServicesMap activeId={activeService} onHighlight={id=>{setMapSelectedService(id);setHoveredService(null);const card=[...document.querySelectorAll<HTMLElement>('[data-service-id]')].find(card=>card.dataset.serviceId===id);card?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}} services={data.mapRecords} area={place.area} origin={place.lat!==undefined ? {lat:place.lat,lng:place.lng!} : undefined} onSelect={select} bounds={bounds} onBoundsChange={next => {setBounds(previous => previous && Math.abs(previous.west-next.west)<0.000001 && Math.abs(previous.north-next.north)<0.000001 && Math.abs(previous.east-next.east)<0.000001 && Math.abs(previous.south-next.south)<0.000001 ? previous : next);setIncludeUnknown(false);setPage(1);}}/>{!!data.unmappedCount && <p className="map-caption">{data.unmappedCount} services have no recorded coordinates and appear in the list.</p>}</aside>
          </ResizableResults>}
        </>}
      </>}
    </section>}
  </div>;
}
