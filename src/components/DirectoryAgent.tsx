import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, ExternalLink } from 'lucide-react';
import { agentEvent, agentPageContext, type AgentContext, type AgentRequest } from '../lib/agent';
import { selectedServiceId, asksForAlternatives } from '../lib/service-agent';
import { directoryAreas, type DirectoryResponse, type DirectorySummary } from '../lib/directory';
import { readRegion, regionParams, regionSearch } from '../lib/region';
import '../styles/agent.css';
import AssistantLoading from './AssistantLoading';
interface Message { role:'user'|'agent'; text:string; page?:string; records?:DirectorySummary[]; failed?:boolean; sources?:{id:string;name:string;url:string;excerpt:string}[]; mode?:'openai'|'local' }
export default function DirectoryAgent({route,staff,context,onNavigate}:{route:string;staff:boolean;context?:AgentContext;onNavigate:(route:string)=>void}) {
  const [open,setOpen]=useState(false);const [specific,setSpecific]=useState<AgentContext|null>(null);const [messages,setMessages]=useState<Message[]>([]);const [question,setQuestion]=useState('');const [busy,setBusy]=useState(false);
  const current=context && context.title===specific?.title ? context : specific ?? context ?? agentPageContext(route,staff);const contextRef=useRef(current);contextRef.current=current;
  const controller=useRef<AbortController|null>(null);const generation=useRef(0);const input=useRef<HTMLTextAreaElement>(null);const end=useRef<HTMLDivElement>(null);const returnFocus=useRef<HTMLElement|null>(null);
  const runRef=useRef<(question:string,context?:AgentContext)=>void>(()=>{});
  useEffect(()=>{setSpecific(null);controller.current?.abort();generation.current++;setBusy(false);},[route]);
  useEffect(()=>{
    const receive=(event:Event)=>{const request=(event as CustomEvent<AgentRequest>).detail ?? {};returnFocus.current=document.activeElement as HTMLElement;setOpen(true);if(request.context)setSpecific(request.context);if(request.question)runRef.current(request.question,request.context);};
    window.addEventListener(agentEvent,receive);return()=>{window.removeEventListener(agentEvent,receive);controller.current?.abort();};
  },[]);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages,busy]);
  function close(){setOpen(false);returnFocus.current?.focus();}
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open]);
  async function run(text:string,override?:AgentContext) {
    const clean=text.trim().slice(0,1000);if(!clean)return;
    controller.current?.abort();const request=++generation.current;const page=override ?? contextRef.current;
    setMessages(previous=>[...previous.slice(-19),{role:'user',text:clean,page:page.title}]);setQuestion('');
    const serviceId=selectedServiceId(page,route);
    if(serviceId&&!asksForAlternatives(clean)){
      const abort=new AbortController();controller.current=abort;setBusy(true);
      try{
        const recordResponse=await fetch(`/api/imports/service?id=${encodeURIComponent(serviceId)}`,{signal:abort.signal});if(!recordResponse.ok)throw new Error('The selected service could not be loaded.');
        const record=(await recordResponse.json()).record;
        const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({task:'service',serviceId,question:clean})});
        const answer=await response.json();
        if(!response.ok)throw new Error(answer.error||'AI assistance is unavailable. Please try again.');
        if(answer.mode!=='openai'||!answer.answer?.trim())throw new Error((answer.warnings??[]).find((warning:string)=>/OpenAI|API|quota|rate|unavailable|connected/i.test(warning))||'AI assistance could not answer. Please try again.');
        if(request===generation.current&&!abort.signal.aborted)setMessages(previous=>[...previous,{role:'agent',text:answer.answer,page:record.name,sources:Array.isArray(answer.citations)?answer.citations:[],mode:'openai'}]);
      }catch(error){if(request===generation.current&&!abort.signal.aborted)setMessages(previous=>[...previous,{role:'agent',text:error instanceof Error?error.message:'AI assistance is unavailable. Please try again.',page:page.title,failed:true}]);}
      finally{if(request===generation.current)setBusy(false);}
      return;
    }
    if(!/\b(find|search|recommend|similar|alternatives|support near|provision in)\b/i.test(clean)){
      const abort=new AbortController();controller.current=abort;setBusy(true);
      try{const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({task:'guidance',question:clean,pageContext:[page.title,...page.facts].join('\n\n').slice(0,20000)})});const answer=await response.json();if(!response.ok||answer.mode!=='openai')throw new Error('AI assistance is unavailable. Please try again.');if(request===generation.current&&!abort.signal.aborted)setMessages(previous=>[...previous,{role:'agent',text:answer.answer,page:page.title,mode:'openai'}]);}
      catch{if(request===generation.current&&!abort.signal.aborted)setMessages(previous=>[...previous,{role:'agent',text:'AI assistance is unavailable. Please try again.',page:page.title,failed:true}]);}
      finally{if(request===generation.current)setBusy(false);}return;
    }
    let query=clean;
    if (/^find (relevant provision|provision for (this|a) customer|similar provision|alternatives)$/i.test(clean) || /^help me find support$/i.test(clean)) {
      if(!page.searchText){setMessages(previous=>[...previous,{role:'agent',text:'What kind of help is needed? Tell me the customer’s needs and, if relevant, the town or postcode.',page:page.title}]);setBusy(false);return;}
      query=page.searchText.slice(0,250);
    }
    const abort=new AbortController();controller.current=abort;setBusy(true);
    try {
      const params=new URLSearchParams({q:query.slice(0,250),mode:'semantic',page:'1'});
      const region=readRegion();
      for(const [key,value] of Object.entries(regionParams(region)))params.set(key,value);
      const mentionedElsewhere=directoryAreas.find(item=>new RegExp(`\\b(?:${item.id}|${item.label}${item.id==='Buckinghamshire'?'|Bucks':''})\\b`,'i').test(clean)&&item.id!==region?.area);
      const response=await fetch(`/api/imports?${params}`,{signal:abort.signal});if(!response.ok)throw new Error();const data:DirectoryResponse=await response.json();
      if(request!==generation.current)return;
      let text=data.records.length ? 'Matching directory services are listed below.' : 'No matching directory services were found.';let mode:Message['mode']='local';let sources:Message['sources']=[];let records=data.records.slice(0,3);
      try{const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({task:'search',question:clean,search:{q:query.slice(0,250),...regionSearch(region)}})});if(response.ok){const answer=await response.json();if(answer.mode==='openai'){mode='openai';text=[answer.summary,answer.answer!==answer.summary?answer.answer:'',...(answer.nextSteps??[])].filter(Boolean).join('\n\n');}sources=answer.citations??[];if(answer.services?.length)records=answer.services.slice(0,3);}}catch{if(abort.signal.aborted)return;}
      if(request!==generation.current||abort.signal.aborted)return;
      if(mentionedElsewhere)text+=`\n\nI searched ${region?.label??'all areas'}. To search ${mentionedElsewhere.label}, change the region in the header settings.`;
      setMessages(previous=>[...previous,{role:'agent',page:page.title,text,records,sources,mode}]);
    }catch{if(request===generation.current && !abort.signal.aborted)setMessages(previous=>[...previous,{role:'agent',page:page.title,text:'I couldn’t load the directory just now. Please try again.',failed:true}]);}
    finally{if(request===generation.current)setBusy(false);}
  }
  runRef.current=(text,override)=>{void run(text,override);};
  if(!open)return null;
  return <aside className="directory-agent" role="complementary" aria-label="Directory agent"><header className="agent-panel-heading"><div><MessageSquare size={20}/><h2>Directory agent</h2></div><button className="icon-button" aria-label="Close agent" onClick={close}><X size={22}/></button></header><div className="agent-page-context"><span>Helping with</span><strong>{current.title}</strong></div><div className="agent-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Agent conversation">{!messages.length && <div className="agent-welcome"><h3>How can I help?</h3><p>Find provision, check service details or work through the next step.</p></div>}{messages.map((message,index)=><article className={`agent-message ${message.role}`} key={index}><strong>{message.role==='user' ? 'You' : 'Directory agent'}</strong>{message.role==='agent'&&message.mode&&<small>{message.mode==='openai'?'AI answer · source grounded':'Local guidance · no AI response'}</small>}<p>{message.text}</p>{message.page && message.role==='agent' && <small>{message.page}</small>}{message.sources?.length ? <details className="agent-sources"><summary>Source information used</summary>{message.sources.map((source,index)=><div key={`${source.id}-${index}`}><strong>{source.name}</strong><p>{source.excerpt.slice(0,2000)}</p>{/^https?:\/\//i.test(source.url)&&<a href={source.url} target="_blank" rel="noreferrer">Original source<ExternalLink size={14}/></a>}</div>)}</details>:null}{message.records?.map(record=><div className="agent-result" key={record.id}><h3><button className="text-button" onClick={()=>{if(route.startsWith('/meeting')){window.open(`#/directory/${encodeURIComponent(record.id)}`,'_blank','noopener,noreferrer');}else{close();onNavigate(`/directory/${encodeURIComponent(record.id)}`);}}}>{record.name}</button></h3><p>{record.provider}{record.postcode ? ` · ${record.postcode}` : ''}</p><p>{record.snippet}</p><a href={`#/directory/${encodeURIComponent(record.id)}`} target="_blank" rel="noreferrer">Open service details<ExternalLink size={14}/></a></div>)}</article>)}{busy&&<AssistantLoading>Checking information and preparing your answer…</AssistantLoading>}<div ref={end}/></div><div className="agent-prompt-options" aria-label="Agent suggestions">{(current.prompts ?? ['What needs checking?','Find relevant provision']).map(prompt=><button key={prompt} disabled={busy} className="text-button" onClick={()=>void run(prompt)}>{prompt}</button>)}</div><form className="agent-question-form" onSubmit={event=>{event.preventDefault();void run(question);}}><label htmlFor="agent-question">Ask the agent</label><textarea ref={input} id="agent-question" value={question} onChange={event=>setQuestion(event.target.value)} rows={2} maxLength={1000} placeholder="Describe what you need help with…"/><button className="button primary" disabled={busy||!question.trim()} type="submit">{busy ? 'Checking…' : 'Ask agent'}</button></form></aside>;
}
