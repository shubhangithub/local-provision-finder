import { directoryAreas, type DirectoryRecord } from '../src/lib/directory.ts';

/** Search term suggestions drawn from the directory's own vocabulary, never from service names. */
export interface TermEntry { term: string; total: number; byArea: Record<string, number> }
export type Vocabulary = Map<string, TermEntry>;

const MIN_TERM = 2;
const MAX_TERM = 40;
export const MAX_SUGGESTIONS = 6;

function normalise(value: unknown): string { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''; }

export function buildVocabulary(records: Pick<DirectoryRecord, 'name' | 'source' | 'needs' | 'categories' | 'tags'>[], curated: string[] = []): Vocabulary {
  const names = new Set(records.map(record => normalise(record.name).toLowerCase()));
  const vocabulary: Vocabulary = new Map();
  const add = (raw: unknown, source?: string) => {
    const term = normalise(raw);
    const key = term.toLowerCase();
    if (term.length < MIN_TERM || term.length > MAX_TERM || names.has(key)) return;
    const entry = vocabulary.get(key) ?? { term, total: 0, byArea: {} };
    if (source !== undefined) {
      entry.total++;
      const area = directoryAreas.find(item => source.includes(item.source));
      if (area) entry.byArea[area.id] = (entry.byArea[area.id] ?? 0) + 1;
    }
    vocabulary.set(key, entry);
  };
  for (const term of curated) add(term);
  for (const record of records) {
    // A record carrying a term twice (e.g. as a need and a tag) still counts once.
    const own = new Set([...(record.needs ?? []), ...(record.categories ?? []), ...(record.tags ?? [])].map(value => normalise(value).toLowerCase()));
    for (const key of own) {
      const original = [...(record.needs ?? []), ...(record.categories ?? []), ...(record.tags ?? [])].find(value => normalise(value).toLowerCase() === key);
      add(original, record.source);
    }
  }
  return vocabulary;
}

export function suggestTerms(vocabulary: Vocabulary, query: string, area = ''): string[] {
  const needle = normalise(query).toLowerCase();
  if (needle.length < MIN_TERM) return [];
  const named = directoryAreas.find(item => item.id === area || item.label === area || (item.id === 'Buckinghamshire' && area.toLowerCase() === 'bucks'));
  const ranked: { term: string; rank: number; count: number }[] = [];
  for (const [key, entry] of vocabulary) {
    const index = key.indexOf(needle);
    if (index < 0) continue;
    // Region limits terms to ones its services carry; curated terms (no service count) stay available.
    const count = named ? entry.byArea[named.id] ?? 0 : entry.total;
    if (named && entry.total > 0 && count === 0) continue;
    const rank = index === 0 ? 0 : key.split(/[^a-z0-9]+/).some(word => word.startsWith(needle)) ? 1 : 2;
    ranked.push({ term: entry.term, rank, count });
  }
  return ranked.sort((a, b) => a.rank - b.rank || b.count - a.count || a.term.localeCompare(b.term)).slice(0, MAX_SUGGESTIONS).map(item => item.term);
}
