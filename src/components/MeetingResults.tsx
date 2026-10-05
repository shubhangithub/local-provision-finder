import { useEffect, useRef } from 'react';
import type { AssistantResult } from '../lib/assistant';
import { transcriptText, type LiveConcept, type TranscriptLine } from '../lib/live-meeting';
import LiveServices, { visibleServices, type MeetingChoice, type useMeetingShortlist } from './LiveServices';
import NextStepsReport from './NextStepsReport';
import ResultsTabs from './ResultsTabs';

interface Props {
  lines: TranscriptLine[]; concepts: LiveConcept[]; dismissed: Set<string>; onDismiss: (id: string) => void;
  shortlist: ReturnType<typeof useMeetingShortlist>; endedAt: number; seconds: number; download: string; onRestart: () => void;
  summary: AssistantResult | null; summarising: boolean; summaryError: string; onSummarise: () => void;
}

const length = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function Summary({ summary, summarising, summaryError, onSummarise, hasTranscript }: Pick<Props, 'summary' | 'summarising' | 'summaryError' | 'onSummarise'> & { hasTranscript: boolean }) {
  if (!hasTranscript) return <p className="meeting-note">Nothing was transcribed, so there is nothing to summarise.</p>;
  return <>
    {summarising && <p role="status">Preparing a meeting summary…</p>}
    {summaryError && <div className="meeting-error" role="alert"><p>{summaryError}</p><button type="button" className="button secondary" onClick={onSummarise}>Try again</button></div>}
    {summary && <section className="meeting-summary" aria-label="Meeting summary"><h3>Draft meeting summary</h3><p className="meeting-summary-mode">{summary.mode === 'openai' ? 'AI-assisted draft' : 'Local directory draft'}</p><p>{summary.summary}</p>
      {!!summary.needs?.length && <><h4>Support discussed</h4><ul className="meeting-needs">{summary.needs.map((need, index) => <li key={`${need}-${index}`}>{need.replace(/-/g, ' ')}</li>)}</ul></>}
      {!!summary.nextSteps.length && <><h4>Things to check</h4><ul>{summary.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ul></>}
      {!!summary.citations?.length && <details><summary>Directory evidence</summary>{summary.citations.map((citation, index) => <blockquote key={`${citation.id}-${index}`}><a href={`/#/directory/${encodeURIComponent(citation.id)}`}>{citation.name}</a><p>{citation.excerpt}</p></blockquote>)}</details>}
      {!!summary.warnings?.length && <div className="meeting-summary-warnings">{summary.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      <p className="meeting-note">AI-generated draft. Review it before using it.</p>
    </section>}
  </>;
}

/** What staff see once the meeting is over: the next steps first, everything else a tab away. */
export default function MeetingResults(props: Props) {
  const { lines, concepts, dismissed, onDismiss, shortlist, endedAt, seconds, download, onRestart } = props;
  const transcript = transcriptText(lines, true);
  const choices: MeetingChoice[] = shortlist.picked;
  const fallback: MeetingChoice[] = concepts.flatMap(concept => visibleServices(concept, dismissed).slice(0, 2).map(service => ({ service, concept: concept.label })));
  const topics = concepts.map(concept => concept.label);
  const unsaved = concepts.reduce((total, concept) => total + visibleServices(concept, dismissed).filter(service => !shortlist.savedIds.has(service.id)).length, 0);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView?.({ block: 'start' }); }, []);
  return <div className="meeting-results" ref={top}>
    <div className="meeting-heading">
      <div><h2>Meeting ended</h2><p className="meeting-meta">Length {length(seconds)} · {choices.length} {choices.length === 1 ? 'service' : 'services'} saved</p></div>
      <div className="meeting-heading-actions"><span className="meeting-status">Microphone off</span>
        {download && <a className="meeting-download" href={download} download="jobcentre-meeting.webm">Download meeting audio</a>}
        <button type="button" className="button secondary meeting-start" onClick={onRestart}>Start another meeting</button></div>
    </div>
    <NextStepsReport choices={choices} fallback={fallback} topics={topics} endedAt={endedAt} />
    <ResultsTabs label="Meeting details" tabs={[
      { id: 'summary', label: 'Summary', panel: <Summary summary={props.summary} summarising={props.summarising} summaryError={props.summaryError} onSummarise={props.onSummarise} hasTranscript={!!transcript} /> },
      { id: 'transcript', label: 'Transcript', panel: <><div className="meeting-transcript" role="region" aria-label="Transcript" tabIndex={0}>{transcript || 'Nothing was transcribed.'}</div><p className="meeting-note">Machine-generated from the audio and may contain mistakes. Check it before relying on it.</p></> },
      { id: 'suggestions', label: `More suggestions${unsaved ? ` (${unsaved})` : ''}`, panel: <><p className="meeting-note">Tick a service to add it to the next steps above.</p><LiveServices concepts={concepts} dismissed={dismissed} onDismiss={onDismiss} shortlist={shortlist} /></> },
    ]} />
  </div>;
}
