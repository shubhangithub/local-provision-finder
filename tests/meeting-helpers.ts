import type { Page } from '@playwright/test';

export interface MicState { requested: number; stopped: number; recording: boolean }

/** Fake microphone: a real (silent) MediaStream so the PCM capture graph works, with stop() counted. */
export async function mockMicrophone(page: Page, denied = false) {
  await page.addInitScript(({ denied }) => {
    const state = { requested: 0, stopped: 0, recording: false };
    (window as unknown as { meetingMic: typeof state }).meetingMic = state;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => {
        state.requested++;
        if (denied) throw new DOMException('Denied', 'NotAllowedError');
        const stream = new AudioContext().createMediaStreamDestination().stream;
        for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { state.stopped++; stop(); }; }
        return stream;
      },
    } });
    class Recorder {
      state = 'inactive'; mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = 'recording'; state.recording = true; }
      stop() { this.state = 'inactive'; state.recording = false; this.ondataavailable?.({ data: new Blob(['demo audio']) }); window.setTimeout(() => this.onstop?.(), 0); }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: Recorder });
  }, { denied });
}

export const service = (id: string, name: string, provider = 'Local charity') => ({
  id, name, provider, postcode: 'BS1 1AA', distanceMiles: null, sites: [], snippet: `${name} offers support.`, tags: [], needs: ['childcare'],
});

export interface RealtimeScript {
  /** Messages sent once the server is "ready", as [delayMs, message]. */
  messages?: [number, Record<string, unknown>][];
  /** Reject the connection with this error instead of becoming ready. */
  fail?: string;
}

/** Stand-in for the local realtime socket; no OpenAI call is ever made. */
export async function mockRealtime(page: Page, script: RealtimeScript = {}) {
  const requests: string[] = [];
  await page.routeWebSocket(/\/api\/realtime\/meeting/, ws => {
    requests.push(ws.url());
    if (script.fail) { ws.send(JSON.stringify({ type: 'error', message: script.fail })); ws.close(); return; }
    ws.send(JSON.stringify({ type: 'ready' }));
    for (const [delay, message] of script.messages ?? []) setTimeout(() => ws.send(JSON.stringify(message)), delay);
    ws.onMessage(message => {
      if (typeof message === 'string' && JSON.parse(message).type === 'finish') ws.close();
    });
  });
  return requests;
}
