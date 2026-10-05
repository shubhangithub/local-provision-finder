import { DatabaseSync } from 'node:sqlite';
import { renameSync,rmSync } from 'node:fs';
import { serialiseChunks } from '../server/semantic.ts';
const path='data/semantic-index.sqlite', temporary='data/semantic-index.packed.sqlite';
rmSync(temporary,{force:true});const source=new DatabaseSync(path,{readOnly:true});const packed=new DatabaseSync(temporary);
packed.exec('CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE embeddings(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,chunks_json TEXT NOT NULL);BEGIN');
try {
 for (const row of source.prepare('SELECT * FROM metadata').all()) packed.prepare('INSERT INTO metadata VALUES (?,?)').run(row.key,row.value);
 const insert=packed.prepare('INSERT INTO embeddings VALUES (?,?,?)');let count=0;
 for (const row of source.prepare('SELECT * FROM embeddings').iterate()) {
  const chunks=JSON.parse(String(row.chunks_json));
  insert.run(row.id,row.fingerprint,chunks[0]?.packed ? String(row.chunks_json) : serialiseChunks(chunks));count++;
 }
 packed.exec('COMMIT');packed.close();source.close();renameSync(temporary,path);
 console.log(`Packed ${count} service embeddings losslessly as original float32 vectors.`);
} catch(error) {try {packed.close();source.close();} catch {}rmSync(temporary,{force:true});throw error;}
