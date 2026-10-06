import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {feedbackFields,answerLabels,type FeedbackEntry} from '../lib/feedback';
/** One open report as a single row. A call finding with a proposed change is applied or dismissed in one click. */
export default function ReportRow({entry,onOpen,onDone,onChanged}:{entry:FeedbackEntry;onOpen:(entry:FeedbackEntry)=>void;onDone:(message:string)=>void;onChanged:()=>void}) {
  const proposed=entry.proposed;const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function decide(action:'corrected'|'dismissed') {
    if (!proposed) return;setBusy(true);setError('');
    const body=action==='corrected'
      ? {id:entry.id,action,verified:true,field:proposed.field,newValue:proposed.value,note:`Confirmed on a follow-up call (sandbox demo): "${proposed.quote}"`}
      : {id:entry.id,action,note:'Dismissed from the queue.'};
    try {
      const response=await fetch('/api/feedback/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if (!response.ok) throw new Error(data.error);
      window.dispatchEvent(new Event('directory-updated'));onDone(action==='corrected' ? `${feedbackFields[proposed.field]} updated for ${entry.serviceName}.` : 'Report dismissed.');
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not save.');setBusy(false);}
  }
  const summary=`${answerLabels[entry.answers.upToDate]}${entry.answers.issues.length ? ` · ${entry.answers.issues.map(issue => feedbackFields[issue]).join(', ')}` : ''}`;
  return <li className="report-row">
    <div className="report-main">
      <h2>{entry.serviceName}</h2>
      {proposed
        ? <p className="report-change"><strong>{feedbackFields[proposed.field]}:</strong> <del>{proposed.previous || 'not listed'}</del> <span aria-hidden="true">→</span><span className="visually-hidden"> changed to</span> <ins>{proposed.value}</ins><q>{proposed.quote}</q></p>
        : <p className="report-summary">{summary}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <div className="report-actions">
      {proposed ? <>
        <button type="button" className="button primary" disabled={busy} onClick={() => void decide('corrected')}>Apply<span className="visually-hidden"> change to {entry.serviceName}</span></button>
        <button type="button" className="text-button" disabled={busy} onClick={() => void decide('dismissed')}>Dismiss</button>
      </> : <button type="button" className="button secondary" onClick={() => onOpen(entry)}>Review<ArrowRight size={16}/><span className="visually-hidden"> report for {entry.serviceName}</span></button>}
    </div>
  </li>;
}
