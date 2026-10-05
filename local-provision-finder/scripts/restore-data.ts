import { existsSync, createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const source=resolve('data');const target=resolve(process.argv[2] ?? 'data');mkdirSync(target,{recursive:true});
const database=resolve(target,'services.sqlite');
if (!existsSync(database)) {
  const archive=resolve(source,'services.sqlite.gz');
  if (!existsSync(archive)) throw new Error('No directory snapshot available. Run npm run ingest.');
  const metadata=JSON.parse(readFileSync(resolve(source,'snapshot.json'),'utf8'));
  if (createHash('sha256').update(readFileSync(archive)).digest('hex')!==metadata.sha256) throw new Error('Directory snapshot checksum failed.');
  await pipeline(createReadStream(archive),createGunzip(),createWriteStream(database));
  console.log('Restored the complete local service database.');
}
const originals=resolve(target,'services.internal.json'),cleaned=resolve(target,'services.cleaned.json');
if (!existsSync(originals) || !existsSync(cleaned)) {
  const db=new DatabaseSync(database,{readOnly:true});
  try {
    if (db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok') throw new Error('Restored database integrity check failed.');
    if (!existsSync(originals)) writeFileSync(originals,JSON.stringify(db.prepare('SELECT record_json FROM services ORDER BY id').all().map(row=>JSON.parse(String(row.record_json))),null,2)+'\n');
    if (!existsSync(cleaned)) writeFileSync(cleaned,JSON.stringify(db.prepare('SELECT record_json FROM catalogue_services ORDER BY id').all().map(row=>JSON.parse(String(row.record_json))),null,2)+'\n');
  } finally {db.close();}
}

const semantic=resolve(target,'semantic-index.sqlite');const semanticArchive=resolve(source,'semantic-index.sqlite.gz');
if (!existsSync(semantic) && existsSync(semanticArchive)) {
 const metadata=JSON.parse(readFileSync(resolve(source,'snapshot.json'),'utf8'));
 if (!metadata.semanticIndexSha256 || createHash('sha256').update(readFileSync(semanticArchive)).digest('hex')!==metadata.semanticIndexSha256) throw new Error('Semantic index checksum failed.');
 await pipeline(createReadStream(semanticArchive),createGunzip(),createWriteStream(semantic));
 console.log('Restored the local semantic search index.');
}
