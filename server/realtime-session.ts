import WebSocket from 'ws';
import { loadEnv } from 'vite';

export interface Concept { label: string; query: string }
export interface RealtimeConfig { apiKey?: string; model: string; transcribeModel: string; url: string; azure: boolean }
export interface RealtimeHandlers {
  onTranscript?: (text: string, final: boolean, itemId: string) => void;
  onConcepts?: (concepts: Concept[]) => void;
  /** Fires when the model has finished a response (used to serialise analyst turns). */
  onResponseDone?: () => void;
  onCommitted?: () => void;
  onTranscriptionFailed?: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
  /** Every event sent to (out) or received from (in) the API, for the developer log. */
  onEvent?: (dir: 'in' | 'out', event: unknown) => void;
}

// Read on each meeting, like agentConfig(), so a key added to .env is picked up without a restart.
// Azure OpenAI is used when AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are set, otherwise OpenAI.
export function modelEnv(): (name: string) => string | undefined {
  const env = loadEnv('development', process.cwd(), ['OPENAI_', 'AZURE_OPENAI_']);
  return name => process.env[name] || env[name] || undefined;
}
export function realtimeConfig(): RealtimeConfig {
  const get = modelEnv();
  const endpoint = get('AZURE_OPENAI_ENDPOINT');
  if (endpoint && get('AZURE_OPENAI_API_KEY')) {
    return {
      azure: true,
      apiKey: get('AZURE_OPENAI_API_KEY'),
      model: get('AZURE_OPENAI_DEPLOYMENT') ?? 'gpt-realtime-2.1', // the deployment name
      transcribeModel: get('AZURE_OPENAI_TRANSCRIBE_MODEL') ?? 'whisper-1',
      url: `${new URL(endpoint).origin.replace(/^http/, 'ws')}/openai/v1/realtime`,
    };
  }
  return {
    azure: false,
    apiKey: get('OPENAI_API_KEY'),
    model: get('OPENAI_REALTIME_MODEL') ?? 'gpt-realtime-2.1',
    transcribeModel: get('OPENAI_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe',
    url: get('OPENAI_REALTIME_URL') ?? 'wss://api.openai.com/v1/realtime', // override only for tests or a proxy
  };
}

const LISTENER_INSTRUCTIONS = 'You are a silent transcriber. Never respond.';

const ANALYST_INSTRUCTIONS = `You track what people in a support meeting are talking about and maintain a list of "concepts", each with a directory-search query.
You never speak. Each message gives the CURRENT concepts (JSON) and one or more NEW lines of the conversation (speakers are not labelled).
Always call set_concepts exactly once with the COMPLETE updated list.
- If the new lines build on an existing concept (more detail, a place, an age, a specific need, a correction), UPDATE that concept's query so it becomes more specific. Do not create a separate concept.
- Only add a new concept when the conversation moves to a genuinely different topic. Keep unrelated existing concepts unchanged.
- "label" is a short topic name (2-4 words). "query" is one concise, specific search query (under 12 words) describing the support needed, in plain words.
- Do not include people's names or other personal details in labels or queries.
- If the new lines are chatter with nothing searchable, return the current list unchanged.`;

const SET_CONCEPTS_TOOL = {
  type: 'function',
  name: 'set_concepts',
  description: 'Replace the full list of tracked concepts with this updated list.',
  parameters: {
    type: 'object',
    properties: {
      concepts: {
        type: 'array',
        items: { type: 'object', properties: { label: { type: 'string' }, query: { type: 'string' } }, required: ['label', 'query'] },
      },
    },
    required: ['concepts'],
  },
};

/**
 * "listener": streams the meeting audio in and emits transcripts (no responses).
 * "analyst": text-only; given the current concepts + new lines, calls set_concepts.
 */
export class RealtimeSession {
  private ws: WebSocket;
  private ready = false;
  private queue: string[] = [];
  private audioChunks = 0;
  private audioBytes = 0;
  private audioTimer: NodeJS.Timeout | undefined;
  private speaking = false;
  private label: string;
  private mode: 'listener' | 'analyst';
  private config: RealtimeConfig;
  private h: RealtimeHandlers;

  constructor(label: string, mode: 'listener' | 'analyst', config: RealtimeConfig, handlers: RealtimeHandlers) {
    this.label = label;
    this.mode = mode;
    this.config = config;
    this.h = handlers;
    if (!config.apiKey) throw new Error('Live transcription is not configured.');
    this.ws = new WebSocket(`${config.url}?model=${encodeURIComponent(config.model)}`, {
      headers: config.azure ? { 'api-key': config.apiKey } : { Authorization: `Bearer ${config.apiKey}` },
    });
    this.ws.on('open', () => this.configure());
    this.ws.on('message', data => this.handle(data.toString()));
    this.ws.on('error', error => this.h.onError(`Realtime connection error: ${error.message}`));
    this.ws.on('close', () => this.h.onClose());
  }

  private send(event: unknown) {
    const text = JSON.stringify(event);
    if (!this.ready && (event as { type: string }).type !== 'session.update') {
      if (this.queue.length < 200) this.queue.push(text);
      return;
    }
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(text);
    this.h.onEvent?.('out', event);
  }

  private configure() {
    const listener = this.mode === 'listener';
    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: listener ? LISTENER_INSTRUCTIONS : ANALYST_INSTRUCTIONS,
        output_modalities: ['text'],
        ...(listener
          ? {
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  transcription: { model: this.config.transcribeModel },
                  turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600, create_response: false },
                },
              },
            }
          : { tools: [SET_CONCEPTS_TOOL], tool_choice: 'required' }),
      },
    });
  }

  private handle(raw: string) {
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }
    this.h.onEvent?.('in', event);
    switch (event.type) {
      case 'session.updated':
        this.ready = true;
        for (const text of this.queue) { this.ws.send(text); this.h.onEvent?.('out', JSON.parse(text)); }
        this.queue = [];
        break;
      case 'input_audio_buffer.speech_started':
        this.speaking = true;
        break;
      case 'input_audio_buffer.committed':
        this.speaking = false;
        this.h.onCommitted?.();
        break;
      case 'conversation.item.input_audio_transcription.delta':
        this.h.onTranscript?.(event.delta ?? '', false, event.item_id);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        this.h.onTranscript?.(event.transcript ?? '', true, event.item_id);
        break;
      case 'conversation.item.input_audio_transcription.failed':
        this.h.onTranscriptionFailed?.(event.error?.message ?? 'Transcription failed for part of the audio.');
        break;
      case 'response.function_call_arguments.done':
        if (event.name === 'set_concepts') {
          try {
            const args = JSON.parse(event.arguments);
            const concepts: Concept[] = Array.isArray(args.concepts) ? args.concepts : [];
            this.h.onConcepts?.(concepts.filter(c => typeof c?.label === 'string' && typeof c?.query === 'string' && c.label && c.query).slice(0, 8));
          } catch { this.h.onError('The topic tracker returned something unreadable.'); }
        }
        break;
      case 'response.done':
        this.h.onResponseDone?.();
        break;
      case 'error':
        // Committing at the end of a meeting with nothing buffered is expected, not a problem to show.
        if (event.error?.code === 'input_audio_buffer_commit_empty' || /buffer too small/i.test(event.error?.message ?? '')) break;
        this.h.onError(event.error?.message ?? 'Realtime error.');
        break;
      default:
        if (String(event.type).startsWith('response.output_audio')) console.warn(`[${this.label}] unexpected audio output event`);
    }
  }

  appendAudio(pcm16: Buffer) {
    // Summarise the audio stream once a second in the developer log instead of every 100ms chunk.
    this.audioChunks++;
    this.audioBytes += pcm16.length;
    this.audioTimer ??= setTimeout(() => {
      this.h.onEvent?.('out', { type: 'input_audio_buffer.append', audio: `<${this.audioChunks} chunks, ${this.audioBytes} bytes pcm16>` });
      this.audioChunks = this.audioBytes = 0;
      this.audioTimer = undefined;
    }, 1000);
    const message = JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm16.toString('base64') });
    if (this.ready) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(message); }
    else if (this.queue.length < 200) this.queue.push(message);
  }

  /** Listener only: turn any speech still in the buffer into a final item (used when the meeting ends). */
  commit() { if (this.speaking) this.send({ type: 'input_audio_buffer.commit' }); }

  /** Analyst only: send the current concepts plus new lines and ask for the updated list. */
  analyze(current: Concept[], lines: string[]) {
    const text = `CURRENT concepts:\n${JSON.stringify(current)}\n\nNEW lines:\n${lines.join('\n')}`;
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    this.send({ type: 'response.create' });
  }

  close() {
    clearTimeout(this.audioTimer);
    this.ws.close();
  }
}
