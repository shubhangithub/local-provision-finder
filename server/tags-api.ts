import { existsSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { TagsStore,TagsInputError } from './tags-store.ts';
export { readServiceTags } from './tags-store.ts';
export function tagsApi():Plugin {
 const directory=resolve(process.cwd(),'data');mkdirSync(directory,{recursive:true});
 const handler=async (request:IncomingMessage,response:ServerResponse,next:()=>void)=>{
  const url=new URL(request.url ?? '/','http://localhost');if (url.pathname!=='/api/tags') return next();
  response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  const send=(status:number,value:unknown)=>{response.statusCode=status;response.end(JSON.stringify(value));};
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) return send(403,{error:'Local access only.'});
  if (!['GET','POST'].includes(request.method ?? '')) return send(405,{error:'Method not allowed.'});
  if (request.method==='POST' && request.headers.origin && request.headers.origin!==`http://${request.headers.host}`) return send(403,{error:'Use this application to manage tags.'});
  let store:TagsStore | undefined;
  try {
   let body:Record<string,unknown>={};
   if (request.method==='POST') {let size=0;const chunks:Buffer[]=[];for await (const chunk of request) {const buffer=Buffer.from(chunk);size+=buffer.length;if (size>8192) return send(413,{error:'Tags are too large.'});chunks.push(buffer);}try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(400,{error:'Invalid JSON.'});}if (!body || typeof body!=='object' || Array.isArray(body)) return send(400,{error:'Invalid tags.'});}
   const serviceId=request.method==='POST' ? body.serviceId : url.searchParams.get('serviceId');
   if (typeof serviceId!=='string' || !serviceId || serviceId.length>200) return send(400,{error:'Choose a service.'});
   const path=resolve(directory,'services.sqlite');if (!existsSync(path)) return send(503,{error:'Service catalogue is unavailable.'});
   const catalogue=new DatabaseSync(path,{readOnly:true});let exists=false;try {exists=!!catalogue.prepare('SELECT id FROM catalogue_services WHERE id=?').get(serviceId);} finally {catalogue.close();}
   if (!exists) return send(404,{error:'Service not found.'});
   store=new TagsStore(resolve(directory,'tags.sqlite'));
   return send(200,{serviceId,tags:request.method==='POST' ? store.save(serviceId,body.tags) : store.get(serviceId)});
  } catch (error) {if (error instanceof TagsInputError) return send(400,{error:error.message});console.error('Service tags failed:',error);return send(500,{error:'Could not save tags. Please try again.'});} finally {store?.close();}
 };
 return {name:'local-service-tags',configureServer(server) {server.middlewares.use(handler);},configurePreviewServer(server) {server.middlewares.use(handler);}};
}
