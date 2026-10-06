import {useCallback,useEffect,useRef,useState} from 'react';
import {staffHeaders} from './ServiceEnrichment';
import '../styles/enrichment.css';
interface FollowUp {status:'scheduled'|'requested'|'completed'|'denied'|'failed'|'expired';outcome:string|null;reason:string|null;reportIds:string[]}
const outcomeLabels:Record<string,string>={answered:'Person answered.',partly_answered:'Person answered some questions.',declined:'Person declined to talk.',wrong_person:'Someone else answered, nothing recorded.'};
/** One line of follow-up status for a report, with the staff button that places the (sandbox) call. Renders nothing for a report with no consent. */
export default function FollowUpPanel({feedbackId,onChanged}:{feedbackId:string;onChanged?:()=>void}) {
  const [followUp,setFollowUp]=useState<FollowUp | null>(null);const [configured,setConfigured]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const was=useRef<string>('');
  const load=useCallback(async()=>{
    try {const response=await fetch(`/api/follow-ups?feedbackId=${encodeURIComponent(feedbackId)}`,{headers:staffHeaders});if (response.status===404) {setFollowUp(null);return;}const data=await response.json();if (!response.ok) throw new Error(data.error);setFollowUp(data.followUp);setConfigured(data.configured);} catch (e) {setError(e instanceof Error ? e.message : 'Could not load the follow-up.');}
  },[feedbackId]);
  useEffect(()=>{void load();},[load]);
  const status=followUp?.status ?? '';
  useEffect(()=>{
    if (status==='requested') {was.current='requested';const timer=setTimeout(()=>void load(),3000);return ()=>clearTimeout(timer);}
    if (was.current==='requested' && status) {was.current='';window.dispatchEvent(new Event('directory-updated'));onChanged?.();}
  },[status,followUp,load,onChanged]);
  async function start() {
    setBusy(true);setError('');
    try {const response=await fetch('/api/follow-ups',{method:'POST',headers:staffHeaders,body:JSON.stringify({feedbackId})});const data=await response.json();if (!response.ok) throw new Error(data.error);setFollowUp(data.followUp);} catch (e) {setError(e instanceof Error ? e.message : 'Could not request the follow-up.');await load();} finally {setBusy(false);}
  }
  if (!followUp) return error ? <p className="form-error" role="alert">{error}</p> : null;
  const canStart=['scheduled','denied','failed'].includes(status);
  return <section className="followup-line" aria-label="Follow-up call">
    <span>
      {status==='scheduled' && 'Follow-up scheduled in 1 week'}
      {status==='requested' && <span role="status">Follow-up call in progress…</span>}
      {status==='completed' && <span role="status">Follow-up complete. {outcomeLabels[followUp.outcome ?? ''] ?? ''}{followUp.reportIds.length ? ` ${followUp.reportIds.length} change to review.` : ' Nothing to review.'}</span>}
      {(status==='denied' || status==='failed') && <span role="alert">Follow-up did not go ahead: {followUp.reason || 'no reason given'}</span>}
      {status==='expired' && 'Number deleted after 30 days.'}
      {' '}<span className="followup-sandbox">Sandbox demo</span>
    </span>
    {canStart && <button type="button" className="text-button" onClick={() => void start()} disabled={busy || !configured}>{status==='scheduled' ? 'Follow up now' : 'Try again'}</button>}
    {canStart && !configured && <span className="followup-status">Not configured. Set GOV_HACK_URL and GOV_HACK_API_TOKEN.</span>}
    {error && <span className="form-error" role="alert">{error}</span>}
  </section>;
}
