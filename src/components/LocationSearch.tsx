import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, ArrowLeft, ArrowRight } from 'lucide-react';
import ImportedServices from './ImportedServices';
interface Place { label: string; area?: string; lat?: number; lng?: number }
interface RecordSummary { id: string; name: string; provider: string; postcode: string | null; distanceMiles: number | null }
export default function LocationSearch({ text }: { text: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{total: number; records: RecordSummary[]} | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const geoRequest = useRef(0);
  function close() { geoRequest.current++; setLocating(false); dialog.current?.close(); trigger.current?.focus(); }
  function choose(next: Place) { setPlace(next); setPage(1); setSelected(null); setSearchText(text); setError(''); close(); }
  function currentLocation() {
    if (!navigator.geolocation) { setLocationError('Your browser does not support location. Choose an area or enter a postcode.'); return; }
    setLocating(true); setLocationError(''); const request = ++geoRequest.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== geoRequest.current) return;
      choose({label:'Your current location',lat:position.coords.latitude,lng:position.coords.longitude});
    }, failure => { if (request !== geoRequest.current) return; setLocating(false); setLocationError(failure.code === 1 ? 'Location access was declined. Choose an area or enter a postcode instead.' : 'We could not find your location. Choose an area or enter a postcode instead.'); }, {timeout:10000,maximumAge:60000,enableHighAccuracy:false});
  }
  useEffect(() => {
    if (!place) return;
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({q:searchText,page:String(page)});
    if (place.area) params.set('area',place.area);
    else { params.set('lat',String(place.lat)); params.set('lng',String(place.lng)); }
    fetch(`/api/imports?${params}`,{signal:controller.signal}).then(async response => {if (!response.ok) throw new Error(); setData(await response.json()); setLoading(false);}).catch(e => {if (e.name !== 'AbortError') {setError('Could not load the local directory. Please try again.');setLoading(false);}});
    return () => controller.abort();
  },[place,page,searchText]);
  useEffect(() => () => { geoRequest.current++; },[]);
  return <div className="location-search">
    <button ref={trigger} type="button" className="location-trigger" onClick={() => {setLocationError('');dialog.current?.showModal();}}><MapPin size={20} aria-hidden="true"/><span><strong>Where?</strong><span>{place?.label ?? 'Choose an area or use your location'}</span></span></button>
    <dialog ref={dialog} className="location-dialog" aria-labelledby="location-title" onCancel={e => {e.preventDefault();close();}}>
      <div className="location-dialog-heading"><h2 id="location-title">Where do you need support?</h2><button type="button" className="icon-button" aria-label="Close location picker" onClick={close}><X size={20}/></button></div>
      <form onSubmit={e => {e.preventDefault();if (draft.trim()) choose({label:draft.trim().toUpperCase(),area:/^bristol$/i.test(draft.trim()) ? 'Bristol' : /^kingston(?: upon thames)?$/i.test(draft.trim()) ? 'Kingston' : draft.trim()});}}><label htmlFor="location-query">Town or service postcode</label><input autoFocus id="location-query" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Bristol, Kingston or BS4" maxLength={80}/><button className="button primary" type="submit" disabled={!draft.trim()}>Search this area<ArrowRight size={16}/></button></form>
      <button type="button" className="location-current" disabled={locating} onClick={currentLocation}><Navigation size={19}/>{locating ? 'Finding your location…' : 'Use current location'}</button>
      <p className="field-hint">Your browser will ask permission. Your precise location is used for this search and is not saved.</p>
      {locationError && <p role="alert" className="form-error">{locationError}</p>}
      <h3>Explore the directories</h3><div className="location-destinations">{['Bristol','Kingston'].map(area => <button type="button" key={area} onClick={() => choose({label:area === 'Kingston' ? 'Kingston upon Thames' : area,area})}><MapPin size={24}/><strong>{area === 'Kingston' ? 'Kingston upon Thames' : area}</strong><span>{area === 'Bristol' ? 'Well Aware directory' : 'Connected Kingston directory'}</span></button>)}</div>
    </dialog>
    {place && <section className="location-results" aria-label="Real directory results">
      {selected ? <><button className="back-link" type="button" onClick={() => setSelected(null)}><ArrowLeft size={16}/>Back to area results</button><ImportedServices key={selected} initialId={selected} staff enableStaff={() => {}} onNavigate={() => setSelected(null)}/></> : <><div className="location-results-heading"><h2>Support in {place.label}</h2><button type="button" className="text-button" onClick={() => {setSearchText(text);setPage(1);}}>Apply your search words</button></div><p className="field-hint">Real directory preview · check details with the provider.{place.lat !== undefined ? ' Closest recorded sites within 10 miles. Services without coordinates are excluded; browse a directory above to see them.' : 'Directory coverage may extend beyond the selected town.'}{searchText ? ` Searching for “${searchText}”.` : ''}</p>
      {loading ? <p role="status">Finding services…</p> : <><p role="status">{data?.total ?? 0} services</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="result-list">{data?.records.map(record => <article className="service-card" key={record.id}><div className="service-card-body"><h3><button className="import-service-link" onClick={() => setSelected(record.id)}>{record.name}<ArrowRight size={16}/></button></h3><p>{record.provider}</p><p className="field-hint">{record.distanceMiles !== null ? `${record.distanceMiles.toFixed(1)} miles · ` : ''}{record.postcode ?? 'Postcode not supplied'}</p></div></article>)}</div>{data?.total === 0 && <p>Try another area or clear your search words. Location information is incomplete.</p>}{!!data && data.total>20 && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} of {Math.ceil(data.total/20)}</span><button className="button secondary" disabled={page*20>=data.total} onClick={() => setPage(page+1)}>Next</button></div>}</>}
      </>}
    </section>}
  </div>;
}
