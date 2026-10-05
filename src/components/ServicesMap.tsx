import { useEffect, useRef, useState } from 'react';
import { areaCentre, type MapService, type MapBounds } from '../lib/directory';
import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
interface Props {
  services:MapService[];area?:string;origin?:{lat:number;lng:number};onSelect:(id:string)=>void;
  activeId?:string|null;onHighlight?:(id:string)=>void;onBoundsChange?:(bounds:MapBounds)=>void;bounds?:MapBounds | null;picker?:boolean;
}
// A few records carry stray coordinates; frame the bulk of the pins (2nd-98th percentile) rather than every outlier.
function framingBounds(points:[number,number][]):[[number,number],[number,number]] {
  const trimmed=(values:number[]) => {const sorted=[...values].sort((a,b) => a-b);return [sorted[Math.floor((sorted.length-1)*0.02)],sorted[Math.ceil((sorted.length-1)*0.98)]];};
  const [south,north]=trimmed(points.map(point => point[0]));const [west,east]=trimmed(points.map(point => point[1]));
  return [[south,west],[north,east]];
}
export default function ServicesMap({services,area,origin,onSelect,onBoundsChange,bounds,picker=false,activeId,onHighlight}:Props) {
  const container=useRef<HTMLDivElement>(null);const map=useRef<LeafletMap | null>(null);const markers=useRef<LayerGroup | null>(null);
  const callbacks=useRef({onSelect,onBoundsChange,onHighlight});callbacks.current={onSelect,onBoundsChange,onHighlight};
  const serviceMarkers=useRef<{marker:Marker;ids:string[]}[]>([]);const highlighted=useRef(activeId);highlighted.current=activeId;
  const initial=useRef({area,origin,bounds});
  const [loaded,setLoaded]=useState(false);const [error,setError]=useState(false);const [autoSearch,setAutoSearch]=useState(true);
  const automatic=useRef(true);automatic.current=autoSearch;
  const ignoreMove=useRef(false);const userMovement=useRef(false);const hasInteracted=useRef(false);const ensureVisible=useRef<(()=>void)|null>(null);const frame=useRef({fixed:false,hasBounds:false});const latest=useRef({area,origin,bounds});latest.current={area,origin,bounds};const hidden=useRef(false);const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingBounds,setPendingBounds]=useState<MapBounds | null>(null);
  frame.current={fixed:!!(area || origin || bounds),hasBounds:!!bounds};
  const viewKey=`${area}:${origin?.lat}:${origin?.lng}`;const lastView=useRef(viewKey);
  useEffect(() => {
    let cancelled=false;if (!container.current) return;
    void import('leaflet').then(L => {
      if (cancelled || !container.current) return;
      const value=initial.current;
      const areaLocation=areaCentre(value.area);
      const centre:[number,number]=value.origin ? [value.origin.lat,value.origin.lng] : [areaLocation.lat,areaLocation.lng];
      const instance=L.map(container.current,{scrollWheelZoom:true,minZoom:5,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1});map.current=instance;
      let visibleOnce=container.current.clientWidth>0 && container.current.clientHeight>0;
      if (value.bounds && visibleOnce) instance.fitBounds([[value.bounds.south,value.bounds.west],[value.bounds.north,value.bounds.east]]);else instance.setView(value.bounds ? [(value.bounds.south+value.bounds.north)/2,(value.bounds.west+value.bounds.east)/2] : centre,12);
      const tiles=L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
      let failures=0;tiles.on('tileerror',() => {if (++failures>=3 && !cancelled) setError(true);});
      markers.current=L.layerGroup().addTo(instance);
      const interacted=()=>{userMovement.current=true;hasInteracted.current=true;};
      container.current.addEventListener('pointerdown',interacted);container.current.addEventListener('wheel',interacted);container.current.addEventListener('keydown',interacted);
      instance.on('dragstart',interacted);
      instance.on('moveend',() => {
        if (ignoreMove.current) {ignoreMove.current=false;userMovement.current=false;return;}
        if (!userMovement.current) return;userMovement.current=false;
        const viewport=instance.getBounds();const next={west:viewport.getWest(),south:viewport.getSouth(),east:viewport.getEast(),north:viewport.getNorth()};
        setPendingBounds(next);
        if (timer.current) clearTimeout(timer.current);
        if (automatic.current || picker) timer.current=setTimeout(() => callbacks.current.onBoundsChange?.(next),350);
      });
      const resize=new ResizeObserver(() => {
        instance.invalidateSize({pan:true,animate:false});
        const shown=!!container.current && container.current.clientWidth>0 && container.current.clientHeight>0;
        if (!shown) hidden.current=true;
        else if (hidden.current && visibleOnce) {
          // Shown again after being hidden (e.g. the mobile list/map switch): apply the view that changed meanwhile.
          hidden.current=false;ignoreMove.current=true;
          const current=latest.current;
          if (current.bounds) instance.fitBounds([[current.bounds.south,current.bounds.west],[current.bounds.north,current.bounds.east]],{animate:false});
          else {const place=current.origin ?? areaCentre(current.area);instance.setView([place.lat,place.lng],12,{animate:false});}
          setTimeout(() => {ignoreMove.current=false;},0);
          ensureVisible.current?.();
        }
        if (!visibleOnce && container.current && container.current.clientWidth>0 && container.current.clientHeight>0) {
          visibleOnce=true;ignoreMove.current=true;
          if (value.bounds) instance.fitBounds([[value.bounds.south,value.bounds.west],[value.bounds.north,value.bounds.east]],{animate:false});else instance.setView(centre,12,{animate:false});
          // setView may not emit moveend when the centre/zoom are unchanged.
          setTimeout(() => {ignoreMove.current=false;},0);
          ensureVisible.current?.();
        }
      });resize.observe(container.current);instance.on('unload',() => resize.disconnect());
      setLoaded(true);
      // The container may only get its final size after this frame (sticky/flex layout).
      requestAnimationFrame(() => {if (!cancelled && map.current===instance) instance.invalidateSize({animate:false});});
      if (picker) {const viewport=instance.getBounds();callbacks.current.onBoundsChange?.({west:viewport.getWest(),south:viewport.getSouth(),east:viewport.getEast(),north:viewport.getNorth()});}
    }).catch(() => {if (!cancelled) setError(true);});
    return () => {cancelled=true;if (timer.current) clearTimeout(timer.current);map.current?.remove();map.current=null;markers.current=null;};
  },[]);
  useEffect(() => {
    if (!loaded || !map.current || lastView.current===viewKey) return;
    lastView.current=viewKey;hasInteracted.current=false;
    const areaLocation=areaCentre(area);
    const centre:[number,number]=origin ? [origin.lat,origin.lng] : [areaLocation.lat,areaLocation.lng];
    ignoreMove.current=true;map.current.setView(centre,12,{animate:false});
    if (picker) {const viewport=map.current.getBounds();callbacks.current.onBoundsChange?.({west:viewport.getWest(),south:viewport.getSouth(),east:viewport.getEast(),north:viewport.getNorth()});}
  },[loaded,viewKey]);
  // A new region bounds (e.g. a chosen map area) must move the view; a bounds change that just mirrors the viewport, from the user's own panning, must not.
  const boundsKey=bounds ? `${bounds.west},${bounds.south},${bounds.east},${bounds.north}` : '';
  useEffect(() => {
    const instance=map.current;if (!loaded || !instance || !bounds || picker) return;
    const box=container.current;if (!box || box.clientWidth===0 || box.clientHeight===0) return;
    const view=instance.getBounds();
    const same=['west','south','east','north'].every(key => {const current={west:view.getWest(),south:view.getSouth(),east:view.getEast(),north:view.getNorth()}[key as keyof MapBounds];return Math.abs(current-bounds[key as keyof MapBounds])<0.0005;});
    if (same) return;
    ignoreMove.current=true;instance.fitBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]],{animate:false});
    setTimeout(() => {ignoreMove.current=false;},0);
  },[loaded,boundsKey]);
  useEffect(() => {
    if (!loaded || !map.current || !markers.current) return;
    let cancelled=false;
    void import('leaflet').then(L => {
      if (cancelled || !markers.current) return;
      const layer=markers.current;layer.clearLayers();serviceMarkers.current=[];
      const groups=new Map<string,{lat:number;lng:number;entries:MapService[];label:string}>();
      for (const service of services) for (const site of service.sites) {
        if (site.lat===null || site.lng===null) continue;
        const key=`${site.lat}:${site.lng}`;const group=groups.get(key);
        if (group) {if (!group.entries.some(entry => entry.id===service.id)) group.entries.push(service);}
        else groups.set(key,{lat:site.lat,lng:site.lng,entries:[service],label:site.label});
      }
      for (const group of groups.values()) {
        const popup=document.createElement('div');popup.className='map-popup';const heading=document.createElement('strong');heading.textContent=group.label;popup.appendChild(heading);
        for (const service of group.entries) {const button=document.createElement('button');button.type='button';button.className='map-service-link';button.textContent=service.name;button.addEventListener('click',() => callbacks.current.onSelect(service.id));popup.appendChild(button);}
        const title=group.entries.length===1 ? group.entries[0].name : `${group.entries.length} services at ${group.label}`;
        const marker=L.marker([group.lat,group.lng],{title,alt:title,icon:L.divIcon({className:'service-map-pin',html:`<span>${group.entries.length>1 ? group.entries.length : '•'}</span>`,iconSize:[32,40],iconAnchor:[16,40],popupAnchor:[0,-36]})}).addTo(layer).bindPopup(popup,{maxHeight:240});
        marker.on('click',()=>callbacks.current.onHighlight?.(group.entries[0].id));
        const ids=group.entries.map(entry=>entry.id);serviceMarkers.current.push({marker,ids});
        marker.getElement()?.classList.toggle('is-highlighted',ids.includes(highlighted.current??''));
      }
      ensureVisible.current=() => {
        const instance=map.current;const box=container.current;
        if (picker || !instance || !box || box.clientWidth===0 || box.clientHeight===0) return;
        // Some records carry 0,0 ("null island") instead of a location; never frame the view around those.
        const points=services.flatMap(service => service.sites.filter(site => site.lat!==null && site.lng!==null && !(site.lat===0 && site.lng===0)).map(site => [site.lat!,site.lng!] as [number,number]));
        if (!points.length) return;
        instance.invalidateSize({animate:false});
        const view=instance.getBounds();
        // Frame the pins when nothing fixes the view and the user has not moved it, or when none of them are in view.
        const noneInView=!points.some(([lat,lng]) => view.contains([lat,lng]));
        if ((frame.current.fixed || hasInteracted.current) && !(noneInView && !frame.current.hasBounds)) return;
        ignoreMove.current=true;instance.fitBounds(framingBounds(points),{padding:[40,40],maxZoom:13,animate:false});
        // fitBounds may not emit moveend when the view is unchanged.
        setTimeout(() => {ignoreMove.current=false;},0);
      };
      ensureVisible.current();
      if (origin) L.marker([origin.lat,origin.lng],{title:'Your current location',alt:'Your current location',icon:L.divIcon({className:'current-map-pin',html:'<span></span>',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(layer).bindPopup('Your current location');
    });
    return () => {cancelled=true;};
  },[loaded,services,origin?.lat,origin?.lng]);
  useEffect(()=>{for(const {marker,ids} of serviceMarkers.current){const active=ids.includes(activeId??'');marker.getElement()?.classList.toggle('is-highlighted',active);marker.setZIndexOffset(active?1000:0);}},[activeId]);
  return <div className={`services-map-panel ${picker ? 'picker-map-panel' : ''}`}>
    {!picker && onBoundsChange && <div className="map-search-controls"><label><input type="checkbox" checked={autoSearch} onChange={e => {setAutoSearch(e.target.checked);if (e.target.checked && pendingBounds) callbacks.current.onBoundsChange?.(pendingBounds);}}/>Search as I move the map</label>{!autoSearch && <button className="button secondary small" disabled={!pendingBounds} onClick={() => {if (pendingBounds) callbacks.current.onBoundsChange?.(pendingBounds);}}>Search this map area</button>}</div>}
    <div ref={container} className="services-map" role="region" aria-label={picker ? 'Choose a search area on the map' : 'Map of service locations'}/>
    {error && <p className="map-status">Map tiles could not load. Service details are still available in the list.</p>}
    <p className="map-caption">{picker ? 'Move or zoom the map, then use the visible area.' : `${services.length} ${services.length===1 ? 'service has' : 'services have'} recorded coordinates. Select a pin to view details.`}</p>
  </div>;
}
