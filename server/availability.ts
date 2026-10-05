import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Plugin} from 'vite';
import type {IncomingMessage,ServerResponse} from 'node:http';
export interface Confirmation {id:string;serviceId:string;status:'Open'|'Waiting list'|'Closed';confirmedAt:string;recordedAt:string;staffName:string;method:string;note:string}
export class AvailabilityInputError extends Error {}
export class AvailabilityStore {
 private db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS availability_confirmations(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,confirmed_at TEXT NOT NULL,entry_json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS availability_service ON availability_confirmations(service_id,confirmed_at);');}
 close(){this.db.close();}
 history(serviceId:string):Confirmation[]{return this.db.prepare('SELECT entry_json FROM availability_confirmations WHERE service_id=? ORDER BY confirmed_at DESC,rowid DESC').all(serviceId).map(row=>JSON.parse(String(row.entry_json)));}
 latest(){const values=new Map<string,Confirmation>();for(const row of this.db.prepare('SELECT entry_json FROM availability_confirmations ORDER BY confirmed_at DESC,rowid DESC').all()){const entry=JSON.parse(String(row.entry_json)) as Confirmation;if(!values.has(entry.serviceId))values.set(entry.serviceId,entry);}return values;}
 save(serviceId:string,input:Record<string,unknown>,now=new Date()){
  if(!['Open','Waiting list','Closed'].includes(String(input.status)))throw new AvailabilityInputError('Choose the confirmed availability.');
  for(const [key,max] of [['staffName',200],['note',2000]] as const)if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)throw new AvailabilityInputError('Enter your name and how you confirmed availability.');
  if(!['phone','email','provider website','in person'].includes(String(input.method)))throw new AvailabilityInputError('Choose how availability was confirmed.');
  if(typeof input.confirmedAt!=='string'||!Number.isFinite(Date.parse(input.confirmedAt))||Date.parse(input.confirmedAt)>now.getTime())throw new AvailabilityInputError('Enter a confirmation date and time in the past or present.');
  const entry:Confirmation={id:randomUUID(),serviceId,status:input.status as Confirmation['status'],confirmedAt:new Date(input.confirmedAt).toISOString(),recordedAt:now.toISOString(),staffName:(input.staffName as string).trim(),method:String(input.method),note:(input.note as string).trim()};
  this.db.prepare('INSERT INTO availability_confirmations VALUES(?,?,?,?)').run(entry.id,serviceId,entry.confirmedAt,JSON.stringify(entry));return entry;
 }
}
export function availabilityOverlay<T extends {id:string;availability?:unknown;fieldCheckedAt?:Record<string,string>}>(record:T,confirmations:Map<string,Confirmation>):T&{availabilityConfirmation?:{status:Confirmation['status'];confirmedAt:string}}{
 const entry=confirmations.get(record.id);if(!entry)return record;const newerCorrection=Date.parse(record.fieldCheckedAt?.availability??'')>Date.parse(entry.confirmedAt);
 return {...record,...(!newerCorrection?{availability:entry.status}:{}),availabilityConfirmation:{status:entry.status,confirmedAt:entry.confirmedAt}};
}
export function readAvailability(directory:string){const path=resolve(directory,'availability.sqlite');if(!existsSync(path))return new Map<string,Confirmation>();const store=new AvailabilityStore(path);try{return store.latest();}finally{store.close();}}
export function availabilityApi():Plugin{
 const directory=resolve(process.cwd(),'data');mkdirSync(directory,{recursive:true});
 const handler=async(request:IncomingMessage,response:ServerResponse,next:()=>void)=>{
  const url=new URL(request.url??'/','http://localhost');if(url.pathname!=='/api/availability')return next();response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');const send=(status:number,data:unknown)=>{response.statusCode=status;response.end(JSON.stringify(data));};
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress??''))return send(403,{error:'Local access only.'});
  if(!['GET','POST'].includes(request.method??''))return send(405,{error:'Method not allowed.'});
  if(request.headers.origin&&request.headers.origin!==`http://${request.headers.host}`||request.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Use the local application.'});
  if(request.method==='POST'&&request.headers['x-staff-demo']!=='true')return send(403,{error:'Enter the staff workspace.'});
  let store:AvailabilityStore|undefined;
  try{let input:Record<string,unknown>={};if(request.method==='POST'){let size=0;const chunks:Buffer[]=[];for await(const chunk of request){const part=Buffer.from(chunk);size+=part.length;if(size>8192)return send(413,{error:'Confirmation is too large.'});chunks.push(part);}try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'Invalid confirmation.'});}if(!input||typeof input!=='object'||Array.isArray(input))return send(400,{error:'Invalid confirmation.'});}
   const id=request.method==='POST'?input.serviceId:url.searchParams.get('serviceId');if(typeof id!=='string'||!id||id.length>200)return send(400,{error:'Choose a service.'});
   const catalogue=new DatabaseSync(resolve(directory,'services.sqlite'),{readOnly:true});let found=false;try{found=!!catalogue.prepare('SELECT id FROM catalogue_services WHERE id=?').get(id);}finally{catalogue.close();}if(!found)return send(404,{error:'Service not found.'});
   store=new AvailabilityStore(resolve(directory,'availability.sqlite'));if(request.method==='POST')store.save(id,input);const history=store.history(id);return send(200,{latest:history[0]?{status:history[0].status,confirmedAt:history[0].confirmedAt}:null,...(request.headers['x-staff-demo']==='true'?{history}:{})});
  }catch(error){return send(error instanceof AvailabilityInputError?400:500,{error:error instanceof AvailabilityInputError?error.message:'Could not save availability. Please try again.'});}finally{store?.close();}
 };
 return {name:'availability-confirmations',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};
}
