import { filterConfig, type FilterConfig } from './relevance-filter.ts';

export interface SummaryInput { field: string; label: string; service: string; said: string; hedged?: boolean }
export type Summariser = (input: SummaryInput) => Promise<string | null>;

const SYSTEM = `You write one line for a public service directory page. You are given what a person said on a phone call about one service. Rewrite it as a short neutral statement about the service itself, in the third person, under 120 characters. Keep numbers, units and prices exactly. Do not use "I", "me", "my", "we", "our", "said", "told" or any name. Do not add facts that were not said. If the person was unsure, keep that doubt with a word like "may" or "possibly". Reply with the statement only.`;
const FIRST_PERSON = /\b(i|i'm|i've|i'd|me|my|mine|we|our|us|said|says|told)\b/i;
export const MAX_LENGTH = 200;

/** A rewrite is only used when it is a short statement about the service, not the speaker. */
export function acceptable(text: string): boolean {
  const value = text.trim();
  return value.length > 0 && value.length <= MAX_LENGTH && !value.includes('\n') && !FIRST_PERSON.test(value);
}

const cache = new Map<string, string | null>();

/** Rewrites what a person said into a neutral statement about the service. Returns null on any failure so the caller can fall back. */
export async function summariseFinding(input: SummaryInput, config: FilterConfig = filterConfig(), fetcher: typeof fetch = fetch): Promise<string | null> {
  const key = `${input.field}|${input.service}|${input.said}|${input.hedged ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key)!;
  if (!config.apiKey) return null;
  // Only the service name and the person's words are sent: never a phone number or a first name.
  const user = `Service: ${input.service}\nField: ${input.label}\nWhat the person said: ${input.said}${input.hedged ? '\nThe person was unsure.' : ''}`;
  try {
    const tuning = config.azure ? { reasoning_effort: 'low', max_completion_tokens: 300 } : { temperature: 0, max_completion_tokens: 80 };
    const response = await fetcher(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.azure ? { 'api-key': config.apiKey } : { Authorization: `Bearer ${config.apiKey}` }) },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ model: config.model, ...(config.azure ? {} : { store: false }), ...tuning, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json() as { choices: { message: { content: string } }[] };
    const text = String(data.choices[0]?.message?.content ?? '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ');
    const result = acceptable(text) ? text : null;
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (error) {
    console.error('Finding summary failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
