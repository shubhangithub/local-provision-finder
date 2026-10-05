import { useEffect, useRef, useState } from 'react';
import '../styles/meeting.css';
import { askAssistant, type AssistantResult } from '../lib/assistant';
import { directoryAreas } from '../lib/directory';

const SCRIPT = 'Adviser: Thanks for coming in today. What would help you most over the next few weeks? Participant: I want to get back into work, but I feel anxious about interviews. I also need childcare after school and help with the bus fare. Adviser: We can look for a local confidence group, interview support and childcare options together. Would you prefer something nearby or online? Participant: Nearby would be good, especially somewhere quiet. Tuesday mornings are easiest for me. Adviser: Let us check the opening times, costs and how to contact each service before we choose the next step.';
const WORDS = SCRIPT.split(' ');
const DURATION = 600;


export default function MeetingDemo({ enabled, onEnd, area }: { enabled: boolean; onEnd?: () => void; area?: string }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'finished'>('idle');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(DURATION);
  const [wordCount, setWordCount] = useState(0);
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
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  const finish = () => {
    release(true);
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
      setPhase('idle');
      setWordCount(0);
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      downloadRef.current = '';
      setDownload('');
    }
  }, [enabled]);
  useEffect(() => () => {
    release(false);
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
    const words = window.setInterval(() => setWordCount(count => Math.min(count + 1, WORDS.length)), 350);
    return () => { window.clearInterval(clock); window.clearInterval(words); };
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
      setWordCount(0);
      setPhase('recording');
    } catch (cause) {
      if (request !== generation.current) return;
      release(false);
      setPhase('idle');
      const name = cause instanceof Error ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Microphone permission was not granted. Allow access in your browser to start a meeting.' : cause instanceof Error && cause.message === 'timeout' ? 'Microphone access took too long. Please try again.' : 'Could not start the microphone. Check that it is connected and available.');
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
      const result = await askAssistant({ task: 'meeting', transcript: WORDS.slice(0, wordCount).join(' '), search: { area: area || meetingArea } }, controller.signal);
      if (typeof result.summary !== 'string' || !Array.isArray(result.nextSteps) || !Array.isArray(result.services)) throw new Error('The meeting summary could not be read. Please try again.');
      if (!controller.signal.aborted) setSummary(result);
    } catch (cause) {
      if (!controller.signal.aborted) setSummaryError(cause instanceof Error ? cause.message : 'Could not summarise this meeting. Please try again.');
    } finally {
      if (!controller.signal.aborted) setSummarising(false);
    }
  }

  if (!enabled) return null;
  return <section className="meeting-demo" aria-label="Staff meeting">
    {phase === 'idle' || phase === 'finished' ? <button className="button primary meeting-start" onClick={start}>Start meeting</button> : null}
    {phase === 'requesting' && <div className="meeting-permission"><p role="status">Allow microphone access to start your meeting.</p><button className="button secondary" onClick={() => { release(false); setPhase('idle'); }}>Cancel</button></div>}
    {error && <p className="meeting-error" role="alert">{error}</p>}
    {(phase === 'recording' || phase === 'finished') && <div className="meeting-session">
      <div className="meeting-heading"><h2>{phase === 'recording' ? 'Meeting in progress' : 'Meeting ended'}</h2><span className={`meeting-status ${phase === 'recording' ? 'is-recording' : ''}`}>{phase === 'recording' ? 'Recording' : 'Microphone off'}</span></div>
      {phase === 'recording' && <div className="meeting-controls"><p>Time remaining <strong aria-label="Time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></p><button className="button meeting-stop" onClick={finish}>Stop meeting</button></div>}
      <p className="meeting-note">Audio stays in this browser. The transcript below is simulated and does not transcribe your microphone.</p>
      <h3>Simulated transcript</h3><div className="meeting-transcript" role="region" aria-label="Simulated transcript" tabIndex={0}>{wordCount ? WORDS.slice(0, wordCount).join(' ') : 'The simulated conversation will appear here.'}</div>
      {phase === 'finished' && wordCount > 0 && <div className="meeting-summary-controls">{!area && <div className="meeting-location"><label htmlFor="meeting-area">Find support in</label><select id="meeting-area" value={meetingArea} disabled={summarising} onChange={event => {setMeetingArea(event.target.value);setSummary(null);}}>{directoryAreas.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}</select></div>}<button className="button secondary" disabled={summarising} onClick={summarise}>{summarising ? 'Summarising meeting…' : 'Summarise meeting'}</button><p className="meeting-note">Create a draft from the simulated transcript and relevant directory entries. Review it before using it.</p></div>}
      {summarising && <p role="status">Preparing a meeting summary and possible next steps.</p>}
      {summaryError && <p className="meeting-error" role="alert">{summaryError}</p>}
      {summary && <section className="meeting-summary" aria-label="Meeting summary"><h3>Draft meeting summary</h3><p className="meeting-summary-mode">{summary.mode === 'openai' ? 'AI-assisted draft' : 'Local directory draft'}</p><p>{summary.summary}</p>
        {!!summary.needs?.length && <><h4>Support discussed</h4><ul className="meeting-needs">{summary.needs.map((need, index) => <li key={`${need}-${index}`}>{need.replace(/-/g, ' ')}</li>)}</ul></>}
        {!!summary.nextSteps.length && <><h4>Possible next steps</h4><ol>{summary.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ol></>}
        {!!summary.services.length && <><h4>Services to explore</h4><ul>{summary.services.map(service => <li key={service.id}><a href={`/#/directory/${encodeURIComponent(service.id)}`}>{service.name}</a>{service.provider ? ` · ${service.provider}` : ''}</li>)}</ul></>}
        {!!summary.citations?.length && <details><summary>Directory evidence</summary>{summary.citations.map((citation, index) => <blockquote key={`${citation.id}-${index}`}><a href={`/#/directory/${encodeURIComponent(citation.id)}`}>{citation.name}</a><p>{citation.excerpt}</p></blockquote>)}</details>}
        {!!summary.warnings?.length && <div className="meeting-summary-warnings">{summary.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      </section>}
      {download && <a className="meeting-download" href={download} download="jobcentre-meeting.webm">Download meeting audio</a>}
    </div>}
  </section>;
}
