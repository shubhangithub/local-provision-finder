import SaveServiceButton from './SaveServiceButton';
import { useEffect, useState } from 'react';
import { askAgent } from '../lib/agent';
import { ArrowRight } from 'lucide-react';
import { readDirectorySaved, toggleDirectorySaved } from '../lib/directory-saved';
export default function SavedDirectoryServices({onNavigate}:{onNavigate:(route:string)=>void}) {
  const [saved,setSaved]=useState(readDirectorySaved);
  useEffect(() => {const update=()=>setSaved(readDirectorySaved());window.addEventListener('directory-saved-changed',update);window.addEventListener('storage',update);return () => {window.removeEventListener('directory-saved-changed',update);window.removeEventListener('storage',update);};},[]);
  return <div className="saved-directory-services result-list">{saved.map(service => <article className="service-card" key={service.id}><div className="service-card-body"><div className="card-title-row"><h2><button className="import-service-link" onClick={() => onNavigate(`/directory/${encodeURIComponent(service.id)}`)}>{service.name}<ArrowRight size={16}/></button></h2><SaveServiceButton compact saved name={service.name} onToggle={()=>toggleDirectorySaved(service)}/></div><p className="directory-provider">{service.provider}</p><p className="field-hint">{service.postcode ?? 'Postcode not supplied'}</p><button className="text-button agent-inline-link" onClick={()=>askAgent({question:'What details need checking?',context:{title:service.name,serviceId:service.id,searchText:service.name,facts:[`${service.name}: ${service.provider}.`,`Postcode: ${service.postcode ?? 'not supplied'}.`,'The saved list does not include current eligibility, availability or access details. Open the service record and confirm these with the provider before recommending it.'],prompts:['What details need checking?','Find similar provision']}})}>Ask agent about this service</button></div></article>)}</div>;
}
