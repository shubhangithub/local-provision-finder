import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { assist, agentConfig, validateAssistantRequest, AssistantInputError } from './assistant.ts';
import { SearchInputError } from './directory-search.ts';
export function assistantApi():Plugin{
 let active=0;let recent:number[]=[];
 const handler=async(request:IncomingMessage,response:ServerResponse,next:()=>void)=>{
  const url=new URL(request.url??'/','http://localhost');if(!url.pathname.startsWith('/api/assistant'))return next();
  response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  const send=(status:number,data:unknown)=>{if(!response.writableEnded){response.statusCode=status;response.end(JSON.stringify(data));}};
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress??''))return send(403,{error:'Local access only.'});
  let host:URL;try{host=new URL(`http://${request.headers.host}`);}catch{return send(403,{error:'Use the local application.'});}
  if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname)||request.headers.origin&&request.headers.origin!==host.origin||request.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Use the local application.'});
  if(request.method==='GET'&&url.pathname==='/api/assistant/status'){const config=agentConfig();return send(200,{configured:!!config.apiKey,model:config.model});}
  if(url.pathname!=='/api/assistant')return send(404,{error:'Endpoint not found.'});if(request.method!=='POST')return send(405,{error:'Method not allowed.'});
  let size=0;const chunks:Buffer[]=[];for await(const chunk of request){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>32768)return send(413,{error:'Request is too large.'});chunks.push(buffer);}
  let input;try{input=validateAssistantRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){return send(400,{error:error instanceof AssistantInputError?error.message:'Invalid request.'});}
  if(['suggestion','feedback','meeting','tags'].includes(input.task)&&request.headers['x-staff-demo']!=='true')return send(403,{error:'Enter the staff workspace to use this assistance.'});
  recent=recent.filter(time=>Date.now()-time<60000);if(active>=2||recent.length>=30)return send(429,{error:'Assistance is busy. Please try again shortly.'});recent.push(Date.now());active++;
  const controller=new AbortController();const disconnected=()=>{if(!response.writableEnded)controller.abort();};response.on('close',disconnected);
  try{return send(200,await assist(input,{signal:controller.signal}));}catch(error){if(controller.signal.aborted)return;if(error instanceof AssistantInputError)return send(error.status,{error:error.message});if(error instanceof SearchInputError)return send(400,{error:error.message});return send(500,{error:'Assistance is unavailable. Please try again.'});}finally{active--;response.off('close',disconnected);}
 };
 return{name:'local-directory-assistant',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};
}
