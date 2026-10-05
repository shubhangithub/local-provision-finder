import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { MeetingSession, type MeetingMessage } from './meeting-session.ts';
import type { MeetingService } from './meeting-search.ts';

const service = (id: string): MeetingService => ({ id, name: `Service ${id}`, provider: 'P', postcode: null, distanceMiles: null, sites: [], snippet: 'text', tags: [], needs: [] });

/** A tiny stand-in for the realtime API: transcribes the first audio chunk, and answers analyst turns with one concept. */
function fakeRealtime() {
  const analystTurns: string[] = [];
  const server = new WebSocketServer({ port: 0 });
  server.on('connection', (ws: WebSocket) => {
    let listener = false, spoke = false;
    ws.on('message', raw => {
      const event = JSON.parse(raw.toString());
      const send = (e: unknown) => ws.send(JSON.stringify(e));
      if (event.type === 'session.update') { listener = !!event.session.audio; send({ type: 'session.updated' }); }
      if (event.type === 'input_audio_buffer.append' && listener && !spoke) {
        spoke = true;
        send({ type: 'input_audio_buffer.committed' });
        setTimeout(() => send({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'I need childcare after school.' }), 20);
      }
      if (event.type === 'conversation.item.create') analystTurns.push(event.item.content[0].text);
      if (event.type === 'response.create') {
        const query = `childcare turn ${analystTurns.length}`;
        setTimeout(() => {
          send({ type: 'response.function_call_arguments.done', name: 'set_concepts', arguments: JSON.stringify({ concepts: [{ label: 'Childcare', query }] }) });
          send({ type: 'response.done' });
        }, 20);
      }
    });
  });
  const port = (server.address() as { port: number }).port;
  return { server, analystTurns, url: `ws://127.0.0.1:${port}` };
}

let open: { server: WebSocketServer; session?: MeetingSession } | undefined;
afterEach(() => { open?.session?.close(); open?.server.close(); open = undefined; });

describe('MeetingSession', () => {
  it('turns audio into a transcript, a concept with raw then filtered results, and settles on finish', async () => {
    const fake = fakeRealtime();
    const messages: MeetingMessage[] = [];
    const searched: string[] = [];
    const session = new MeetingSession({
      send: message => messages.push(JSON.parse(JSON.stringify(message))), // snapshot, as the socket would serialise it
      records: [], area: 'Bristol', filter: { apiKey: 'k', model: 'm', url: 'x', azure: false },
      config: { apiKey: 'k', model: 'm', transcribeModel: 't', url: fake.url, azure: false },
      deps: { search: async (_r, _a, query) => { searched.push(query); return [service('a'), service('b')]; }, filter: async () => ({ ids: ['b'], ms: 5 }) },
    });
    open = { server: fake.server, session };
    session.start();
    session.appendAudio(Buffer.alloc(4800));
    await session.finish(5000);

    const types = messages.map(m => m.type);
    expect(types[0]).toBe('ready');
    expect(messages.find(m => m.type === 'transcript')).toMatchObject({ itemId: 'i1', text: 'I need childcare after school.', final: true });
    expect(fake.analystTurns[0]).toContain('CURRENT concepts:\n[]');
    expect(fake.analystTurns[0]).toContain('I need childcare after school.');
    expect(searched).toEqual(['childcare turn 1']);
    const concepts = messages.filter((m): m is Extract<MeetingMessage, { type: 'concepts' }> => m.type === 'concepts');
    expect(concepts[0].concepts[0].filtered.status).toBe('pending'); // raw results go out first
    expect(concepts[0].concepts[0].results.map(r => r.id)).toEqual(['a', 'b']);
    expect(concepts.at(-1)!.concepts[0].filtered).toEqual({ status: 'done', ids: ['b'], ms: 5 });
  });

  it('falls back to unfiltered status "error" when the relevance filter is unavailable', async () => {
    const fake = fakeRealtime();
    const messages: MeetingMessage[] = [];
    const session = new MeetingSession({
      send: message => messages.push(JSON.parse(JSON.stringify(message))), // snapshot, as the socket would serialise it
      records: [], area: 'Bristol', filter: { apiKey: 'k', model: 'm', url: 'x', azure: false },
      config: { apiKey: 'k', model: 'm', transcribeModel: 't', url: fake.url, azure: false },
      deps: { search: async () => [service('a')], filter: async () => null },
    });
    open = { server: fake.server, session };
    session.start();
    session.appendAudio(Buffer.alloc(4800));
    await session.finish(5000);
    const last = messages.filter(m => m.type === 'concepts').at(-1) as Extract<MeetingMessage, { type: 'concepts' }>;
    expect(last.concepts[0].filtered.status).toBe('error');
  });
});
