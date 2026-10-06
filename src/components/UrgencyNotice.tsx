import { CircleAlert } from 'lucide-react';
import { detectUrgency, needsHelpToday, type UrgencyMode } from '../lib/urgency';
import '../styles/urgency.css';
export default function UrgencyNotice({text,mode,onChange,staff=false,showToggle=true}:{text:string;mode:UrgencyMode;onChange:(mode:UrgencyMode)=>void;staff?:boolean;showToggle?:boolean}) {
 const signal=detectUrgency(text);const active=needsHelpToday(text,mode);
 const checkbox=<label className="checkbox-label"><input type="checkbox" checked={active} onChange={event=>onChange(event.target.checked?'today':'normal')}/><span>{staff?'Prioritise help today':'I need help today'}</span></label>;
 const details=<>
  {signal&&mode==='auto'&&<p className="urgency-detected">{signal.reason} · Help today switched on from your words.</p>}
  {signal?.level==='danger'&&<section className="urgency-danger" aria-label="Immediate help"><CircleAlert size={24} aria-hidden="true"/><div><h2>Immediate help</h2><p>If someone’s life is at risk, call <a href="tel:999">999</a> or go to A&amp;E now.</p><p>For urgent mental health help in England, call <a href="tel:111">111</a> and select the mental health option.</p><a href="https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/" target="_blank" rel="noreferrer">NHS urgent help guidance</a></div></section>}
  {active&&signal?.topic==='mental-health'&&signal.level!=='danger'&&<p className="urgency-route">For urgent mental health help in England, call <a href="tel:111">111</a> and select the mental health option. <a href="https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/">NHS guidance</a></p>}
  {active&&signal?.topic==='housing'&&<p className="urgency-route"><a href="https://www.gov.uk/homelessness-help-from-council">Get housing or homelessness help from your council</a></p>}
 </>;
  return <div className="urgency-control">{showToggle && checkbox}{details}</div>;
}
