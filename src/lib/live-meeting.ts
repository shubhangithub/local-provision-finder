import { useCallback, useRef, useState } from 'react';
import type { DirectorySummary } from './directory';

export interface MeetingService extends DirectorySummary { needs: string[] }
export interface LiveConcept {
  label: string;
  query: string;
  results: MeetingService[];
  filtered: { status: 'pending' | 'done' | 'error'; ids: string[]; ms: number };
}
export interface TranscriptLine { id: string; text: string; final: boolean }
export interface DebugEntry { key: number; source: string; dir: 'in' | 'out'; eventType: string; ts: number }

const FINISH_WAIT_MS = 14000;

/** Live transcript and topic results for one meeting, over the local realtime socket. */
export function useLiveMeeting() {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [concepts, setConcepts] = useState<LiveConcept[]>([]);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState<DebugEntry[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const debugKey = useRef(0);

  const reset = useCallback(() => { setLines([]); setConcepts([]); setError(''); setDebug([]); }, []);

  /** Resolves once the server has both realtime sessions ready; rejects with a readable message otherwise. */
  const open = useCallback((area: string) => new Promise<void>((resolve, reject) => {
    reset();
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/realtime/meeting?staff=true&area=${encodeURIComponent(area)}`);
    ws.binaryType = 'arraybuffer';
    socket.current = ws;
    let ready = false;
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      switch (message.type) {
        case 'ready': ready = true; resolve(); break;
        case 'transcript':
          setLines(previous => {
            const index = previous.findIndex(line => line.id === message.itemId);
            if (index === -1) return [...previous, { id: message.itemId, text: message.text, final: message.final }];
            const next = [...previous];
            next[index] = { ...next[index], text: message.final ? message.text : next[index].text + message.text, final: message.final };
            return next;
          });
          break;
        case 'concepts': setConcepts(message.concepts); break;
        case 'debug': setDebug(previous => [...previous.slice(-299), { key: debugKey.current++, source: message.source, dir: message.dir, eventType: message.eventType, ts: message.ts }]); break;
        case 'notice': setError(message.message); break;
        case 'error':
          if (!ready) reject(new Error(message.error ?? message.message)); else setError(message.message);
          break;
      }
    };
    ws.onerror = () => { if (!ready) reject(new Error('Live transcription is unavailable. Check that the server is running.')); };
    ws.onclose = () => { if (!ready) reject(new Error('Live transcription could not start.')); if (socket.current === ws) socket.current = null; };
  }), [reset]);

  const sendAudio = useCallback((pcm: ArrayBuffer) => { const ws = socket.current; if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm); }, []);

  /** Ask the server to flush the last utterance; resolves when it has settled and closed the socket. */
  const finish = useCallback(() => new Promise<void>(resolve => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return resolve();
    const timer = window.setTimeout(() => { ws.close(); resolve(); }, FINISH_WAIT_MS);
    ws.addEventListener('close', () => { window.clearTimeout(timer); resolve(); });
    ws.send(JSON.stringify({ type: 'finish' }));
  }), []);

  const close = useCallback(() => { const ws = socket.current; socket.current = null; ws?.close(); }, []);

  return { lines, concepts, error, debug, open, sendAudio, finish, close, reset };
}

export function transcriptText(lines: TranscriptLine[], includePartial = false): string {
  return lines.filter(line => includePartial || line.final).map(line => line.text.trim()).filter(Boolean).join(' ');
}
