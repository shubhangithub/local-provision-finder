import { RealtimeSession, type Concept, type RealtimeConfig } from './realtime-session.ts';
import { filterResults, type FilterCandidate, type FilterConfig, type FilterOutcome } from './relevance-filter.ts';
import { searchConcept, type MeetingService } from './meeting-search.ts';
import type { DirectoryRecord } from '../src/lib/directory.ts';

export interface ViewConcept extends Concept {
  results: MeetingService[];
  filtered: { status: 'pending' | 'done' | 'error'; ids: string[]; ms: number };
}
export type MeetingMessage =
  | { type: 'ready' }
  | { type: 'transcript'; itemId: string; text: string; final: boolean }
  | { type: 'concepts'; concepts: ViewConcept[] }
  | { type: 'error'; message: string }
  | { type: 'notice'; message: string }
  | { type: 'debug'; source: string; dir: 'in' | 'out'; eventType: string; ts: number };
export interface MeetingDeps {
  search: (records: DirectoryRecord[], area: string, query: string) => Promise<MeetingService[]>;
  filter: (query: string, context: string[], candidates: FilterCandidate[]) => Promise<FilterOutcome | null>;
}

/**
 * One meeting on a shared microphone: a listener session transcribes the audio, an analyst session turns
 * the transcript into search concepts (serially, batching lines that arrive while it is busy), and each
 * concept is searched against the directory and then relevance-filtered. Raw results are sent first,
 * filtered results replace them when ready.
 */
export class MeetingSession {
  private listener?: RealtimeSession;
  private analyst?: RealtimeSession;
  private concepts: Concept[] = [];
  private view: ViewConcept[] = [];
  private pending: string[] = [];
  private history: string[] = [];
  private busy = false;
  private gen = 0;
  private uncommitted = 0;
  private closed = false;
  private send: (message: MeetingMessage) => void;
  private records: DirectoryRecord[];
  private area: string;
  private config: RealtimeConfig;
  private filterConfig: FilterConfig;
  private deps: MeetingDeps;

  constructor(options: { send: (message: MeetingMessage) => void; records: DirectoryRecord[]; area: string; config: RealtimeConfig; filter: FilterConfig; deps?: Partial<MeetingDeps> }) {
    this.send = options.send;
    this.records = options.records;
    this.area = options.area;
    this.config = options.config;
    this.filterConfig = options.filter;
    this.deps = {
      search: options.deps?.search ?? searchConcept,
      filter: options.deps?.filter ?? ((query, context, candidates) => filterResults(query, context, candidates, this.filterConfig)),
    };
  }

  start() {
    const debug = (source: string) => (dir: 'in' | 'out', event: unknown) =>
      this.send({ type: 'debug', source, dir, eventType: String((event as { type?: string }).type ?? '?'), ts: Date.now() });
    this.analyst = new RealtimeSession('analyst', 'analyst', this.config, {
      onConcepts: concepts => { this.concepts = concepts; void this.publish(); },
      onResponseDone: () => { this.busy = false; this.drain(); },
      onError: message => { this.busy = false; this.send({ type: 'error', message: `Topic tracking: ${message}` }); },
      onClose: () => {},
      onEvent: debug('analyst'),
    });
    this.listener = new RealtimeSession('listener', 'listener', this.config, {
      onCommitted: () => { this.uncommitted++; },
      onTranscript: (text, final, itemId) => {
        this.send({ type: 'transcript', itemId, text, final });
        if (!final) return;
        this.uncommitted = Math.max(0, this.uncommitted - 1);
        if (text.trim()) {
          this.history = [...this.history.slice(-5), text.trim()];
          this.pending.push(text.trim());
          this.drain();
        }
      },
      onTranscriptionFailed: message => {
        this.uncommitted = Math.max(0, this.uncommitted - 1);
        console.error('Meeting transcription failed:', message);
        this.send({ type: 'error', message: 'Part of the audio could not be transcribed.' });
      },
      onError: message => this.send({ type: 'error', message }),
      onClose: () => {},
      onEvent: debug('listener'),
    });
    this.send({ type: 'ready' });
  }

  appendAudio(pcm: Buffer) { if (!this.closed) this.listener?.appendAudio(pcm); }

  /** Analyst turns are serial; lines that arrive while it is busy are batched into the next turn. */
  private drain() {
    if (this.busy || !this.pending.length || this.closed) return;
    this.busy = true;
    const lines = this.pending;
    this.pending = [];
    this.analyst?.analyze(this.concepts, lines);
  }

  private async withResults(): Promise<ViewConcept[]> {
    const previous = new Map(this.view.map(v => [v.query, v]));
    return Promise.all(this.concepts.map(async (concept): Promise<ViewConcept> => {
      const old = previous.get(concept.query);
      if (old) return old; // unchanged concept: keep its results and filter outcome
      const results = await this.deps.search(this.records, this.area, concept.query).catch(error => {
        console.error('Meeting search failed:', error instanceof Error ? error.message : 'Unknown error');
        return [] as MeetingService[];
      });
      return { ...concept, results, filtered: { status: 'pending', ids: [], ms: 0 } };
    }));
  }

  private async publish() {
    const gen = ++this.gen;
    const view = await this.withResults();
    if (gen !== this.gen || this.closed) return; // a newer update superseded this one
    this.view = view;
    this.send({ type: 'concepts', concepts: this.view });
    for (const concept of view) {
      if (concept.filtered.status !== 'pending') continue;
      // The filter judges on the passage that matched the query when there is one, not only the generic description.
      const candidates = concept.results.map(r => ({ id: r.id, name: r.name, needs: r.needs, snippet: r.evidence ?? r.snippet }));
      void this.deps.filter(concept.query, this.history, candidates).then(outcome => {
        if (this.closed || !this.view.includes(concept)) return;
        concept.filtered = outcome ? { status: 'done', ids: outcome.ids, ms: outcome.ms } : { status: 'error', ids: [], ms: 0 };
        this.send({ type: 'concepts', concepts: this.view });
      });
    }
  }

  /** Flush the last utterance, then wait (bounded) for transcription, topic tracking and filtering to settle. */
  async finish(timeoutMs = 8000) {
    this.listener?.commit();
    const deadline = Date.now() + timeoutMs;
    const settled = () => this.uncommitted === 0 && !this.busy && !this.pending.length && this.view.every(v => v.filtered.status !== 'pending');
    await new Promise(resolve => setTimeout(resolve, 400)); // let the commit event arrive
    while (!settled() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
  }

  close() {
    this.closed = true;
    this.listener?.close();
    this.analyst?.close();
  }
}
