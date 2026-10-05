import {readAvailability,availabilityOverlay} from './availability.ts';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { searchDirectory, SearchInputError } from './directory-search.ts';
import { readServiceTags } from './tags-api.ts';
import { FeedbackStore, type FeedbackService } from './feedback-store.ts';
import type { DirectoryRecord } from '../src/lib/directory.ts';

// Read-only, loopback-only prototype API. A staff demo is not authentication.
// Imported records never enter the public search bundle.
export function importsApi(): Plugin {
  const directory = resolve(process.cwd(), 'data');
  const require = createRequire(import.meta.url);
  const handler = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/imports')) return next();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, data: unknown) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) return send(403, { error: 'Local access only.' });
    if (request.method !== 'GET') return send(405, { error: 'This catalogue browser is read-only.' });
    if (!existsSync(resolve(directory, 'services.sqlite'))) return send(200, { total: 0, records: [], report: null, ready: false });
    try {
      const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
      const db = new DatabaseSync(resolve(directory, 'services.sqlite'), { readOnly: true });
      const feedback = existsSync(resolve(directory,'feedback.sqlite')) ? new FeedbackStore(resolve(directory,'feedback.sqlite')) : null;
      const tags = readServiceTags();const availability=readAvailability(directory);
      const corrected = <T extends FeedbackService>(record:T):T => {
        const updated = availabilityOverlay(feedback ? feedback.corrected(record) : record,availability);
        const serviceTags = tags.get(record.id) ?? [];
        return serviceTags.length ? {...updated,tags:serviceTags,searchText:`Tags: ${serviceTags.join(', ')}\n${updated.searchText ?? ''}`} : {...updated,tags:[]};
      };
      try {
        if (url.pathname === '/api/imports/service') {
          const id = url.searchParams.get('id');
          const row = db.prepare('SELECT record_json FROM catalogue_services WHERE id=?').get(id ?? '');
          if (!row) return send(404, { error: 'Imported service not found.' });
          const record = corrected(JSON.parse(String(row.record_json)));
          const { raw: _raw, ...readable } = record;
          return send(200, { record: readable });
        }
        if (url.pathname !== '/api/imports') return send(404, { error: 'Endpoint not found.' });
        if (url.searchParams.has('area') || url.searchParams.has('lat') || url.searchParams.get('mode') === 'semantic') {
          const records = db.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source'").all().map(row => corrected(JSON.parse(String(row.record_json))) as DirectoryRecord);
          return send(200, await searchDirectory(records,url.searchParams));
        }
        const q = (url.searchParams.get('q') ?? '').slice(0, 200).trim();
        const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
        const pageSize = 20;
        const matching = db.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source'").all().map(row=>corrected(JSON.parse(String(row.record_json)))).filter(record=>!q || record.searchText.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
        const total=matching.length;
        const records=matching.slice((page-1)*pageSize,page*pageSize).map(record=>({id:record.id,name:record.name,provider:record.provider,postcode:record.postcode,categories:record.categories,needs:record.needs,source:record.source,vetting:record.vetting,lastVerified:record.lastVerified,sourceUpdatedAt:record.sourceUpdatedAt,description:record.description.slice(0,180),publicPhone:record.publicPhone,publicEmail:record.publicEmail,tags:record.tags}));
        const reportPath = resolve(directory, 'ingest-report.json');
        const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
        return send(200, { total, records, page, pageSize, report, ready: true });
      } finally { feedback?.close(); db.close(); }
    } catch (error) {
      if (error instanceof SearchInputError) return send(400,{error:error.message});
      console.error('Imported catalogue read failed:', error);
      return send(500, { error: 'Could not read the imported catalogue. Check the local server log.' });
    }
  };
  return { name: 'local-imported-catalogue', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
