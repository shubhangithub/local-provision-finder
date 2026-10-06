import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAssistantRecords } from './assistant-catalogue';
import { EnrichmentStore } from './enrichment-store';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
describe('records loaded for the live meeting and the assistant', () => {
  it('include enriched text and details, the same as search', () => {
    const directory = mkdtempSync(join(tmpdir(), 'assistant-enrichment-'));dirs.push(directory);
    const service = { id: 'bristol:1', name: 'Talking Therapies', provider: 'Rooms', description: 'Mental health support', searchText: 'name: Talking Therapies', source: 'Bristol', postcode: null, lat: null, lng: null, cost: null };
    const db = new DatabaseSync(join(directory, 'services.sqlite'));
    db.exec('CREATE TABLE catalogue_services(id TEXT PRIMARY KEY,source_id TEXT,postcode TEXT,lat REAL,lng REAL,vetting TEXT,availability TEXT,record_json TEXT,search_text TEXT)');
    db.prepare('INSERT INTO catalogue_services VALUES(?,?,?,?,?,?,?,?,?)').run(service.id, 'bristol', null, null, null, 'public', 'Available', JSON.stringify(service), service.searchText);db.close();
    expect(loadAssistantRecords(directory)[0].searchText).not.toMatch(/polish/i);
    const store = new EnrichmentStore(join(directory, 'enrichment.sqlite'));const run = store.startRun(service, 'job', {});
    store.complete(run.id, { id: 'job', status: 'completed', result: { outcome: 'found', facts: [{ key: 'languages', value: 'Therapy offered in Polish and English', source_url: 'https://rooms.example.test' }, { key: 'cost', topic: 'cost', value: 'Free first session', source_url: 'https://rooms.example.test/cost' }] } }, service);store.close();
    const [loaded] = loadAssistantRecords(directory);
    expect(loaded.searchText).toMatch(/Polish and English/);expect(loaded.cost).toBe('Free first session');
  });
});
