import { useEffect, useRef } from 'react';
import { visibleServices, type MeetingChoice, type useMeetingShortlist } from './LiveServices';
import type { LiveConcept } from '../lib/live-meeting';
import NextStepsReport from './NextStepsReport';
import FollowUpOffer from './FollowUpOffer';
import TakeAway from './TakeAway';
import '../styles/meeting-results.css';
interface Props {
  concepts: LiveConcept[]; dismissed: Set<string>; shortlist: ReturnType<typeof useMeetingShortlist>;
  endedAt: number; seconds: number; urgent: boolean; download: string; onRestart: () => void;
}
const length = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** What staff see when a meeting ends: one box each for the outcome, the next steps, the follow-up call and the hand-over. */
export default function MeetingResults({ concepts, dismissed, shortlist, endedAt, seconds, download, onRestart, urgent }: Props) {
  const choices: MeetingChoice[] = shortlist.picked;
  const fallback: MeetingChoice[] = concepts.flatMap(concept => visibleServices(concept, dismissed, urgent).slice(0, 2).map(service => ({ service, concept: concept.label })));
  const topics = concepts.map(concept => concept.label);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView?.({ block: 'start' }); }, []);
  return <div className="meeting-results" ref={top}>
    <section className="meeting-box no-print" aria-labelledby="meeting-ended-title">
      <div className="meeting-box-head">
        <div><h2 id="meeting-ended-title">Meeting ended</h2><p className="meeting-meta">Length {length(seconds)} · {choices.length} {choices.length === 1 ? 'service' : 'services'} saved</p></div>
        <button type="button" className="button secondary meeting-start" onClick={onRestart}>Start another meeting</button>
      </div>
      {download && <p className="meeting-footer"><a className="meeting-download" href={download} download="jobcentre-meeting.webm">Download meeting audio</a></p>}
    </section>
    <div className="meeting-box"><NextStepsReport choices={choices} fallback={fallback} topics={topics} endedAt={endedAt} /></div>
    <FollowUpOffer services={choices.map(choice => ({ id: choice.service.id, name: choice.service.name }))} />
    <TakeAway hasSteps={choices.length > 0 || fallback.length > 0} />
  </div>;
}
