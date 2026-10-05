import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { FeedbackInputError, FeedbackStore, type FeedbackService } from './feedback-store.ts';
export function feedbackApi():Plugin {
  const directory=resolve(process.cwd(),'data');mkdirSync(directory,{recursive:true});
  const handler=async (request:IncomingMessage,response:ServerResponse,next:()=>void) => {
    const url=new URL(request.url ?? '/','http://localhost');if (!url.pathname.startsWith('/api/feedback')) return next();
    response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');
    const send=(status:number,data:unknown) => {response.statusCode=status;response.end(JSON.stringify(data));};
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) return send(403,{error:'Local access only.'});
    if (request.headers.origin && request.headers.origin!==`http://${request.headers.host}`) return send(403,{error:'Use the local application to submit feedback.'});
    const store=new FeedbackStore(resolve(directory,'feedback.sqlite'));
    try {
      if (request.method==='GET' && url.pathname==='/api/feedback') return send(200,{entries:store.list()});
      if (request.method!=='POST') return send(405,{error:'Method not allowed.'});
      let size=0;const chunks:Buffer[]=[];
      for await (const chunk of request) {const buffer=Buffer.from(chunk);size+=buffer.length;if (size>16384) return send(413,{error:'Feedback is too large.'});chunks.push(buffer);}
      let body;try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(400,{error:'Invalid JSON.'});}
      if (!body || typeof body!=='object' || Array.isArray(body)) return send(400,{error:'Invalid feedback.'});
      const entry=url.pathname==='/api/feedback/review' ? store.get(String(body.id)) : null;
      const serviceId=entry?.serviceId ?? String(body.serviceId ?? '');
      if (!existsSync(resolve(directory,'services.sqlite'))) return send(503,{error:'Service catalogue is unavailable.'});
      const source=new DatabaseSync(resolve(directory,'services.sqlite'),{readOnly:true});
      let service:FeedbackService | undefined;
      try {const row=source.prepare('SELECT record_json FROM catalogue_services WHERE id=?').get(serviceId);if (row) service=store.corrected(JSON.parse(String(row.record_json)));} finally {source.close();}
      if (!service) return send(404,{error:'Service not found.'});
      if (url.pathname==='/api/feedback') return send(201,{entry:store.submit(service,body)});
      if (url.pathname==='/api/feedback/review') return send(200,{entry:store.review(String(body.id),service,body)});
      return send(404,{error:'Endpoint not found.'});
    } catch (error) {
      if (error instanceof FeedbackInputError) return send(error.status,{error:error.message});
      console.error('Feedback operation failed:',error);return send(500,{error:'Could not save this feedback. Please try again.'});
    } finally {store.close();}
  };
  return {name:'local-service-feedback',configureServer(server) {server.middlewares.use(handler);},configurePreviewServer(server) {server.middlewares.use(handler);}};
}
