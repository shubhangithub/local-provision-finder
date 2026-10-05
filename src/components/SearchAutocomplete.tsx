import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import '../styles/autocomplete.css';
export default function SearchAutocomplete({value,onChange,onChoose,area}:{value:string;onChange:(value:string)=>void;onChoose:(value:string)=>void;area?:string}) {
 const [focused,setFocused]=useState(false);const [options,setOptions]=useState<string[]>([]);const [active,setActive]=useState(-1);const [busy,setBusy]=useState(false);const [dismissed,setDismissed]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  setOptions([]);setActive(-1);setBusy(false);
  if(!focused||dismissed||value.trim().length<2)return;
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{setBusy(true);try{
   const query=new URLSearchParams({q:value.trim(),...(area?{area}:{})});
   const response=await fetch(`/api/suggest?${query}`,{signal:controller.signal});if(!response.ok)throw new Error('Unavailable');
   const result=await response.json();if(!controller.signal.aborted)setOptions(Array.isArray(result.terms)?result.terms.slice(0,6):[]);
  }catch{/* The full search remains available when suggestions cannot load. */}finally{if(!controller.signal.aborted)setBusy(false);}},350);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[value,area,focused,dismissed]);
 const open=focused&&!dismissed&&(options.length>0||busy);
 const choose=(name:string)=>{setDismissed(true);setOptions([]);setActive(-1);onChoose(name);};
 return <div className="search-autocomplete"><label htmlFor="support-query" className="visually-hidden">What do you need help with?</label><div className="input-wrap directory-query"><Search size={20} aria-hidden="true"/><input ref={field} id="support-query" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?'support-suggestions':undefined} aria-activedescendant={open&&active>=0?`support-option-${active}`:undefined} value={value} onFocus={()=>setFocused(true)} onBlur={()=>{setFocused(false);setActive(-1);}} onChange={event=>{setDismissed(false);onChange(event.target.value);}} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();setDismissed(true);setActive(-1);}
  else if(open&&options.length&&event.key==='ArrowDown'){event.preventDefault();setActive(index=>(index+1)%options.length);}
  else if(open&&options.length&&event.key==='ArrowUp'){event.preventDefault();setActive(index=>(index-1+options.length)%options.length);}
  else if(open&&active>=0&&event.key==='Enter'){event.preventDefault();choose(options[active]);}
 }} placeholder="For example, I’m feeling anxious or need help finding work" maxLength={250} autoComplete="off"/></div>
 {open&&<div className="autocomplete-panel" id={busy?'support-suggestions':undefined}>{busy?<p role="status" className="autocomplete-loading">Finding suggestions…</p>:<><p className="autocomplete-caption">Suggested searches</p><ul id="support-suggestions" role="listbox" aria-label="Search suggestions">{options.map((option,index)=><li key={option} id={`support-option-${index}`} role="option" aria-selected={active===index} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}><Search size={16} aria-hidden="true"/><span>{option}</span></li>)}</ul></>}</div>}
 </div>;
}
