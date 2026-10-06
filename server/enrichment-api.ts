import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { openApi, readCatalogueRecord, readJson } from './api-util.ts';
import { EnrichmentError, EnrichmentStore, factRows, type Run } from './enrichment-store.ts';
import { GovHackError, govHackClient, notConfigured, type GovHackClient } from './gov-hack.ts';

const text=(value:unknown,max:number)=>typeof value==='string' ? value.trim().slice(0,max) : '';
export function enrichmentContext(record:Record<string,any>,extra:{url?:string;notes?:string}):Record<string,unknown> {
  const context:Record<string,unknown>={provider:record.provider,postcode:record.postcode,address:record.address,url:extra.url||record.url,description:String(record.description ?? '').slice(0,500)};
  if (extra.notes) context.notes=extra.notes;
  return Object.fromEntries(Object.entries(context).filter(([,value])=>value));
}
function publicRun(run:Run | null) {return run ? {id:run.id,status:run.status,outcome:run.outcome,error:run.error,startedAt:run.startedAt,finishedAt:run.finishedAt} : null;}
export function detail(store:EnrichmentStore,serviceId:string,configured:boolean) {
  const data=store.data(serviceId);const result=data?.latest.status==='completed' ? data.latest.result : null;
  return {
    configured,run:publicRun(data?.latest ?? null),overwrites:data?.overwrites ?? [],facts:factRows(data?.success?.result),
    gaps:Array.isArray(result?.gaps) ? result!.gaps : [],candidates:Array.isArray(result?.candidates) ? result!.candidates : [],notes:typeof result?.notes==='string' ? result.notes : '',
    unavailableSources:Array.isArray(result?.unavailable_sources) ? result!.unavailable_sources : [],
  };
}
interface Options {directory:string;client:()=>GovHackClient | null}
export function enrichmentHandler({directory,client}:Options) {
  const catalogueRecord=(id:string)=>readCatalogueRecord(directory,id);
  return async (request:IncomingMessage,response:ServerResponse,next:()=>void) => {
    const path=new URL(request.url ?? '/','http://localhost').pathname;if (!path.startsWith('/api/enrichment')) return next();
    const api=openApi(request,response,{staffOnly:true});if (!api) return;const {send,url}=api;
    mkdirSync(directory,{recursive:true});const store=new EnrichmentStore(resolve(directory,'enrichment.sqlite'));
    try {
      const gov=client();
      if (request.method==='GET' && path==='/api/enrichment/recent') return send(200,{configured:!!gov,overwrites:store.recent()});
      if (request.method==='GET' && path==='/api/enrichment') {
        const serviceId=url.searchParams.get('serviceId') ?? '';const record=serviceId.length<=200 ? catalogueRecord(serviceId) : null;
        if (!record) return send(404,{error:'Service not found.'});
        const latest=store.latestRun(serviceId);
        // The browser polls this route; the first poll after the job finishes stores the result.
        if (gov && latest?.status==='running') {
          try {store.complete(latest.id,await gov.getJob(latest.jobId),record);} catch (error) {
            if (!(error instanceof GovHackError)) throw error;
            // The service no longer knows this job (for example it was restarted), so staff can start it again.
            if (error.code==='job_not_found') store.complete(latest.id,{id:latest.jobId,status:'error',error:{message:'The enrichment service lost this job. Try again.'}},record);
          }
        }
        return send(200,detail(store,serviceId,!!gov));
      }
      if (request.method!=='POST') return send(405,{error:'Method not allowed.'});
      const body=await readJson(request,8192);
      if (body==='too_large') return send(413,{error:'Request is too large.'});if (body==='invalid') return send(400,{error:'Invalid request.'});
      if (path==='/api/enrichment/revert') {
        const overwrite=store.revert(text(body.id,100),typeof body.serviceId==='string' ? body.serviceId : undefined);
        return send(200,{overwrite});
      }
      if (path!=='/api/enrichment') return send(404,{error:'Endpoint not found.'});
      if (!gov) return send(503,{error:notConfigured});
      const serviceId=text(body.serviceId,200);const record=serviceId ? catalogueRecord(serviceId) : null;
      if (!record) return send(404,{error:'Service not found.'});
      const website=text(body.url,500);
      if (website && !/^https?:\/\/[^\s]+$/i.test(website)) return send(400,{error:'Enter a website address beginning with https://.'});
      const context=enrichmentContext(record,{url:website,notes:text(body.notes,1000)});
      const previous=store.latestSuccess(serviceId)?.result ?? undefined;
      store.assertIdle(serviceId);
      const job=await gov.submitJob(String(record.name),context,previous);
      const run=store.startRun({id:serviceId,name:String(record.name)},job.id,context);
      return send(202,{...detail(store,serviceId,true),run:{id:run.id,status:run.status,outcome:null,error:null,startedAt:run.startedAt,finishedAt:null}});
    } catch (error) {
      if (error instanceof EnrichmentError) return send(error.status,{error:error.message});
      if (error instanceof GovHackError) return send(error.status,{error:error.message,code:error.code});
      console.error('Enrichment failed:',error);return send(500,{error:'Could not complete this enrichment request.'});
    } finally {store.close();}
  };
}
export function enrichmentApi():Plugin {
  const handler=enrichmentHandler({directory:resolve(process.cwd(),'data'),client:()=>govHackClient()});
  return {name:'local-service-enrichment',configureServer(server) {server.middlewares.use(handler);},configurePreviewServer(server) {server.middlewares.use(handler);}};
}
