import { notifySaved } from './notifications';
export interface SavedDirectoryService {id:string;name:string;provider:string;postcode:string | null}
const key='lp-directory-saved-v1';
export function readDirectorySaved():SavedDirectoryService[] {
  try {const value=JSON.parse(localStorage.getItem(key) ?? '[]');return Array.isArray(value) ? value.filter(item => typeof item.id==='string' && typeof item.name==='string' && typeof item.provider==='string').slice(0,100) : [];} catch {return [];}
}
export function toggleDirectorySaved(service:SavedDirectoryService) {
  const previous=readDirectorySaved();const next=previous.some(item => item.id===service.id) ? previous.filter(item => item.id!==service.id) : [...previous,service].slice(0,100);
  try {localStorage.setItem(key,JSON.stringify(next));} catch {/* Browser storage may be disabled. */}
  if (next.some(item=>item.id===service.id)) notifySaved(service.id,service.name);
  window.dispatchEvent(new Event('directory-saved-changed'));
}
