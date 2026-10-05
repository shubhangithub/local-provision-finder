import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

// Read-only, loopback-only prototype API. A staff demo is not authentication.
// Imported records never enter the public search bundle.
export function importsApi(): Plugin {
  const directory = resolve(process.cwd(), 'data');
  const require = createRequire(import.meta.url);
  const handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
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
      try {
        if (url.pathname === '/api/imports/service') {
          const id = url.searchParams.get('id');
          const row = db.prepare('SELECT record_json FROM catalogue_services WHERE id=?').get(id ?? '');
          if (!row) return send(404, { error: 'Imported service not found.' });
          const record = JSON.parse(String(row.record_json));
          const { raw: _raw, ...readable } = record;
          return send(200, { record: readable });
        }
        if (url.pathname !== '/api/imports') return send(404, { error: 'Endpoint not found.' });
        if (url.searchParams.has('area') || url.searchParams.has('lat')) {
          const area = (url.searchParams.get('area') ?? '').trim();
          const q = (url.searchParams.get('q') ?? '').slice(0, 200).trim().toLowerCase();
          const latitude = Number(url.searchParams.get('lat'));
          const longitude = Number(url.searchParams.get('lng'));
          const nearby = url.searchParams.has('lat');
          if (nearby && (!url.searchParams.has('lng') || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180)) return send(400, {error:'Invalid coordinates.'});
          const miles = (lat: number, lng: number) => {
            const rad = Math.PI/180;
            const a = Math.sin((lat-latitude)*rad/2)**2 + Math.cos(latitude*rad)*Math.cos(lat*rad)*Math.sin((lng-longitude)*rad/2)**2;
            return 3958.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
          };
          const records = db.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source'").all().map(row => JSON.parse(String(row.record_json))).filter(record => !q || record.searchText.toLowerCase().includes(q)).map(record => {
            const sites = [{lat:record.lat,lng:record.lng}, ...(record.locations ?? []).map((site: {location?: Record<string, unknown>}) => ({lat:site.location?.latitude ?? site.location?.lat,lng:site.location?.longitude ?? site.location?.lon}))];
            const distances = sites.filter(site => typeof site.lat === 'number' && typeof site.lng === 'number').map(site => miles(site.lat,site.lng));
            return {...record, distanceMiles: nearby && distances.length ? Math.min(...distances) : null};
          }).filter(record => nearby ? record.distanceMiles !== null && record.distanceMiles <= 10 : area === 'Bristol' ? record.source.includes('Bristol') : area === 'Kingston' ? record.source.includes('Kingston') : JSON.stringify([record.postcode,record.locations]).toLowerCase().replace(/\s/g,'').includes(area.toLowerCase().replace(/\s/g,'')));
          records.sort((a,b) => nearby ? a.distanceMiles-b.distanceMiles || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
          const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
          return send(200,{total:records.length,records:records.slice((page-1)*20,page*20).map(record => ({id:record.id,name:record.name,provider:record.provider,postcode:record.postcode,description:record.description.slice(0,180),distanceMiles:record.distanceMiles})),page,pageSize:20,ready:true});
        }
        const q = (url.searchParams.get('q') ?? '').slice(0, 200).trim();
        const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
        const pageSize = 20;
        const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        const total = Number(db.prepare("SELECT COUNT(*) AS count FROM catalogue_services WHERE availability != 'Removed at source' AND search_text LIKE ? ESCAPE '\\'").get(pattern)?.count ?? 0);
        const records = db.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source' AND search_text LIKE ? ESCAPE '\\' ORDER BY json_extract(record_json,'$.name') COLLATE NOCASE LIMIT ? OFFSET ?").all(pattern, pageSize, (page-1)*pageSize).map(row => {
          const record = JSON.parse(String(row.record_json));
          return { id: record.id, name: record.name, provider: record.provider, postcode: record.postcode, categories: record.categories, needs: record.needs, source: record.source, vetting: record.vetting, lastVerified: record.lastVerified, sourceUpdatedAt: record.sourceUpdatedAt, description: record.description.slice(0, 180), publicPhone: record.publicPhone, publicEmail: record.publicEmail };
        });
        const reportPath = resolve(directory, 'ingest-report.json');
        const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
        return send(200, { total, records, page, pageSize, report, ready: true });
      } finally { db.close(); }
    } catch (error) {
      console.error('Imported catalogue read failed:', error);
      return send(500, { error: 'Could not read the imported catalogue. Check the local server log.' });
    }
  };
  return { name: 'local-imported-catalogue', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
