import { useEffect, useRef, useState } from 'react';
import { areaCentre, type MapService, type MapBounds } from '../lib/directory';
import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
interface Props {
  services:MapService[];area?:string;origin?:{lat:number;lng:number};onSelect:(id:string)=>void;
  activeId?:string|null;onHighlight?:(id:string)=>void;onBoundsChange?:(bounds:MapBounds)=>void;bounds?:MapBounds | null;picker?:boolean;
}
export default function ServicesMap({services,area,origin,onSelect,onBoundsChange,bounds,picker=false,activeId,onHighlight}:Props) {
  const container=useRef<HTMLDivElement>(null);const map=useRef<LeafletMap | null>(null);const markers=useRef<LayerGroup | null>(null);
  const callbacks=useRef({onSelect,onBoundsChange,onHighlight});callbacks.current={onSelect,onBoundsChange,onHighlight};
  const serviceMarkers=useRef<{marker:Marker;ids:string[]}[]>([]);const highlighted=useRef(activeId);highlighted.current=activeId;
  const initial=useRef({area,origin,bounds});
  const [loaded,setLoaded]=useState(false);const [error,setError]=useState(false);const [autoSearch,setAutoSearch]=useState(true);
  const automatic=useRef(true);automatic.current=autoSearch;
  const ignoreMove=useRef(false);const userMovement=useRef(false);const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingBounds,setPendingBounds]=useState<MapBounds | null>(null);
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
      const interacted=()=>{userMovement.current=true;};
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
        if (!visibleOnce && container.current && container.current.clientWidth>0 && container.current.clientHeight>0) {
          visibleOnce=true;ignoreMove.current=true;
          if (value.bounds) instance.fitBounds([[value.bounds.south,value.bounds.west],[value.bounds.north,value.bounds.east]],{animate:false});else instance.setView(centre,12,{animate:false});
          // setView may not emit moveend when the centre/zoom are unchanged.
          setTimeout(() => {ignoreMove.current=false;},0);
        }
      });resize.observe(container.current);instance.on('unload',() => resize.disconnect());
      setLoaded(true);
      if (picker) {const viewport=instance.getBounds();callbacks.current.onBoundsChange?.({west:viewport.getWest(),south:viewport.getSouth(),east:viewport.getEast(),north:viewport.getNorth()});}
    }).catch(() => {if (!cancelled) setError(true);});
    return () => {cancelled=true;if (timer.current) clearTimeout(timer.current);map.current?.remove();map.current=null;markers.current=null;};
  },[]);
  useEffect(() => {
    if (!loaded || !map.current || lastView.current===viewKey) return;
    lastView.current=viewKey;
    const areaLocation=areaCentre(area);
    const centre:[number,number]=origin ? [origin.lat,origin.lng] : [areaLocation.lat,areaLocation.lng];
    ignoreMove.current=true;map.current.setView(centre,12,{animate:false});
    if (picker) {const viewport=map.current.getBounds();callbacks.current.onBoundsChange?.({west:viewport.getWest(),south:viewport.getSouth(),east:viewport.getEast(),north:viewport.getNorth()});}
  },[loaded,viewKey]);
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
