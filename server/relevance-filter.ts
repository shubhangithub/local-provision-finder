import { modelEnv } from './realtime-session.ts';

export interface FilterCandidate { id: string; name: string; needs: string[]; snippet: string }
export interface FilterOutcome { ids: string[]; ms: number }
export interface FilterConfig { apiKey?: string; model: string; url: string; azure: boolean }

const MAX_KEEP = 6;
const SYSTEM = `You filter service listings for a live conversation. Pick the candidate indices that genuinely and directly fit the user's need, best first, at most ${MAX_KEEP}. Drop anything off-topic, generic, or only loosely related. Reply with comma-separated indices only (e.g. "2,0,5"), or NONE.`;

/** Same provider choice as the realtime session: Azure OpenAI when configured, otherwise OpenAI. */
export function filterConfig(): FilterConfig {
  const get = modelEnv();
  const endpoint = get('AZURE_OPENAI_ENDPOINT');
  if (endpoint && get('AZURE_OPENAI_API_KEY')) {
    return { azure: true, apiKey: get('AZURE_OPENAI_API_KEY'), model: get('AZURE_OPENAI_FILTER_DEPLOYMENT') ?? 'gpt-4.1-mini', url: `${new URL(endpoint).origin}/openai/v1/chat/completions` };
  }
  return { azure: false, apiKey: get('OPENAI_API_KEY'), model: get('OPENAI_FILTER_MODEL') ?? 'gpt-4.1-mini', url: 'https://api.openai.com/v1/chat/completions' };
}

/** Candidates taken from the top of each ranked list. */
export const PER_LIST = 20;

const cache = new Map<string, FilterOutcome>();

/** Merge two ranked lists, alternating so neither retrieval method is favoured; dedupe by id and by name+provider. */
export function mergeCandidates<T extends { id: string; name: string; provider?: string }>(a: T[], b: T[], perList = PER_LIST): T[] {
  const seen = new Set<string>();
  const keys = new Set<string>();
  const out: T[] = [];
  for (let i = 0; i < perList; i++) {
    for (const item of [a[i], b[i]]) {
      if (!item || seen.has(item.id)) continue;
      const key = `${item.name}|${item.provider ?? ''}`.toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim();
      if (keys.has(key)) continue;
      seen.add(item.id);
      keys.add(key);
      out.push(item);
    }
  }
  return out;
}

export function parseKept(text: string, count: number): number[] {
  return [...new Set((text.match(/\d+/g) ?? []).map(Number))].filter(i => i < count).slice(0, MAX_KEEP);
}

/**
 * One small LLM call: pick the candidates that fit. Tuned for latency: plain comma-separated
 * output instead of a JSON schema, short snippets, a hard output-token cap.
 */
export async function filterResults(query: string, context: string[], candidates: FilterCandidate[], config: FilterConfig, fetcher: typeof fetch = fetch): Promise<FilterOutcome | null> {
  if (!candidates.length) return { ids: [], ms: 0 };
  const key = `${query}|${candidates.map(c => c.id).join(',')}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, ms: 0 };
  if (!config.apiKey) return null;
  const list = candidates.map((c, i) => `${i}. ${c.name} | ${c.needs.slice(0, 4).join(', ')} | ${c.snippet.replace(/\s+/g, ' ').slice(0, 100)}`).join('\n');
  const user = `Recent conversation:\n${context.slice(-3).join('\n') || '(none)'}\n\nNeed: ${query}\n\nCandidates:\n${list}`;
  const started = Date.now();
  try {
    // Azure deployments here are reasoning models: no temperature, low effort, and room for a few reasoning tokens.
    const tuning = config.azure ? { reasoning_effort: 'low', max_completion_tokens: 150 } : { temperature: 0, max_completion_tokens: 40 };
    const response = await fetcher(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.azure ? { 'api-key': config.apiKey } : { Authorization: `Bearer ${config.apiKey}` }) },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ model: config.model, ...(config.azure ? {} : { store: false }), ...tuning, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json() as { choices: { message: { content: string } }[] };
    const ids = parseKept(data.choices[0].message.content, candidates.length).map(i => candidates[i].id);
    const outcome = { ids, ms: Date.now() - started };
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, outcome);
    return outcome;
  } catch (error) {
    console.error('Relevance filter failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
