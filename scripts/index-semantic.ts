import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { embedTexts, embeddingModel } from '../server/embeddings.ts';
import { indexVersion, recordFingerprint, semanticChunks, serialiseChunks } from '../server/semantic.ts';
import { enrichmentOverlay, readEnrichment } from '../server/enrichment-store.ts';
import type { DirectoryRecord } from '../src/lib/directory.ts';

mkdirSync(resolve('data'),{recursive:true});
const source = new DatabaseSync(resolve('data/services.sqlite'),{readOnly:true});
const records = source.prepare("SELECT record_json FROM catalogue_services WHERE availability != 'Removed at source'").all().map(row => JSON.parse(String(row.record_json)) as DirectoryRecord);
source.close();
// Enriched facts and passages are searched as part of each service's text.
const enrichment = readEnrichment(resolve('data'));
for (let i = 0; i < records.length; i++) records[i] = enrichmentOverlay(records[i], enrichment.get(records[i].id));
const index = new DatabaseSync(resolve('data/semantic-index.sqlite'));
index.exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS embeddings(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,chunks_json TEXT NOT NULL)');
const previous = index.prepare("SELECT value FROM metadata WHERE key='version'").get();
if (previous?.value !== indexVersion) index.exec('DELETE FROM embeddings');
index.prepare("INSERT OR REPLACE INTO metadata VALUES ('version',?)").run(indexVersion);
index.prepare("INSERT OR REPLACE INTO metadata VALUES ('model',?)").run(embeddingModel);
const write = index.prepare('INSERT OR REPLACE INTO embeddings VALUES (?,?,?)');
let completed=0, embedded=0, chunksCount=0;
console.log(`Indexing ${records.length} services locally with ${embeddingModel}.`);
try {
  for (const record of records) {
    const fingerprint = recordFingerprint(record);
    if (index.prepare('SELECT fingerprint FROM embeddings WHERE id=?').get(record.id)?.fingerprint === fingerprint) {completed++;continue;}
    const texts=semanticChunks(record); const chunks=[];
    for (let start=0;start<texts.length;start+=8) {
      const batch=texts.slice(start,start+8); const vectors=await embedTexts(batch);
      chunks.push(...batch.map((text,i) => ({text,vector:vectors[i]})));
    }
    write.run(record.id,fingerprint,serialiseChunks(chunks)); completed++;embedded++;chunksCount+=chunks.length;
    if (embedded%25===0) console.log(`${completed}/${records.length} services · ${chunksCount} text chunks embedded`);
  }
  const ids=new Set(records.map(record => record.id));
  for (const row of index.prepare('SELECT id FROM embeddings').all()) if (!ids.has(String(row.id))) index.prepare('DELETE FROM embeddings WHERE id=?').run(row.id);
  index.prepare("INSERT OR REPLACE INTO metadata VALUES ('generatedAt',?)").run(new Date().toISOString());
  console.log(`Ready: ${completed} services; ${embedded} updated; ${chunksCount} chunks embedded.`);
} finally {index.close();}
