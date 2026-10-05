import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { DirectorySummary } from '../lib/directory';
import '../styles/autocomplete.css';
export default function SearchAutocomplete({value,onChange,onChoose,params}:{value:string;onChange:(value:string)=>void;onChoose:(value:string)=>void;params:Record<string,string>}) {
 const [focused,setFocused]=useState(false);const [options,setOptions]=useState<DirectorySummary[]>([]);const [active,setActive]=useState(-1);const [busy,setBusy]=useState(false);const [dismissed,setDismissed]=useState(false);
 const request=JSON.stringify(params);const field=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  setOptions([]);setActive(-1);setBusy(false);
  if(!focused||dismissed||value.trim().length<3)return;
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{setBusy(true);try{
   const query=new URLSearchParams({...JSON.parse(request),q:value.trim(),mode:'semantic',page:'1'});
   const response=await fetch(`/api/imports?${query}`,{signal:controller.signal});if(!response.ok)throw new Error('Unavailable');
   const result=await response.json();if(!controller.signal.aborted)setOptions((result.records??[]).slice(0,5));
  }catch{/* The full search remains available when suggestions cannot load. */}finally{if(!controller.signal.aborted)setBusy(false);}},350);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[value,request,focused,dismissed]);
 const open=focused&&!dismissed&&(options.length>0||busy);
 const choose=(name:string)=>{setDismissed(true);setOptions([]);setActive(-1);onChoose(name);};
 return <div className="search-autocomplete"><label htmlFor="support-query" className="visually-hidden">What do you need help with?</label><div className="input-wrap directory-query"><Search size={20} aria-hidden="true"/><input ref={field} id="support-query" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?'support-suggestions':undefined} aria-activedescendant={open&&active>=0?`support-option-${active}`:undefined} value={value} onFocus={()=>setFocused(true)} onBlur={()=>{setFocused(false);setActive(-1);}} onChange={event=>{setDismissed(false);onChange(event.target.value);}} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();setDismissed(true);setActive(-1);}
  else if(open&&options.length&&event.key==='ArrowDown'){event.preventDefault();setActive(index=>(index+1)%options.length);}
  else if(open&&options.length&&event.key==='ArrowUp'){event.preventDefault();setActive(index=>(index-1+options.length)%options.length);}
  else if(open&&active>=0&&event.key==='Enter'){event.preventDefault();choose(options[active].name);}
 }} placeholder="For example, I’m feeling anxious or need help finding work" maxLength={250} autoComplete="off"/></div>
 {open&&<div className="autocomplete-panel" id={busy?'support-suggestions':undefined}>{busy?<p role="status" className="autocomplete-loading">Finding suggestions…</p>:<><p className="autocomplete-caption">Suggested services</p><ul id="support-suggestions" role="listbox" aria-label="Search suggestions">{options.map((option,index)=><li key={option.id} id={`support-option-${index}`} role="option" aria-selected={active===index} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option.name)}><Search size={16} aria-hidden="true"/><span>{option.name}</span></li>)}</ul></>}</div>}
 </div>;
}
