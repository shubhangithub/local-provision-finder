import { useEffect, useState } from 'react';
import { Bookmark, ArrowRight } from 'lucide-react';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
export default function SavedDirectoryServices({onNavigate}:{onNavigate:(route:string)=>void}) {
  const [saved,setSaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setSaved(readDirectorySaved());window.addEventListener('directory-saved-changed',update);window.addEventListener('storage',update);return () => {window.removeEventListener('directory-saved-changed',update);window.removeEventListener('storage',update);};},[]);
  return <div className="saved-directory-services result-list">{saved.map(service => <article className="service-card" key={service.id}><div className="service-card-body"><div className="card-title-row"><h3><button className="import-service-link" onClick={() => onNavigate(`/directory/${encodeURIComponent(service.id)}`)}>{service.name}<ArrowRight size={16}/></button></h3><button className="bookmark saved" aria-label={`Unsave ${service.name}`} aria-pressed="true" onClick={() => toggleDirectorySaved(service)}><Bookmark size={19} fill="currentColor"/></button></div><p className="directory-provider">{service.provider}</p><p className="field-hint">{service.postcode ?? 'Postcode not supplied'}</p></div></article>)}</div>;
}
