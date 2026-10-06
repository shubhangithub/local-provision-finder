import { describe, expect, it, vi } from 'vitest';
import { searchDirectory } from './directory-search';
import type { DirectoryRecord } from '../src/lib/directory';
vi.mock('./semantic.ts', () => ({ semanticMatches: vi.fn(async () => null) }));
const record = (id: string, source: string, lat: number, lng: number): DirectoryRecord => ({ id, name: `${source} anxiety group`, provider: 'Provider', description: 'Anxiety support', searchText: 'Anxiety support', source, postcode: null, lat, lng });
const kingston = record('k', 'Connected Kingston directory', 51.41, -0.3);
const bristol = record('b', 'Bristol Well Aware directory', 51.45, -2.59);
const ids = async (params: Record<string, string>) => (await searchDirectory([kingston, bristol], new URLSearchParams({ q: 'anxiety', mode: 'keyword', ...params }))).records.map(item => item.id);
describe('a chosen directory stays the scope when the map moves', () => {
  const wide = '-6,50,2,55';
  it('does not pull in another directory when the map is zoomed out over it', async () => {
    expect(await ids({ area: 'Kingston', bounds: wide })).toEqual(['k']);
    expect(await ids({ area: 'Bristol', bounds: wide })).toEqual(['b']);
  });
  it('still narrows within the directory to the visible map area', async () => {
    expect(await ids({ area: 'Kingston', bounds: '-3,51,-2,52' })).toEqual([]);
    expect(await ids({ area: 'Kingston', bounds: '-0.5,51.3,-0.1,51.5' })).toEqual(['k']);
  });
  it('lets the map roam freely when no directory is chosen', async () => {
    expect((await ids({ bounds: wide })).sort()).toEqual(['b', 'k']);
  });
});
