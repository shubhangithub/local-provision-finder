import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface Api {send:(status:number,data:unknown)=>void;url:URL}
/** Shared guards for the local JSON APIs: loopback only, same-origin browser writes, JSON out. */
export function openApi(request:IncomingMessage,response:ServerResponse,options:{staffOnly?:boolean}={}):Api | null {
  const url=new URL(request.url ?? '/','http://localhost');
  response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  const send=(status:number,data:unknown)=>{response.statusCode=status;response.end(JSON.stringify(data));};
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) {send(403,{error:'Local access only.'});return null;}
  if (request.headers.origin && request.headers.origin!==`http://${request.headers.host}`) {send(403,{error:'Use the local application.'});return null;}
  if (options.staffOnly && request.headers['x-staff-demo']!=='true') {send(403,{error:'Enter the staff workspace.'});return null;}
  return {send,url};
}
export async function readJson(request:IncomingMessage,limit:number):Promise<Record<string,unknown> | 'too_large' | 'invalid'> {
  let size=0;const chunks:Buffer[]=[];
  for await (const chunk of request) {const buffer=Buffer.from(chunk);size+=buffer.length;if (size>limit) return 'too_large';chunks.push(buffer);}
  try {const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));return body && typeof body==='object' && !Array.isArray(body) ? body : 'invalid';} catch {return 'invalid';}
}
export function readCatalogueRecord(directory:string,id:string):Record<string,any> | null {
  const path=resolve(directory,'services.sqlite');if (!id || id.length>200 || !existsSync(path)) return null;
  const catalogue=new DatabaseSync(path,{readOnly:true});
  try {const row=catalogue.prepare('SELECT record_json FROM catalogue_services WHERE id=?').get(id);return row ? JSON.parse(String(row.record_json)) : null;} finally {catalogue.close();}
}
