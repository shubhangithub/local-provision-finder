import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { readReminders, snoozeReminder, dismissReminder, readNotifications, dismissNotification } from '../lib/notifications';

function pendingCount(payload:unknown):number {
  if (!payload || typeof payload!=='object') return 0;
  const record=payload as Record<string,unknown>;
  const entries=record.entries ?? record.suggestions;
  return Array.isArray(entries) ? entries.filter(item => item && typeof item==='object' && ['pending','checking','submitted','draft'].includes(item.status)).length : 0;
}
export default function ServiceNotifications({onNavigate,staff=false}:{onNavigate:(route:string)=>void;staff?:boolean}) {
  const [reminders,setReminders]=useState(readReminders);
  const [messages,setMessages]=useState(readNotifications);
  const [queue,setQueue]=useState({feedback:0,suggestions:0});
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update=()=>{setReminders(readReminders());setMessages(readNotifications());};
    const events=['service-reminders-changed','service-notifications-changed','storage','focus'];
    events.forEach(event=>window.addEventListener(event,update));
    return () => events.forEach(event=>window.removeEventListener(event,update));
  },[]);
  useEffect(() => {
    if (!staff) {setQueue({feedback:0,suggestions:0});return;}
    let active=true;
    const abort=new AbortController();
    const load=async () => {
      const results=await Promise.allSettled(['/api/feedback','/api/suggestions'].map(async url=>{
        const response=await fetch(url,{signal:abort.signal});
        if (!response.ok) return null;
        return pendingCount(await response.json());
      }));
      if (!active) return;
      setQueue(previous=>({feedback:results[0].status==='fulfilled' && results[0].value!==null ? results[0].value : previous.feedback,suggestions:results[1].status==='fulfilled' && results[1].value!==null ? results[1].value : previous.suggestions}));
    };
    void load();
    const update=()=>void load();
    const interval=window.setInterval(update,60000);
    window.addEventListener('focus',update);window.addEventListener('directory-updated',update);window.addEventListener('suggestions-updated',update);
    return ()=>{active=false;abort.abort();window.clearInterval(interval);window.removeEventListener('focus',update);window.removeEventListener('directory-updated',update);window.removeEventListener('suggestions-updated',update);};
  },[staff]);
  useEffect(() => {
    if (!open) return;
    const outside=(event:PointerEvent) => {if (!container.current?.contains(event.target as Node)) setOpen(false);};
    const escape=(event:KeyboardEvent) => {if (event.key==='Escape') {setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return () => {document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const visible=reminders.filter(item => !item.snoozedUntil || new Date(item.snoozedUntil).getTime()<Date.now());
  const count=visible.length+messages.length+(staff && queue.feedback ? 1 : 0)+(staff && queue.suggestions ? 1 : 0);
  function navigate(route:string) {setOpen(false);onNavigate(route);}
  return <div className="service-notifications" ref={container}>
    <button ref={trigger} className="notification-trigger" aria-label="Notifications" aria-expanded={open} aria-controls="service-notifications-panel" onClick={() => setOpen(!open)}><Bell size={18} aria-hidden="true"/><span>Notifications</span>{!!count && <span className="notification-count">{count}</span>}</button>
    {open && <section id="service-notifications-panel" className="notifications-panel" aria-label="Notifications">
      <div className="notifications-heading"><h2>Notifications</h2><button className="icon-button" aria-label="Close notifications" onClick={() => {setOpen(false);trigger.current?.focus();}}><X size={19}/></button></div>
      {!count && <p>You’re all caught up.</p>}
      {staff && queue.feedback>0 && <article><h3>Feedback needs review</h3><p>{queue.feedback} {queue.feedback===1 ? 'report needs' : 'reports need'} checking.</p><button className="text-button" onClick={()=>navigate('/feedback')}>Review feedback</button></article>}
      {staff && queue.suggestions>0 && <article><h3>Service suggestions</h3><p>{queue.suggestions} {queue.suggestions===1 ? 'suggestion is' : 'suggestions are'} awaiting review.</p><button className="text-button" onClick={()=>navigate('/suggestions')}>Review suggestions</button></article>}
      {messages.map(item=><article key={item.id}><h3>{item.title}</h3><p>{item.body}</p><div className="notification-actions"><button className="text-button" onClick={()=>navigate(item.route)}>View service</button><button className="icon-button" aria-label={`Dismiss ${item.title} for ${item.serviceId}`} onClick={()=>dismissNotification(item.id)}><X size={16}/></button></div></article>)}
      {visible.map(item => <article key={item.id}><p>{item.reason==='viewed' ? 'You recently viewed' : 'You were recommended'} <strong>{item.name}</strong>.</p><p>{item.reason==='recommended' ? 'Did you find this recommendation useful?' : 'Are its details up to date?'}</p><div className="notification-actions"><button className="text-button" onClick={() => navigate(`/directory/${encodeURIComponent(item.id)}?feedback=1&context=${item.reason}`)}>Give feedback</button><button className="text-button muted" onClick={() => snoozeReminder(item.id)}>Later</button><button className="icon-button" aria-label={`Dismiss reminder for ${item.name}`} onClick={() => dismissReminder(item.id)}><X size={16}/></button></div></article>)}
    </section>}
  </div>;
}
