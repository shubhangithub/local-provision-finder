import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Navigation, Settings, X } from 'lucide-react';
import ServicesMap from './ServicesMap';
import { directoryAreas, type MapBounds, type MapService } from '../lib/directory';
import { regionMenuEvent, resolveArea, useRegion } from '../lib/region';

/** Header cog dropdown: the only place the search region is chosen. */
export default function RegionMenu() {
  const [region,setRegion]=useRegion();
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState('');
  const [locating,setLocating]=useState(false);
  const [locationError,setLocationError]=useState('');
  const [mapOpen,setMapOpen]=useState(false);
  const [mapArea,setMapArea]=useState('Bristol');
  const [mapBounds,setMapBounds]=useState<MapBounds|null>(null);
  const [mapServices,setMapServices]=useState<MapService[]>([]);
  const container=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const geoRequest=useRef(0);
  const selectedArea=directoryAreas.find(item=>item.id===region?.area)?.id ?? '';
  function close(focus=true) {geoRequest.current++;setLocating(false);setLocationError('');setOpen(false);setMapOpen(false);if(focus)trigger.current?.focus();}
  function choose(next:Parameters<typeof setRegion>[0]) {setRegion(next);close();}
  useEffect(() => {const show=()=>{setOpen(true);trigger.current?.scrollIntoView({block:'nearest'});};window.addEventListener(regionMenuEvent,show);return()=>window.removeEventListener(regionMenuEvent,show);},[]);
  useEffect(() => {
    if (!open) return;
    const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))close(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  useEffect(() => {
    if (!mapOpen) return;
    const controller=new AbortController();
    fetch('/api/imports?area=&mode=semantic',{signal:controller.signal}).then(response=>response.json()).then(result=>setMapServices(result.mapRecords ?? [])).catch(()=>{});
    return()=>controller.abort();
  },[mapOpen]);
  useEffect(() => () => {geoRequest.current++;},[]);
  function currentLocation() {
    if (!navigator.geolocation) {setLocationError('Your browser does not support location. Choose an area or enter a postcode.');return;}
    setLocating(true);setLocationError('');const request=++geoRequest.current;
    navigator.geolocation.getCurrentPosition(position=>{if(request!==geoRequest.current)return;choose({label:'Your current location',lat:position.coords.latitude,lng:position.coords.longitude});},failure=>{if(request!==geoRequest.current)return;setLocating(false);setLocationError(failure.code===1?'Location access was declined. Choose an area or enter a postcode instead.':'We could not find your location. Choose an area or enter a postcode instead.');},{timeout:10000,maximumAge:60000,enableHighAccuracy:false});
  }
  function submitText(event:FormEvent) {
    event.preventDefault();
    const text=draft.trim();if(!text)return;
    const area=resolveArea(text);const named=directoryAreas.find(item=>item.id===area);
    setDraft('');choose({label:named?named.label:text.toUpperCase(),area});
  }
  
  return <div className="region-menu" ref={container}>
    <button ref={trigger} type="button" className="notification-trigger region-trigger" aria-label={region ? `Region settings, ${region.label}` : 'Region settings'} aria-haspopup="true" aria-expanded={open} aria-controls="region-menu-panel" onClick={()=>open?close():setOpen(true)}><Settings size={18} aria-hidden="true"/>{region && <span className="region-trigger-label">{region.label}</span>}</button>
    {open && <section id="region-menu-panel" className="region-panel" aria-label="Region settings">
      <div className="region-panel-heading"><h2>Search region</h2><button type="button" className="icon-button" aria-label="Close region settings" onClick={()=>close()}><X size={19}/></button></div>
      <p className="region-current" role="status">{region ? <>Searching in <strong>{region.label}</strong></> : <>No region set</>}</p>
      <div className="field"><label htmlFor="region-area">Area</label><select id="region-area" value={selectedArea} onChange={event=>{const value=event.target.value;if(!value){if(region)choose(null);return;}const area=directoryAreas.find(item=>item.id===value)!;choose({label:area.label,area:area.id});}}><option value="">No region</option>{directoryAreas.map(area=><option key={area.id} value={area.id}>{area.label}</option>)}</select></div>
      <form className="region-text" onSubmit={submitText}><label htmlFor="region-query">Town or postcode</label><div><input id="region-query" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Town or postcode" maxLength={80} autoComplete="off"/><button className="button primary" type="submit" aria-label="Use this area" disabled={!draft.trim()}>Use<ArrowRight size={16}/></button></div></form>
      <button type="button" className="location-current" disabled={locating} onClick={currentLocation}><Navigation size={19}/>{locating?'Finding your location…':'Use current location'}</button>
      {locationError && <p role="alert" className="form-error">{locationError}</p>}
      <details className="region-map" onToggle={event=>setMapOpen(event.currentTarget.open)}><summary>Choose on the map</summary>
        {mapOpen && <div className="picker-map-section"><div className="field"><label htmlFor="region-map-centre">Start the map at</label><select id="region-map-centre" value={mapArea} onChange={event=>setMapArea(event.target.value)}>{directoryAreas.map(area=><option key={area.id} value={area.id}>{area.label}</option>)}</select></div>
          <ServicesMap picker services={mapServices} area={mapArea} bounds={region?.bounds} onSelect={id=>{const area=directoryAreas.find(item=>item.id===mapArea)!;choose({label:area.label,area:area.id});window.location.hash=`/directory/${encodeURIComponent(id)}`;}} onBoundsChange={setMapBounds}/>
          <button type="button" className="button primary" disabled={!mapBounds} onClick={()=>{if(mapBounds)choose({label:'Selected map area',bounds:mapBounds});}}>Use this map area<ArrowRight size={16}/></button></div>}
      </details>
      {region && <button type="button" className="text-button region-clear" onClick={()=>choose(null)}>Clear region</button>}
    </section>}
  </div>;
}
