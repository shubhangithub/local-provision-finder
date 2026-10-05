import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { SuggestionsStore,SuggestionError } from './suggestions-store.ts';
export function suggestionsApi():Plugin {
 const directory=resolve(process.cwd(),'data');mkdirSync(directory,{recursive:true});
 const handler=async (request:IncomingMessage,response:ServerResponse,next:()=>void)=>{
  const url=new URL(request.url??'/','http://localhost');if (!url.pathname.startsWith('/api/suggestions')) return next();response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');const send=(status:number,data:unknown)=>{response.statusCode=status;response.end(JSON.stringify(data));};
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress??'')) return send(403,{error:'Local access only.'});if (request.method==='POST' && request.headers.origin && request.headers.origin!==`http://${request.headers.host}`) return send(403,{error:'Use this application to suggest a service.'});
  const store=new SuggestionsStore(resolve(directory,'suggestions.sqlite'),resolve(directory,'services.sqlite'));
  try {
   if (request.method==='GET' && url.pathname==='/api/suggestions') return send(200,{entries:store.list()});if (request.method!=='POST') return send(405,{error:'Method not allowed.'});let size=0;const chunks:Buffer[]=[];for await (const chunk of request) {const buffer=Buffer.from(chunk);size+=buffer.length;if (size>32768) return send(413,{error:'Suggestion is too large.'});chunks.push(buffer);}let body;try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(400,{error:'Invalid JSON.'});}if (!body || typeof body!=='object' || Array.isArray(body)) return send(400,{error:'Invalid suggestion.'});
   if (url.pathname==='/api/suggestions') return send(201,{entry:store.submit(body)});if (url.pathname==='/api/suggestions/prepare') return send(200,{entry:store.prepare(String(body.id??''),body.fields)});if (url.pathname==='/api/suggestions/review') return send(200,{entry:store.review(String(body.id??''),body)});return send(404,{error:'Endpoint not found.'});
  } catch(error){if (error instanceof SuggestionError) return send(error.status,{error:error.message});console.error('Suggestion operation failed:',error);return send(500,{error:'Could not save the suggestion. Please try again.'});}finally {store.close();}
 };
 return {name:'local-service-suggestions',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};
}
