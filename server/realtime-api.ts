import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { loadAssistantRecords } from './assistant-catalogue.ts';
import { directoryAreas } from '../src/lib/directory.ts';
import { MeetingSession, type MeetingMessage } from './meeting-session.ts';
import { realtimeConfig } from './realtime-session.ts';
import { filterConfig } from './relevance-filter.ts';

const PATH = '/api/realtime/meeting';
const MAX_MEETINGS = 2;

// Loopback-only prototype endpoint, like the other local APIs. The staff flag is a demo toggle, not authentication.
export function realtimeApi(): Plugin {
  let active = 0;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });

  const allowed = (request: IncomingMessage) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) return false;
    let host: URL;
    try { host = new URL(`http://${request.headers.host}`); } catch { return false; }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return false;
    return !(request.headers.origin && request.headers.origin !== host.origin);
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== PATH) return; // leave Vite's own HMR socket alone
    const reject = (status: string) => { socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (!allowed(request)) return reject('403 Forbidden');
    if (url.searchParams.get('staff') !== 'true') return reject('403 Forbidden');
    if (active >= MAX_MEETINGS) return reject('429 Too Many Requests');
    wss.handleUpgrade(request, socket, head, ws => handleMeeting(ws, url));
  };

  function handleMeeting(ws: import('ws').WebSocket, url: URL) {
    active++;
    const send = (message: MeetingMessage) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };
    const config = realtimeConfig();
    const requested = url.searchParams.get('area') ?? '';
    const area = directoryAreas.find(a => a.id === requested)?.id ?? 'Bristol';
    let meeting: MeetingSession | undefined;
    if (!config.apiKey) {
      send({ type: 'error', message: 'Live transcription needs AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY (or OPENAI_API_KEY) in .env.' });
      ws.close();
    } else {
      try {
        // Transcription and topic tracking still work if the directory is not built yet; only suggestions are empty.
        let records: ReturnType<typeof loadAssistantRecords> = [];
        let notice = '';
        try { records = loadAssistantRecords(resolve(process.cwd(), 'data')); if (!records.length) notice = 'The service directory is empty, so no services will be suggested. Run npm run ingest.'; }
        catch (error) { console.error('Directory not ready:', error instanceof Error ? error.message : 'Unknown error'); notice = 'The service directory is not ready yet, so no services will be suggested. Run npm run ingest, then npm run index:semantic.'; }
        meeting = new MeetingSession({ send, records, area, config, filter: filterConfig() });
        meeting.start();
        if (notice) send({ type: 'notice', message: notice });
      } catch (error) {
        console.error('Could not start meeting:', error instanceof Error ? error.message : 'Unknown error');
        send({ type: 'error', message: 'Live transcription could not start. Check the server log.' });
        ws.close();
      }
    }
    ws.on('message', async (data, isBinary) => {
      if (isBinary) return meeting?.appendAudio(data as Buffer);
      try {
        if (JSON.parse(data.toString()).type === 'finish') { await meeting?.finish(); ws.close(); }
      } catch { /* ignore malformed control messages */ }
    });
    ws.on('close', () => { meeting?.close(); active--; });
  }

  return {
    name: 'local-realtime-meeting',
    configureServer(server) { server.httpServer?.on('upgrade', onUpgrade); },
    configurePreviewServer(server) { server.httpServer?.on('upgrade', onUpgrade); },
  };
}
