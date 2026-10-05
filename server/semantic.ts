import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DirectoryRecord } from '../src/lib/directory.ts';
import { embeddingModel, embedTexts } from './embeddings.ts';
export const indexVersion = 'minilm-chunks-v1';
export interface SemanticChunk { text: string; vector: number[] }
export function serialiseChunks(chunks:SemanticChunk[]):string {
  return JSON.stringify(chunks.map(chunk=>({text:chunk.text,packed:Buffer.from(new Float32Array(chunk.vector).buffer).toString('base64')})));
}
function readChunks(value:string):SemanticChunk[] {
  return (JSON.parse(value) as {text:string;vector?:number[];packed?:string}[]).map(chunk=>{
    if (!chunk.packed) return {text:chunk.text,vector:chunk.vector ?? []};
    const bytes=Buffer.from(chunk.packed,'base64');
    return {text:chunk.text,vector:Array.from(new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4))};
  });
}
export interface SemanticMatch { score: number; snippet: string }
export function semanticChunks(record: DirectoryRecord): string[] {
  // Search all retained prose in overlapping windows rather than silently truncating long services.
  const fields = [record.name,record.provider,(record.tags ?? []).join(', '),(record.categories ?? []).join(', '),(record.needs ?? []).join(', '),record.description,record.eligibilitySummary,(record.accessibility ?? []).join(', '),record.cost,record.openingTimes,record.searchText].filter(Boolean).join('\n');
  const words = fields.split(/\s+/).filter(Boolean);
  const chunks: string[] = []; const seen = new Set<string>();
  for (let start=0;start<words.length;start+=110) {
    const body = words.slice(start,start+140).join(' ');
    const value = start ? `${record.name}. ${body}` : body;
    if (!seen.has(value)) {seen.add(value);chunks.push(value);}
    if (start+140>=words.length) break;
  }
  return chunks.length ? chunks : [record.name];
}
export function recordFingerprint(record: DirectoryRecord): string { return createHash('sha256').update(indexVersion).update(embeddingModel).update(JSON.stringify(semanticChunks(record))).digest('hex'); }
export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || !left.length) return 0;
  let product=0, a=0, b=0;
  for (let i=0;i<left.length;i++) {product+=left[i]*right[i];a+=left[i]**2;b+=right[i]**2;}
  return a && b ? product/Math.sqrt(a*b) : 0;
}
interface IndexEntry {fingerprint: string; chunks: SemanticChunk[]}
let cached: {stamp: string; records: Map<string,IndexEntry>} | undefined;
function readIndex(): Map<string,IndexEntry> {
  const path = resolve(process.cwd(),'data/semantic-index.sqlite');
  if (!existsSync(path)) return new Map();
  const stat = statSync(path); const stamp = `${stat.mtimeMs}:${stat.size}`;
  if (cached?.stamp === stamp) return cached.records;
  const db = new DatabaseSync(path,{readOnly:true});
  try {
    const meta = db.prepare("SELECT value FROM metadata WHERE key='version'").get();
    if (meta?.value !== indexVersion) return new Map();
    const records = new Map<string,IndexEntry>();
    for (const row of db.prepare('SELECT id,fingerprint,chunks_json FROM embeddings').all()) records.set(String(row.id),{fingerprint:String(row.fingerprint),chunks:readChunks(String(row.chunks_json))});
    cached={stamp,records}; return records;
  } finally {db.close();}
}
const correctedCache=new Map<string,SemanticChunk[]>();
const queryCache = new Map<string,number[]>();
let pending = Promise.resolve();
async function queryVector(query: string): Promise<number[]> {
  const found = queryCache.get(query); if (found) return found;
  // Serialise cold concurrent requests; keep the bounded cache in memory, not on disk.
  const job = pending.then(async () => {
    const existing = queryCache.get(query); if (existing) return existing;
    const [vector] = await embedTexts([query]);
    if (queryCache.size >= 100) queryCache.delete(queryCache.keys().next().value!);
    queryCache.set(query,vector); return vector;
  });
  pending=job.then(() => {},() => {}); return job;
}
export async function semanticMatches(query: string, records: DirectoryRecord[]): Promise<Map<string,SemanticMatch> | null> {
  const index = readIndex();
  if (!records.length) return new Map();
  // A stale index must not be presented as current semantic results.
  const missing=records.filter(record=>!index.has(record.id));
  if (!index.size || missing.length>10) return null;
  for (const record of records) {
    const fingerprint=recordFingerprint(record);const entry=index.get(record.id);
    if (entry?.fingerprint===fingerprint) continue;
    const key=`${record.id}:${fingerprint}`;let chunks=correctedCache.get(key);
    if (!chunks) {
      const texts=semanticChunks(record);chunks=[];
      for (let start=0;start<texts.length;start+=8) {const batch=texts.slice(start,start+8);const vectors=await embedTexts(batch);chunks.push(...batch.map((text,i)=>({text,vector:vectors[i]})));}
      if (correctedCache.size>=50) correctedCache.delete(correctedCache.keys().next().value!);
      correctedCache.set(key,chunks);
    }
    index.set(record.id,{fingerprint,chunks});
  }
  const hints:string[]=[];
  if (/\b(job|jobs|employ|employment|unemployed|cv|career)\b|(?:back|return|finding|find).{0,20}\bwork\b/i.test(query)) hints.push('Employment support, job search, CV writing, career advice and training');
  if (/\b(bills?|money|debt|debts|financial|benefits?|budget)\b/i.test(query)) hints.push('Money advice, benefits advice, debt support and financial hardship');
  if (/anxi|anxious|panic|depress|mental|someone to talk|counsell/i.test(query)) hints.push('Mental health support, counselling and talking therapies');
  const vector = await queryVector(hints.length ? `${query}. ${hints.join('. ')}` : query);
  const matches = new Map<string,SemanticMatch>();
  for (const record of records) {
    let best: SemanticMatch = {score:-1,snippet:''};
    for (const chunk of index.get(record.id)!.chunks) {
      const score=cosineSimilarity(vector,chunk.vector);
      if (score>best.score) best={score,snippet:chunk.text};
    }
    matches.set(record.id,best);
  }
  return matches;
}
