import { searchDirectory } from './directory-search.ts';
import { assistantSearchParams } from './assistant.ts';
import { mergeCandidates, PER_LIST } from './relevance-filter.ts';
import type { DirectoryRecord, DirectorySummary } from '../src/lib/directory.ts';

export interface MeetingService extends DirectorySummary { needs: string[]; evidence?: string }

const GENERIC = new Set(['a','an','and','the','for','with','of','to','in','on','at','is','are','be','it','me','my','i','we','you','help','need','needs','want','support','service','services','looking','find']);
/**
 * The sentences of a service's own text that best match the query, so the relevance filter sees why a service
 * matched (for example an enriched note that therapy is offered in Polish) and not only its generic description.
 * Words the service's name and description do not already contain count triple: they are what the summary hides.
 */
export function evidenceExcerpt(text: string, query: string, covered = '', max = 220): string | undefined {
  const terms = [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(term => term.length > 2 && !GENERIC.has(term)))];
  if (!terms.length) return undefined;
  const has = (haystack: string, term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack);
  const known = covered.toLowerCase();
  const weight = new Map(terms.map(term => [term, has(known, term) ? 1 : 3]));
  const scored: { sentence: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.replace(/\s+/g, ' ').trim();
    if (sentence.length < 8 || seen.has(sentence)) continue;
    seen.add(sentence);
    const lower = sentence.toLowerCase();
    const score = terms.reduce((total, term) => total + (has(lower, term) ? weight.get(term)! : 0), 0);
    if (score > 0) scored.push({ sentence, score });
  }
  if (!scored.length) return undefined;
  scored.sort((x, y) => y.score - x.score);
  let out = '';
  for (const { sentence } of scored.slice(0, 2)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (out && next.length > max) break;
    out = next;
  }
  return out.length > max ? `${out.slice(0, max).trimEnd()}…` : out;
}

/**
 * Candidates for one concept: the project's own directory search run twice (keyword-only and
 * hybrid/semantic, both area-scoped), merged alternately so neither method is favoured.
 */
export async function searchConcept(records: DirectoryRecord[], area: string, query: string): Promise<MeetingService[]> {
  const params = (mode: string) => { const p = assistantSearchParams({ area }, query); p.set('mode', mode); return p; };
  const [keyword, hybrid] = await Promise.all([searchDirectory(records, params('keyword')), searchDirectory(records, params('semantic'))]);
  const byId = new Map(records.map(record => [record.id, record]));
  const merged = mergeCandidates(keyword.records, hybrid.records, PER_LIST);
  return merged.map(summary => ({ ...summary, needs: [...(byId.get(summary.id)?.needs ?? []), ...(byId.get(summary.id)?.categories ?? [])], evidence: evidenceExcerpt(byId.get(summary.id)?.searchText ?? '', query, `${summary.name} ${byId.get(summary.id)?.description ?? ''}`) }));
}
