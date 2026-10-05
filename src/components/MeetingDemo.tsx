import { useEffect, useRef, useState } from 'react';
import '../styles/meeting.css';

const SCRIPT = 'Adviser: Thanks for coming in today. What would help you most over the next few weeks? Participant: I want to get back into work, but I feel anxious about interviews. I also need childcare after school and help with the bus fare. Adviser: We can look for a local confidence group, interview support and childcare options together. Would you prefer something nearby or online? Participant: Nearby would be good, especially somewhere quiet. Tuesday mornings are easiest for me. Adviser: Let us check the opening times, costs and how to contact each service before we choose the next step.';
const WORDS = SCRIPT.split(' ');
const DURATION = 600;

export default function MeetingDemo({ enabled, onEnd }: { enabled: boolean; onEnd?: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'finished'>('idle');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(DURATION);
  const [wordCount, setWordCount] = useState(0);
  const [download, setDownload] = useState('');
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
      setPhase('idle');
      setWordCount(0);
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      downloadRef.current = '';
      setDownload('');
    }
  }, [enabled]);
  useEffect(() => () => {
    release(false);
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
      {download && <a className="meeting-download" href={download} download="jobcentre-meeting.webm">Download meeting audio</a>}
    </div>}
  </section>;
}
