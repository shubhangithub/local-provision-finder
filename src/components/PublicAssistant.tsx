import { useEffect, useRef, useState } from 'react';
import '../styles/assistant.css';
import AssistantLoading from './AssistantLoading';
interface Citation {id:string;name:string;url?:string;excerpt?:string}
function retryDelay(signal:AbortSignal):Promise<void>{return new Promise((resolve,reject)=>{
 if(signal.aborted){reject(signal.reason);return;}
 const abort=()=>{window.clearTimeout(timer);reject(signal.reason);};
 const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},750);
 signal.addEventListener('abort',abort,{once:true});
});}
function sourceUrl(value?:string){try{const url=new URL(value ?? '');return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}}
interface Discovery {suggestionId:number|string;name:string;provider:string;description:string;url:string;postcode?:string;reviewStatus:'pending';scope?:'local'|'national'|'unclear';providerType?:string}
interface Answer {mode:'openai'|'local';summary:string;answer:string;needs:string[];nextSteps:string[];citations:Citation[];warnings:string[];discoveries?:Discovery[]}
interface Props {task:'search'|'service';question?:string;search?:{q:string;area?:string;lat?:number;lng?:number;bounds?:string;unknown?:'0'|'1';urgency?:'today'|'normal'};serviceId?:string;onSelect?:(id:string)=>void;autoRequestKey?:number}
export default function PublicAssistant({task,question='',search,serviceId,onSelect,autoRequestKey=0}:Props) {
 const [draft,setDraft]=useState('');const [answer,setAnswer]=useState<Answer|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const controller=useRef<AbortController|null>(null);
 // Submit, geography and display filters share one request lifecycle. Catalogue rerenders
 // must not consume the trigger or interrupt an overview that is already being generated.
 const primaryContext=JSON.stringify({task,question,serviceId,area:search?.area,lat:search?.lat,lng:search?.lng});
 const requestContext=JSON.stringify({primaryContext,search});
 const previous=useRef<{primary:string;key:number}|null>(null);
 useEffect(()=>{
  if(task!=='search'||!autoRequestKey)return;
  const prior=previous.current;previous.current={primary:primaryContext,key:autoRequestKey};
  const submitted=!prior||prior.key!==autoRequestKey||prior.primary!==primaryContext;
  if(submitted){setAnswer(null);setError('');}
  const timer=window.setTimeout(()=>void ask(),submitted?0:700);
  return()=>{window.clearTimeout(timer);controller.current?.abort();};
 },[requestContext,autoRequestKey]);
 useEffect(()=>{if(task==='service'){controller.current?.abort();setAnswer(null);setError('');setLoading(false);}},[primaryContext]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function ask(){
  controller.current?.abort();const request=new AbortController();controller.current=request;
  setLoading(true);setError('');if(task!=='search')setAnswer(null);
  const body=JSON.stringify({task,question:task==='service'?draft.trim():question.trim()||'Explain the support available in this area',search,serviceId});
  try{
   for(let attempt=0;attempt<2;attempt++){
    let response:Response;
    try{response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,body});}
    catch(cause){if(request.signal.aborted||attempt)throw cause;await retryDelay(request.signal);continue;}
    const data=await response.json();
    const temporary=[502,503,504].includes(response.status)||response.status===429&&/busy/i.test(data.error??'');
    if(!response.ok){if(temporary&&!attempt){await retryDelay(request.signal);continue;}throw new Error(data.error||'Assistance is unavailable. Please try again.');}
    if(!request.signal.aborted)setAnswer(data);break;
   }
  }catch(cause){if(!request.signal.aborted)setError(cause instanceof Error?cause.message:'Assistance is unavailable. Please try again.');}
  finally{if(!request.signal.aborted)setLoading(false);}
 }
 function linkedSummary(value:string){if(!onSelect||!answer?.citations?.length)return value;const parts:React.ReactNode[]=[];let cursor=0;while(cursor<value.length){const matches=answer.citations.map(citation=>({citation,index:value.toLowerCase().indexOf(citation.name.toLowerCase(),cursor)})).filter(match=>match.index>=0).sort((a,b)=>a.index-b.index||b.citation.name.length-a.citation.name.length);const match=matches[0];if(!match){parts.push(value.slice(cursor));break;}parts.push(value.slice(cursor,match.index));parts.push(<button className="overview-service-link" key={`${match.citation.id}-${cursor}`} onClick={()=>onSelect(match.citation.id)}>{value.slice(match.index,match.index+match.citation.name.length)}</button>);cursor=match.index+match.citation.name.length;}return parts;}
 if(task==='search'&&!loading&&!error&&!answer)return null;
 return <section className="public-assistant" aria-label={task==='service'?'Ask about this service':'Search overview'}>
 {task==='search'&&<h2>AI search overview</h2>}
 {task==='service'?<><h2>Ask about this service</h2><p className="field-hint">For example, do I need a referral, or is there a charge?</p><form onSubmit={e=>{e.preventDefault();void ask();}}><label htmlFor={`service-question-${serviceId}`} className="visually-hidden">Your question about this service</label><input id={`service-question-${serviceId}`} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000}/><button className="button secondary" disabled={loading||!draft.trim()} type="submit">Ask a question</button></form></>:error&&<button type="button" className="text-button" disabled={loading} onClick={()=>void ask()}>Retry agent search</button>}
 {loading&&<AssistantLoading>{task==='search'?'Finding support and checking relevant sources…':'Reading the service information…'}</AssistantLoading>}{error&&<p role="alert" className="form-error">{error}</p>}
 {answer && task==='search' && !answer.discoveries?.length && !answer.citations?.length && !answer.warnings?.some(w=>/unavailable|could not|not connected/i.test(w)) && <div className="empty-state"><h3>No matching services</h3><p>The agent also found no suitable providers online. Try different words or another area.</p></div>}{!loading && answer && task==='search' && answer.warnings?.some(w=>/unavailable|could not|not connected/i.test(w)) && <button className="text-button" onClick={()=>void ask()}>Retry agent search</button>}{answer&&<div className="assistant-answer" aria-live="polite"><p className="assistant-mode">{answer.mode==='openai'?'AI assistance · based on directory information':'Directory information · local assistance'}</p>{answer.summary&&<p className="assistant-summary">{task==='search'?linkedSummary(answer.summary):answer.summary}</p>}{answer.answer&&answer.answer!==answer.summary&&(task==='search'?<details className="assistant-evidence"><summary>More about these results</summary><p className="assistant-prose">{answer.answer}</p></details>:<p className="assistant-prose">{answer.answer}</p>)}{!!answer.nextSteps?.length&&<><h3>Next steps</h3><ul>{answer.nextSteps.map((step,i)=><li key={i}>{step}</li>)}</ul></>}{!!answer.citations?.length&&<details className="assistant-source-list" open={task==='service'}><summary>Supporting evidence</summary><ul className="assistant-citations">{answer.citations.map((citation,i)=><li key={`${citation.id}-${i}`}>{onSelect?<button type="button" className="text-button" onClick={()=>onSelect(citation.id)}>{citation.name}</button>:<strong>{citation.name}</strong>}{(citation.excerpt||sourceUrl(citation.url))&&<details className="assistant-evidence"><summary>View source evidence</summary>{citation.excerpt&&<p>{citation.excerpt.slice(0,2000)}{citation.excerpt.length>2000?'…':''}</p>}{sourceUrl(citation.url)&&<a href={sourceUrl(citation.url)!} target="_blank" rel="noreferrer">Original source</a>}</details>}</li>)}</ul></details>}{!!answer.discoveries?.length&&<div className="assistant-discoveries"><h3>More services found online</h3><p className="field-hint">Suggested from web sources · These listings were found by AI and have not been approved by staff. Check details with the provider before using a service.</p>{answer.discoveries.map(discovery=><article className="assistant-discovery" key={discovery.suggestionId}><span className="assistant-pending">Provisional · Not yet reviewed{discovery.scope==='local'?' · Local support':discovery.scope==='national'?' · National support':discovery.scope==='unclear'?' · Coverage needs checking':''}{discovery.providerType==='commercial'?' · Private / paid provision':''}</span><h4>{sourceUrl(discovery.url)?<a href={sourceUrl(discovery.url)!} target="_blank" rel="noreferrer">{discovery.name}</a>:discovery.name}</h4>{discovery.provider&&<p>{discovery.provider}</p>}<p>{discovery.description}</p>{discovery.postcode&&<p className="field-hint">{discovery.postcode}</p>}<p className="field-hint">Sent to staff for review.</p></article>)}</div>}{answer.warnings?.map((warning,i)=><p className="field-hint" key={i}>{warning}</p>)}</div>}
 </section>;
}
