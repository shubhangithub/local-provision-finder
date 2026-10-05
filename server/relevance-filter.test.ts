import { describe, expect, it } from 'vitest';
import { filterResults, mergeCandidates, parseKept } from './relevance-filter.ts';

const item = (id: string, name = id, provider = 'P') => ({ id, name, provider });

describe('mergeCandidates', () => {
  it('alternates two lists and removes duplicates by id and by name+provider', () => {
    const merged = mergeCandidates([item('a'), item('b'), item('c')], [item('b'), item('x', 'A', 'P'), item('d')], 20);
    expect(merged.map(i => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('takes only the top of each list', () => {
    const list = ['a', 'b', 'c', 'd'].map(id => item(id));
    expect(mergeCandidates(list, [], 2).map(i => i.id)).toEqual(['a', 'b']);
  });
});

describe('parseKept', () => {
  it('reads comma separated indices, ignores out-of-range and repeats, and caps the count', () => {
    expect(parseKept('2, 0, 2, 9, 5', 6)).toEqual([2, 0, 5]);
    expect(parseKept('NONE', 6)).toEqual([]);
    expect(parseKept('0,1,2,3,4,5,6,7', 20)).toHaveLength(6);
  });
});

describe('filterResults', () => {
  it('uses the api-key header and reasoning settings for Azure', async () => {
    let seen: { headers: Record<string, string>; body: Record<string, unknown> } | undefined;
    const fetcher = (async (_url: string, init: RequestInit) => { seen = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ choices: [{ message: { content: '0' } }] })); }) as unknown as typeof fetch;
    await filterResults('azure query', [], [{ id: 'z', name: 'Z', needs: [], snippet: '' }], { apiKey: 'az', model: 'gpt-6.1-sol', url: 'https://r.openai.azure.com/openai/v1/chat/completions', azure: true }, fetcher);
    expect(seen?.headers['api-key']).toBe('az');
    expect(seen?.headers.Authorization).toBeUndefined();
    expect(seen?.body).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'low' });
    expect(seen?.body.temperature).toBeUndefined();
  });
  const candidates = [0, 1, 2].map(i => ({ id: `id${i}`, name: `Service ${i}`, needs: ['childcare'], snippet: 'text' }));
  const reply = (content: string) => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))) as unknown as typeof fetch;
  it('returns the chosen ids in the model order and caches the outcome', async () => {
    let calls = 0;
    const fetcher = (async (...args: Parameters<typeof fetch>) => { calls++; return reply('2,0')(...args); }) as typeof fetch;
    const config = { apiKey: 'test-key', model: 'm', url: 'https://x/chat', azure: false };
    const first = await filterResults('cache test query', [], candidates, config, fetcher);
    expect(first?.ids).toEqual(['id2', 'id0']);
    const second = await filterResults('cache test query', [], candidates, config, fetcher);
    expect(second).toMatchObject({ ids: ['id2', 'id0'], ms: 0 });
    expect(calls).toBe(1);
  });
  it('returns null (so callers fall back) when the API fails or no key is set', async () => {
    const failing = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    expect(await filterResults('fails', [], candidates, { apiKey: 'k', model: 'm', url: 'https://x/chat', azure: false }, failing)).toBeNull();
    expect(await filterResults('nokey', [], candidates, { model: 'm', url: 'https://x/chat', azure: false }, reply('0'))).toBeNull();
  });
  it('does not call the API for an empty candidate list', async () => {
    expect(await filterResults('empty', [], [], { apiKey: 'k', model: 'm', url: 'https://x/chat', azure: false })).toEqual({ ids: [], ms: 0 });
  });
});
