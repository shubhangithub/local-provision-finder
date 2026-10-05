import { searchDirectory } from './directory-search.ts';
import { assistantSearchParams } from './assistant.ts';
import { mergeCandidates, PER_LIST } from './relevance-filter.ts';
import type { DirectoryRecord, DirectorySummary } from '../src/lib/directory.ts';

export interface MeetingService extends DirectorySummary { needs: string[] }

/**
 * Candidates for one concept: the project's own directory search run twice (keyword-only and
 * hybrid/semantic, both area-scoped), merged alternately so neither method is favoured.
 */
export async function searchConcept(records: DirectoryRecord[], area: string, query: string): Promise<MeetingService[]> {
  const params = (mode: string) => { const p = assistantSearchParams({ area }, query); p.set('mode', mode); return p; };
  const [keyword, hybrid] = await Promise.all([searchDirectory(records, params('keyword')), searchDirectory(records, params('semantic'))]);
  const byId = new Map(records.map(record => [record.id, record]));
  const merged = mergeCandidates(keyword.records, hybrid.records, PER_LIST);
  return merged.map(summary => ({ ...summary, needs: [...(byId.get(summary.id)?.needs ?? []), ...(byId.get(summary.id)?.categories ?? [])] }));
}
