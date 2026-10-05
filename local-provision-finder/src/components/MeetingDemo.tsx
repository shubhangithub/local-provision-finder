import { useEffect, useRef, useState } from 'react';
import '../styles/meeting.css';
import { ArrowLeft, FileText, Mic, Square, Clock3, MessageSquare } from 'lucide-react';
import MeetingAssist from './MeetingAssist';
import { createCustomerDocument, type CustomerDocument, type MeetingTurn, type MeetingProvision } from '../lib/meeting';

const SCRIPT = 'Advisor: Thanks for coming in today. What would help you most over the next few weeks? Customer: I want to get back into work, but I feel anxious about interviews. I also need childcare after school and help with the bus fare. Advisor: We can look for a local confidence group, interview support and childcare options together. Would you prefer something nearby or online? Customer: Nearby would be good, especially somewhere quiet. Tuesday mornings are easiest for me. Advisor: Let us check the opening times, costs and how to contact each service before we choose the next step.';
const TURNS = SCRIPT.split(/(?=Advisor:|Customer:)/).map(turn => { const [speaker, ...text] = turn.trim().split(':'); return { speaker, words: text.join(':').trim().split(' ') }; });
const WORDS = TURNS.flatMap(turn => turn.words);
const DURATION = 600;
const EXTENSION = 300;
const WARNING = 120;
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { resultIndex: number; results: { length: number; [index:number]: { isFinal: boolean; [index:number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}


export default function MeetingDemo({ enabled, autoStart=true, onNotify, onBack, onProduce, onNewMeeting }: { enabled: boolean; autoStart?:boolean; onNotify: (message: string) => void; onBack: () => void; onProduce: (document: CustomerDocument) => void; onNewMeeting: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'finished'>('idle');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(DURATION);
  const deadline = useRef(0);
  const [wordCount, setWordCount] = useState(0);
  const [download, setDownload] = useState('');
  const [sample, setSample] = useState(false);
  const [turns, setTurns] = useState<MeetingTurn[]>([]);
  const [interim, setInterim] = useState('');
  const [speaker, setSpeaker] = useState<MeetingTurn['speaker']>('Customer');
  const speakerRef = useRef(speaker); speakerRef.current = speaker;
  const [note, setNote] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');
  const [selectedProvisions, setSelectedProvisions] = useState<MeetingProvision[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const sampleRef = useRef(sample); sampleRef.current = sample;
  const transcriptRef = useRef<HTMLDivElement>(null);
  const displayTurns: MeetingTurn[] = sample ? TURNS.flatMap((turn,index) => {
    const before = TURNS.slice(0,index).reduce((total,item)=>total+item.words.length,0);
    const shown = Math.min(turn.words.length,wordCount-before);
    return shown > 0 ? [{speaker:turn.speaker as MeetingTurn['speaker'],text:turn.words.slice(0,shown).join(' ')}] : [];
  }) : turns;
  const customerText = displayTurns.filter(turn=>turn.speaker==='Customer').map(turn=>turn.text).join(' ') + (speaker === 'Customer' ? ` ${interim}` : '');
  const autoStartRef=useRef(autoStart);autoStartRef.current=autoStart;
  useEffect(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, [wordCount, turns, interim]);
  const audioContext = useRef<AudioContext | null>(null);
  function cue(message: string, stopping = false) {
    const context = audioContext.current;
    if (context && context.state === 'running') {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.frequency.setValueAtTime(stopping ? 660 : 440, context.currentTime);
      oscillator.frequency.setValueAtTime(stopping ? 440 : 660, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
      oscillator.start(); oscillator.stop(context.currentTime + 0.26);
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(message);
      speech.lang = 'en-GB';
      window.speechSynthesis.speak(speech);
    }
  }
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const resultGeneration = useRef(0);
  const downloadRef = useRef('');
  const finishRef = useRef<(automatic?: boolean) => void>(() => {});
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const release = (keepRecording: boolean) => {
    const engine = recognition.current;recognition.current = null;engine?.abort();
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
  const finish = (automatic = false) => {
    if (!recorder.current) return;
    release(true);
    cue('Recording stopped', true);
    if (!sample && interim.trim()) setTurns(previous=>[...previous,{speaker,text:interim.trim()}]);
    setInterim('');
    setPhase('finished');
    notifyRef.current?.(automatic ? 'Recording stopped. Meeting time ended.' : 'Recording stopped.');

  };
  finishRef.current = finish;

  useEffect(() => {
    if (enabled) { if(autoStartRef.current)void start(); } else {
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
    void audioContext.current?.close();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
  }, []);
  useEffect(() => {
    if (phase !== 'recording') return;

    const clock = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) finishRef.current(true);
    }, 250);
    const words = window.setInterval(() => { if (sampleRef.current) setWordCount(count => Math.min(count + 1, WORDS.length)); }, 350);
    return () => { window.clearInterval(clock); window.clearInterval(words); };
  }, [phase]);

  async function start() {
    onNewMeeting();
    setError('');setSample(false);sampleRef.current=false;setTurns([]);setInterim('');setSelectedProvisions([]);setNote('');setTranscriptionError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is unavailable in this browser. Try a current browser on localhost or HTTPS.');
      return;
    }
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    downloadRef.current = '';
    setDownload('');
    try {
      audioContext.current ??= new AudioContext();
      void audioContext.current.resume().catch(() => {});
    } catch { /* Recording remains available when audio output is unsupported. */ }
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
        cue('Recording stopped', true);
        notifyRef.current?.('Recording stopped unexpectedly.');
        setError('Recording stopped unexpectedly. You can start a new meeting.');
      };
      recorder.current = recording;
      recording.start(1000);
      deadline.current = Date.now() + DURATION * 1000;
      setRemaining(DURATION);
      setWordCount(0);
      setPhase('recording');
      cue('Start recording');
      notifyRef.current?.('Recording started.');
      startTranscription();
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

  function startTranscription() {
    const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setTranscriptionError('Live transcription is unavailable in this browser. Add conversation notes below.'); return; }
    const engine = new Constructor(); recognition.current = engine;
    engine.continuous = true; engine.interimResults = true; engine.lang = 'en-GB';
    engine.onresult = event => {
      if (recognition.current !== engine || sampleRef.current) return;
      let pending = '';
      const completed: MeetingTurn[] = [];
      for (let index=event.resultIndex;index<event.results.length;index++) {
        const result = event.results[index];const text=result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) completed.push({speaker:speakerRef.current,text}); else pending += text+' ';
      }
      if (completed.length) setTurns(previous=>[...previous,...completed]);
      setInterim(pending.trim());
    };
    engine.onerror = event => {
      if (recognition.current !== engine || sampleRef.current) return;
      if (event.error !== 'no-speech') { recognition.current=null;engine.abort();setTranscriptionError('Live transcription paused. Add conversation notes below.');setInterim(''); }
    };
    engine.onend = () => {
      if (recognition.current===engine && recorder.current?.state==='recording' && !sampleRef.current) {
        try {engine.start();} catch {recognition.current=null;setTranscriptionError('Live transcription paused. Add conversation notes below.');}
      }
    };
    try {engine.start();} catch {recognition.current=null;setTranscriptionError('Live transcription is unavailable. Add conversation notes below.');}
  }
  function trySample() {
    const engine=recognition.current;recognition.current=null;engine?.abort();setInterim('');setWordCount(0);setSample(true);sampleRef.current=true;setTranscriptionError('');
  }
  function addNote() {
    if (!note.trim()) return;
    if (sample) {setTurns(displayTurns);setSample(false);sampleRef.current=false;}
    setTurns(previous=>[...previous,{speaker,text:note.trim()}]);setNote('');
  }

  function extend() {
    if (!recorder.current || deadline.current <= Date.now()) return;
    deadline.current += EXTENSION * 1000;
    setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    notifyRef.current?.('Meeting extended by 5 minutes.');
  }

  if (!enabled) return null;
  return <section className="meeting-workspace" aria-label="Staff meeting">
    <div className="meeting-page-top"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/>Back to workspace</button><span className="meeting-workspace-tag">CASEWORKER WORKSPACE</span></div>
    <div className="meeting-page-heading"><div><p className="meeting-eyebrow">Customer conversation</p><h1>{phase==='finished' ? 'Meeting complete' : 'Customer meeting'}</h1><p>{phase==='finished' ? 'Review the conversation and prepare the customer’s next steps.' : 'Listen, explore support and build a plan together.'}</p></div><span className={`meeting-status ${phase === 'recording' ? 'is-recording' : ''}`}><span className="meeting-record-dot"/>{phase === 'recording' ? 'Recording' : phase==='requesting' ? 'Connecting microphone' : 'Microphone off'}</span></div>
    {error && <p className="meeting-error" role="alert">{error}</p>}
    {phase==='requesting' && <div className="meeting-permission"><p role="status">Allow microphone access to start your meeting.</p><button className="button secondary" onClick={()=>{release(false);setPhase('idle');}}>Cancel</button></div>}
    <div className="meeting-actionbar"><div className="meeting-clock"><Clock3 size={19}/><span>Time remaining</span><strong aria-label="Time remaining">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></div><div className="meeting-actions">{phase==='recording' ? <><button className="text-button" onClick={extend}>Add 5 minutes</button><button className="button meeting-stop" onClick={()=>finish()}><Square size={15}/>Stop meeting</button></> : phase==='finished' ? <button className="button primary" onClick={()=>onProduce(createCustomerDocument(displayTurns,selectedProvisions))}><FileText size={18}/>Produce customer summary</button> : phase==='idle' ? <button className="button primary" onClick={start}><Mic size={17}/>Start recording</button> : null}</div></div>
    {phase==='recording' && remaining<=WARNING && remaining>0 && <div className="meeting-time-alert"><p role="alert"><strong>Meeting time is nearly up.</strong> Recording stops when the timer reaches zero.</p><button className="button secondary" onClick={extend}>Extend by 5 minutes</button></div>}
    <div className="meeting-grid"><div className="meeting-conversation"><div className="conversation-heading"><div><MessageSquare size={19}/><h2>Conversation</h2></div>{phase==='recording' && <button className="text-button" disabled={sample} onClick={trySample}>{sample ? 'Sample conversation' : 'Try sample conversation'}</button>}</div>
      <div ref={transcriptRef} className="meeting-transcript" role="region" aria-label="Transcript" tabIndex={0}>{displayTurns.length ? displayTurns.map((turn,index)=><div className={`meeting-turn ${turn.speaker.toLowerCase()}`} key={index}><span className="meeting-speaker-avatar">{turn.speaker==='Advisor' ? 'A' : 'C'}</span><div><strong>{turn.speaker}</strong><p>{turn.text}</p></div></div>) : <div className="conversation-empty"><Mic size={30}/><h3>{phase==='recording' ? 'Listening to the conversation' : 'Your conversation appears here'}</h3><p>Customer needs and useful provision will appear alongside your notes.</p></div>}{interim && <div className={`meeting-turn ${speaker.toLowerCase()} interim`}><span className="meeting-speaker-avatar">{speaker[0]}</span><div><strong>{speaker}</strong><p>{interim}</p></div></div>}</div>
      {phase==='recording' && <form className="meeting-note-form" onSubmit={event=>{event.preventDefault();addNote();}}><div className="meeting-note-top"><label htmlFor="meeting-note">Add conversation note</label><div className="speaker-picker" role="group" aria-label="Current speaker">{(['Customer','Advisor'] as const).map(value=><button key={value} type="button" aria-pressed={speaker===value} onClick={()=>setSpeaker(value)}>{value}</button>)}</div></div>{transcriptionError && <p className="transcription-status" role="status">{transcriptionError}</p>}<div className="meeting-note-input"><textarea id="meeting-note" rows={2} value={note} onChange={event=>setNote(event.target.value)} placeholder="Capture a need, preference or agreed action…" maxLength={4000}/><button className="button secondary" disabled={!note.trim()} type="submit">Add note</button></div></form>}
      {phase==='finished' && <div className="meeting-finished"><div><CheckMark/><strong>Recording stopped</strong></div>{download && <a className="meeting-download" href={download} download="customer-meeting.webm">Download meeting audio</a>}<button className="text-button" onClick={start}>Start another meeting</button></div>}
    </div><MeetingAssist customerText={customerText} selected={selectedProvisions} onToggle={provision=>setSelectedProvisions(previous=>previous.some(item=>item.id===provision.id) ? previous.filter(item=>item.id!==provision.id) : [...previous,provision])}/></div>
  </section>;
}
function CheckMark(){return <span aria-hidden="true" className="meeting-checkmark">✓</span>;}
