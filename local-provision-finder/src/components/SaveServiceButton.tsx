import {Bookmark} from 'lucide-react';
export default function SaveServiceButton({saved,name,onToggle,compact=false}:{saved:boolean;name:string;onToggle:()=>void;compact?:boolean}){
 return <button type="button" className={`save-service-button ${compact?'is-compact ':''}${saved?'is-saved':''}`} aria-label={`${saved?'Unsave':'Save'} ${name}`} aria-pressed={saved} title={saved?'Remove from saved services':'Add to saved services'} onClick={onToggle}>
 <Bookmark size={20} strokeWidth={1.75} fill={saved?'currentColor':'none'} aria-hidden="true"/>{!compact&&<span>{saved?'Saved':'Save service'}</span>}
 </button>;
}
