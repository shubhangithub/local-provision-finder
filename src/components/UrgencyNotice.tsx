import { CircleAlert } from 'lucide-react';
import { detectUrgency, needsHelpToday, type UrgencyMode } from '../lib/urgency';
import '../styles/urgency.css';
/** `checkbox` is just the toggle (so it can sit beside the region line); `details` is the guidance that follows it; the default is both. */
export default function UrgencyNotice({text,mode,onChange,staff=false,part='all'}:{text:string;mode:UrgencyMode;onChange:(mode:UrgencyMode)=>void;staff?:boolean;part?:'all'|'checkbox'|'details'}) {
 const signal=detectUrgency(text);const active=needsHelpToday(text,mode);
 const checkbox=<label className="checkbox-label"><input type="checkbox" checked={active} onChange={event=>onChange(event.target.checked?'today':'normal')}/><span>{staff?'Prioritise help today':'I need help today'}</span></label>;
 const details=<>
  {signal&&mode==='auto'&&<p className="urgency-detected">{signal.reason} · Help today switched on from your words.</p>}
  {active&&<p className="field-hint">Services listing urgent support appear first among relevant matches. Their availability today may not be recorded.</p>}
  {signal?.level==='danger'&&<section className="urgency-danger" aria-label="Immediate help"><CircleAlert size={24} aria-hidden="true"/><div><h2>Immediate help</h2><p>If someone’s life is at risk, call <a href="tel:999">999</a> or go to A&amp;E now.</p><p>For urgent mental health help in England, call <a href="tel:111">111</a> and select the mental health option.</p><a href="https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/" target="_blank" rel="noreferrer">NHS urgent help guidance</a></div></section>}
  {active&&signal?.topic==='mental-health'&&signal.level!=='danger'&&<p className="urgency-route">For urgent mental health help in England, call <a href="tel:111">111</a> and select the mental health option. <a href="https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/">NHS guidance</a></p>}
  {active&&signal?.topic==='housing'&&<p className="urgency-route"><a href="https://www.gov.uk/homelessness-help-from-council">Get housing or homelessness help from your council</a></p>}
 </>;
 const hasDetails=!!(signal&&mode==='auto')||active||signal?.level==='danger';
 if(part==='checkbox')return <div className="urgency-control urgency-checkbox">{checkbox}</div>;
 if(part==='details')return hasDetails ? <div className="urgency-control urgency-details">{details}</div> : null;
 return <div className="urgency-control">{checkbox}{details}</div>;
}
