import UrgencyNotice from './UrgencyNotice';
import { type UrgencyMode, needsHelpToday } from '../lib/urgency';
import { useEffect, useRef, useState } from 'react';
import '../styles/meeting.css';
import { askAssistant, type AssistantResult } from '../lib/assistant';
import { directoryAreas } from '../lib/directory';
import { startPcmCapture, type PcmCapture } from '../lib/mic';
import { transcriptText, useLiveMeeting } from '../lib/live-meeting';
import Waveform from './Waveform';
import LiveServices, { useMeetingShortlist, visibleServices, type MeetingChoice } from './LiveServices';
import NextStepsReport from './NextStepsReport';

const DURATION = 600;


export default function MeetingDemo({ enabled, onEnd, area }: { enabled: boolean; onEnd?: () => void; area?: string }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'finishing' | 'finished'>('idle');
  const [error, setError] = useState('');
  const [urgency, setUrgency] = useState<UrgencyMode>('auto');
  const [remaining, setRemaining] = useState(DURATION);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [endedAt, setEndedAt] = useState(0);
  const live = useLiveMeeting();
  const shortlist = useMeetingShortlist();
  const capture = useRef<PcmCapture | null>(null);
  const [download, setDownload] = useState('');
  const [meetingArea, setMeetingArea] = useState('Bristol');
  const [summary, setSummary] = useState<AssistantResult | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequest = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const resultGeneration = useRef(0);
  const downloadRef = useRef('');
  const finishRef = useRef<() => void>(() => {});
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const release = (keepRecording: boolean) => {
    generation.current += 1;
    if (!keepRecording) resultGeneration.current += 1;
    const recording = recorder.current;
    recorder.current = null;
    if (recording) {
      if (!keepRecording) recording.onstop = null;
      if (recording.state !== 'inactive') recording.stop();
    }
    capture.current?.stop();
    capture.current = null;
    setAnalyser(null);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  const finish = async () => {
    release(true);
    setEndedAt(Date.now());
    setPhase('finishing');
    await live.finish(); // flush the last utterance and let topic tracking settle
    setPhase('finished');
    onEndRef.current?.();
  };
  finishRef.current = finish;

  useEffect(() => {
    if (!enabled) {
      release(false);
      summaryRequest.current?.abort();
      setSummary(null);
      setSummaryError('');
      setSummarising(false);
      live.close();
      live.reset();
      shortlist.clear();
      setDismissed(new Set());
      setPhase('idle');
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      downloadRef.current = '';
      setDownload('');
    }
  }, [enabled]);
  useEffect(() => () => {
    release(false);
    live.close();
    summaryRequest.current?.abort();
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
  }, []);
  useEffect(() => {
    if (phase !== 'recording') return;
    const started = Date.now();
    const clock = window.setInterval(() => {
      const seconds = Math.max(0, DURATION - Math.floor((Date.now() - started) / 1000));
      setRemaining(seconds);
      if (!seconds) finishRef.current();
    }, 250);
    return () => window.clearInterval(clock);
  }, [phase]);

  async function start() {
    summaryRequest.current?.abort();
    setSummary(null);
    setSummaryError('');
    setSummarising(false);
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is unavailable in this browser. Try a current browser on localhost or HTTPS.');
      return;
    }
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    downloadRef.current = '';
    setDownload('');
    live.reset();
    shortlist.clear();
    setDismissed(new Set());
    setPhase('requesting');
    const request = ++generation.current;
    let timeout: number | undefined;
    try {
      const permission = navigator.mediaDevices.getUserMedia({ audio: true });
      permission.then(audio => { if (request !== generation.current) audio.getTracks().forEach(track => track.stop()); }, () => {});
      const audio = await Promise.race([
        permission,
        new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error('timeout')), 30000); }),
      ]);
      if (request !== generation.current) return;
      stream.current = audio;
      await live.open(area || meetingArea).catch(error => { throw Object.assign(error instanceof Error ? error : new Error('Live transcription could not start.'), { live: true }); }); // must be ready before audio is sent
      if (request !== generation.current) { live.close(); return; }
      const pcm = await startPcmCapture(audio, live.sendAudio);
      if (request !== generation.current) { pcm.stop(); live.close(); return; }
      capture.current = pcm;
      setAnalyser(pcm.analyser);
      const recording = new MediaRecorder(audio);
      const chunks: Blob[] = [];
      const resultToken = ++resultGeneration.current;
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        if (!chunks.length || resultToken !== resultGeneration.current) return;
        const url = URL.createObjectURL(new Blob(chunks, { type: recording.mimeType || 'audio/webm' }));
        downloadRef.current = url;
        setDownload(url);
      };
      recording.onerror = () => {
        release(false);
        setPhase('finished');
        setError('Recording stopped unexpectedly. You can start a new meeting.');
      };
      recorder.current = recording;
      recording.start(1000);
      setRemaining(DURATION);
      setPhase('recording');
      setUrgency('auto');
    } catch (cause) {
      if (request !== generation.current) return;
      release(false);
      live.close();
      setPhase('idle');
      const name = cause instanceof Error ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Microphone permission was not granted. Allow access in your browser to start a meeting.' : (cause as { live?: boolean }).live ? (cause as Error).message : cause instanceof Error && cause.message === 'timeout' ? 'Microphone access took too long. Please try again.' : 'Could not start the microphone. Check that it is connected and available.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function summarise() {
    summaryRequest.current?.abort();
    const controller = new AbortController();
    summaryRequest.current = controller;
    setSummarising(true);
    setSummaryError('');
    try {
      const result = await askAssistant({ task: 'meeting', transcript: transcriptText(live.lines), search: { area: area || meetingArea, urgency: needsHelpToday(transcriptText(live.lines), urgency)?'today':'normal' } }, controller.signal);
      if (typeof result.summary !== 'string' || !Array.isArray(result.nextSteps) || !Array.isArray(result.services)) throw new Error('The meeting summary could not be read. Please try again.');
      if (!controller.signal.aborted) setSummary(result);
    } catch (cause) {
      if (!controller.signal.aborted) setSummaryError(cause instanceof Error ? cause.message : 'Could not summarise this meeting. Please try again.');
    } finally {
      if (!controller.signal.aborted) setSummarising(false);
    }
  }

  if (!enabled) return null;
  const transcript = transcriptText(live.lines);
  const choices: MeetingChoice[] = shortlist.picked;
  const fallback: MeetingChoice[] = live.concepts.flatMap(concept => visibleServices(concept, dismissed, needsHelpToday(transcript,urgency)).slice(0, 2).map(service => ({ service, concept: concept.label })));
  const topics = live.concepts.map(concept => concept.label);
  const dismiss = (id: string) => setDismissed(previous => new Set(previous).add(id));
  const active = phase === 'recording' || phase === 'finishing' || phase === 'finished';
  return <section className="meeting-demo" aria-label="Staff meeting">
    {live.lines.length>0 && <UrgencyNotice staff text={transcriptText(live.lines)} mode={urgency} onChange={setUrgency}/>}
    {(phase === 'idle' || phase === 'finished') && <div className="meeting-setup">
      {phase === 'idle' && !area && <div className="meeting-location"><label htmlFor="meeting-area">Find support in</label><select id="meeting-area" value={meetingArea} onChange={event => setMeetingArea(event.target.value)}>{directoryAreas.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}</select></div>}
      {phase === 'idle' && <p className="meeting-consent">Starting a meeting streams the microphone audio to Azure OpenAI to write live notes and find matching services. This app does not store the audio. The audio download stays in this browser. Tell everyone in the room before you start.</p>}
      <button className="button primary meeting-start" onClick={start}>{phase === 'finished' ? 'Start another meeting' : 'Start meeting'}</button>
    </div>}
    {phase === 'requesting' && <div className="meeting-permission"><p role="status">Allow microphone access to start your meeting.</p><button className="button secondary" onClick={() => { release(false); live.close(); setPhase('idle'); }}>Cancel</button></div>}
    {error && <p className="meeting-error" role="alert">{error}</p>}
    {live.error && active && <p className="meeting-error" role="alert">{live.error}</p>}
    {active && <div className="meeting-session">
      <div className="meeting-heading"><h2>{phase === 'recording' ? 'Meeting in progress' : phase === 'finishing' ? 'Finishing notes' : 'Meeting ended'}</h2><span className={`meeting-status ${phase === 'recording' ? 'is-recording' : ''}`}>{phase === 'recording' ? 'Recording' : 'Microphone off'}</span></div>
      {phase === 'recording' && <div className="meeting-controls"><p>Time remaining <strong aria-label="Time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></p><Waveform analyser={analyser} /><button className="button meeting-stop" onClick={finish}>Stop meeting</button></div>}
      {phase === 'finishing' && <p role="status">Finishing the transcript and checking the last suggestions…</p>}
      <p className="meeting-note">Audio is sent to Azure OpenAI to create the transcript, which is machine-generated and may contain mistakes. Check it before relying on it.</p>
      <div className="meeting-workspace">
        <div><h3>Transcript</h3><div className="meeting-transcript" role="region" aria-label="Transcript" aria-live="polite" tabIndex={0}>{transcriptText(live.lines, true) || 'Start talking. The transcript appears here.'}</div></div>
        <div><h3>Suggested services</h3><LiveServices concepts={live.concepts} dismissed={dismissed} onDismiss={dismiss} shortlist={shortlist} urgent={needsHelpToday(transcript,urgency)} /></div>
      </div>
      {phase === 'finished' && <NextStepsReport choices={choices} fallback={fallback} topics={topics} endedAt={endedAt} />}
      {phase === 'finished' && transcript && <div className="meeting-summary-controls"><button className="button secondary" disabled={summarising} onClick={summarise}>{summarising ? 'Summarising meeting…' : 'Summarise meeting'}</button><p className="meeting-note">Create a draft from the transcript and relevant directory entries. Review it before using it.</p></div>}
      {summarising && <p role="status">Preparing a meeting summary and possible next steps.</p>}
      {summaryError && <p className="meeting-error" role="alert">{summaryError}</p>}
      {summary && <section className="meeting-summary" aria-label="Meeting summary"><h3>Draft meeting summary</h3><p className="meeting-summary-mode">{summary.mode === 'openai' ? 'AI-assisted draft' : 'Local directory draft'}</p><p>{summary.summary}</p>
        {!!summary.needs?.length && <><h4>Support discussed</h4><ul className="meeting-needs">{summary.needs.map((need, index) => <li key={`${need}-${index}`}>{need.replace(/-/g, ' ')}</li>)}</ul></>}
        {!!summary.nextSteps.length && <><h4>Possible next steps</h4><ol>{summary.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ol></>}
        {!!summary.services.length && <><h4>Services to explore</h4><ul>{summary.services.map(service => <li key={service.id}><a href={`/#/directory/${encodeURIComponent(service.id)}`}>{service.name}</a>{service.provider ? ` · ${service.provider}` : ''}</li>)}</ul></>}
        {!!summary.citations?.length && <details><summary>Directory evidence</summary>{summary.citations.map((citation, index) => <blockquote key={`${citation.id}-${index}`}><a href={`/#/directory/${encodeURIComponent(citation.id)}`}>{citation.name}</a><p>{citation.excerpt}</p></blockquote>)}</details>}
        {!!summary.warnings?.length && <div className="meeting-summary-warnings">{summary.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      </section>}
      {!!live.debug.length && <details className="meeting-dev"><summary>Developer view: API traffic ({live.debug.length})</summary><div className="meeting-dev-log">{live.debug.filter(entry => !entry.eventType.endsWith('.delta')).slice(-120).reverse().map(entry => <div key={entry.key}>{new Date(entry.ts).toLocaleTimeString('en-GB')} {entry.dir === 'out' ? 'sent' : 'received'} {entry.source} {entry.eventType}</div>)}</div></details>}
      {download && <a className="meeting-download" href={download} download="jobcentre-meeting.webm">Download meeting audio</a>}
    </div>}
  </section>;
}
