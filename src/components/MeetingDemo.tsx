import UrgencyNotice from './UrgencyNotice';
import { type UrgencyMode, needsHelpToday } from '../lib/urgency';
import { useEffect, useRef, useState } from 'react';
import '../styles/meeting.css';
import { askAssistant, type AssistantResult } from '../lib/assistant';
import { directoryAreas } from '../lib/directory';
import { meetingArea as areaForMeeting, openRegionMenu, useRegion } from '../lib/region';
import { startPcmCapture, type PcmCapture } from '../lib/mic';
import { transcriptText, useLiveMeeting } from '../lib/live-meeting';
import Waveform from './Waveform';
import LiveServices, { useMeetingShortlist } from './LiveServices';
import MeetingResults from './MeetingResults';

const DURATION = 600;


export default function MeetingDemo({ enabled, onEnd }: { enabled: boolean; onEnd?: () => void }) {
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
  const [region] = useRegion();
  const meetingArea = areaForMeeting(region);
  const [summary, setSummary] = useState<AssistantResult | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequest = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const resultGeneration = useRef(0);
  const downloadRef = useRef('');
  const liveRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { if (phase === 'recording') liveRef.current?.scrollIntoView?.({ block: 'start' }); }, [phase]);
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
      await live.open(meetingArea).catch(error => { throw Object.assign(error instanceof Error ? error : new Error('Live transcription could not start.'), { live: true }); }); // must be ready before audio is sent
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

  useEffect(() => {
    if (phase === 'finished' && transcriptText(live.lines)) summarise();
  }, [phase]);

  async function summarise() {
    summaryRequest.current?.abort();
    const controller = new AbortController();
    summaryRequest.current = controller;
    setSummarising(true);
    setSummaryError('');
    try {
      const result = await askAssistant({ task: 'meeting', transcript: transcriptText(live.lines), search: { area: meetingArea, urgency: needsHelpToday(transcriptText(live.lines), urgency)?'today':'normal' } }, controller.signal);
      if (typeof result.summary !== 'string' || !Array.isArray(result.nextSteps) || !Array.isArray(result.services)) throw new Error('The meeting summary could not be read. Please try again.');
      if (!controller.signal.aborted) setSummary(result);
    } catch (cause) {
      if (!controller.signal.aborted) setSummaryError(cause instanceof Error ? cause.message : 'Could not summarise this meeting. Please try again.');
    } finally {
      if (!controller.signal.aborted) setSummarising(false);
    }
  }

  if (!enabled) return null;
  const urgent = needsHelpToday(transcriptText(live.lines), urgency);
  const dismiss = (id: string) => setDismissed(previous => new Set(previous).add(id));
  const words = live.lines.reduce((total, line) => total + (line.text.trim() ? line.text.trim().split(/\s+/).length : 0), 0);
  const inCall = phase === 'recording' || phase === 'finishing';
  // Before recording the same layout is shown with placeholders, so nothing jumps when the meeting starts.
  const ready = phase === 'idle' || phase === 'requesting';
  const active = inCall || phase === 'finished';
  return <section className="meeting-demo" aria-label="Staff meeting">
    {live.lines.length > 0 && <UrgencyNotice staff showToggle={false} text={transcriptText(live.lines)} mode={urgency} onChange={setUrgency} />}
    {error && <p className="meeting-error" role="alert">{error}</p>}
    {live.error && active && <p className="meeting-error" role="alert">{live.error}</p>}
    {phase === 'finished' && <div className="meeting-session is-finished"><MeetingResults lines={live.lines} concepts={live.concepts} dismissed={dismissed} onDismiss={dismiss} shortlist={shortlist} endedAt={endedAt} seconds={DURATION - remaining} download={download} onRestart={start} urgent={urgent} summary={summary} summarising={summarising} summaryError={summaryError} onSummarise={summarise} />
      {!!live.debug.length && <details className="meeting-dev"><summary>Developer view: API traffic ({live.debug.length})</summary><div className="meeting-dev-log">{live.debug.filter(entry => !entry.eventType.endsWith('.delta')).slice(-120).reverse().map(entry => <div key={entry.key}>{new Date(entry.ts).toLocaleTimeString('en-GB')} {entry.dir === 'out' ? 'sent' : 'received'} {entry.source} {entry.eventType}</div>)}</div></details>}
    </div>}
    {(inCall || ready) && <div className="meeting-session meeting-live" ref={liveRef}>
      <div className="live-bar">
        <span className={`live-dot ${phase === 'recording' ? 'is-recording' : ''}`} aria-hidden="true" />
        <div className="live-state"><h2>{phase === 'recording' ? 'Meeting in progress' : phase === 'finishing' ? 'Finishing notes' : 'Ready to start'}</h2>
          {ready ? <p role="status">{phase === 'requesting' ? 'Waiting for microphone access…' : 'Press Start meeting to begin listening'}</p>
            : <p role="status">{phase === 'recording' ? 'Listening' : 'Checking the last suggestions…'} · {words} {words === 1 ? 'word' : 'words'} captured</p>}</div>
        {ready && <><Waveform analyser={null} /><p className="live-clock">Time remaining <strong aria-label="Time remaining">{Math.floor(DURATION / 60)}:{String(DURATION % 60).padStart(2, '0')}</strong></p>
          {phase === 'requesting' ? <button className="button secondary" onClick={() => { release(false); live.close(); setPhase('idle'); }}>Cancel</button> : <button className="button primary meeting-start" onClick={start}>Start meeting</button>}</>}
        {phase === 'recording' && <><Waveform analyser={analyser} /><p className="live-clock">Time remaining <strong aria-label="Time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></p><button className="button meeting-stop" onClick={finish}>Stop meeting</button></>}
      </div>
      <div className="live-main">
        <div className="live-main-head"><h3>Suggested support</h3><p className="live-saved" aria-live="polite">{shortlist.picked.length} saved</p></div>
        {ready ? <div className="live-placeholder"><p>Services that match what is said will appear here as people talk.</p><div className="live-skeleton" aria-hidden="true"><span /><span /><span /></div></div>
          : <LiveServices concepts={live.concepts} dismissed={dismissed} onDismiss={dismiss} shortlist={shortlist} newestFirst urgent={urgent} />}
      </div>
    </div>}
  </section>;
}
