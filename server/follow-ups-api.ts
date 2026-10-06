import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { openApi, readCatalogueRecord, readJson } from './api-util.ts';
import { EnrichmentStore } from './enrichment-store.ts';
import { FeedbackStore } from './feedback-store.ts';
import { summariseFinding, type Summariser } from './finding-summary.ts';
import { reportFromFinding, withSummary, type CallFinding } from './follow-up-findings.ts';
import { FollowUpError, FollowUpStore, maxServices, normaliseName, normalisePhone, type FollowUp } from './follow-ups-store.ts';
import { GovHackError, govHackClient, notConfigured, type FollowupResponse, type GovHackClient } from './gov-hack.ts';

const terminal=new Set(['resolved','failed','denied','rejected']);
/** Outcomes where nobody confirmed anything, so the number is kept and staff can try again. */
const retryable:Record<string,string>={no_answer:'Nobody answered the call.',ended_early:'The call ended before any answers were given.',dry_run:'This was a dry run, so no call was placed.'};
function refusal(response:FollowupResponse):string {
  if (response.status==='rejected') return 'The follow-up was rejected by an approver.';
  const blocked=[...(response.decisions ?? [])].reverse().find(decision=>decision.result==='deny');
  return blocked?.reason || response.error || 'The follow-up service did not place the call.';
}
export interface Options {directory:string;client:()=>GovHackClient | null;summarise?:Summariser}
export function followUpsHandler({directory,client,summarise=summariseFinding}:Options) {
  /** Ends a follow-up whose call has finished. Reports are made only by the one request that wins the status change. */
  const settle=async (follow:FollowUpStore,feedback:FeedbackStore,current:FollowUp,response:FollowupResponse) => {
    if (!terminal.has(response.status)) return;
    if (response.status!=='resolved') {follow.finish(current.id,response.status==='failed' ? 'failed' : 'denied',{reason:refusal(response)});return;}
    const outcome=response.outcome ?? response.result?.outcome ?? '';
    if (retryable[outcome]) {follow.finish(current.id,'failed',{outcome,reason:retryable[outcome]});return;}
    // One finding per service the call asked about, matched back to the stored services by name.
    const byName=new Map(current.services.map(service => [service.name.toLowerCase(),service]));
    const drafts=['answered','partly_answered'].includes(outcome) ? await Promise.all((response.result?.services ?? []).map(async finding => {
      const stored=byName.get(String((finding as CallFinding).name ?? '').toLowerCase());if (!stored) return [];
      const found=reportFromFinding(finding as CallFinding,stored.name);const service=readCatalogueRecord(directory,stored.id);
      // The rewrite happens before the call is marked complete, so a poll never sees a finished call with no reports yet.
      const draft=found ? await withSummary(found,stored.name,summarise) : null;
      return draft && service ? [{draft,service}] : [];
    })).then(list => list.flat()) : [];
    if (!follow.finish(current.id,'completed',{outcome})) return;
    const ids=drafts.map(({draft,service}) => feedback.submit(service as {id:string;name:string},draft,draft.proposal ? {...draft.proposal,previous:String(service[draft.proposal.field] ?? ''),source:'follow-up'} : undefined).id);
    follow.setReports(current.id,ids);
  };
  /** Asks the follow-up service how a placed call is going and records the result if it has ended. */
  const check=async (follow:FollowUpStore,feedback:FeedbackStore,current:FollowUp,gov:GovHackClient):Promise<FollowUp> => {
    if (current.status!=='requested' || !current.followupId) return current;
    try {await settle(follow,feedback,current,await gov.getFollowup(current.followupId));} catch (error) {
      if (!(error instanceof GovHackError)) throw error;
      // The service no longer knows this request (for example it was restarted), so staff can place it again.
      if (error.code==='followup_not_found') follow.release(current.id,'The follow-up service no longer has this request. Try again.');
    }
    return follow.get(current.id)!;
  };
  /** Records the result of every placed call that has ended, whether or not anyone has the Follow-ups page open. */
  const sweep=async () => {
    const gov=client();if (!gov || !existsSync(resolve(directory,'follow-ups.sqlite'))) return;
    const follow=new FollowUpStore(resolve(directory,'follow-ups.sqlite'));const feedback=new FeedbackStore(resolve(directory,'feedback.sqlite'));
    try {for (const item of follow.list().filter(entry => entry.status==='requested')) await check(follow,feedback,item,gov).catch(() => undefined);} finally {follow.close();feedback.close();}
  };
  const handler=async (request:IncomingMessage,response:ServerResponse,next:()=>void) => {
    const path=new URL(request.url ?? '/','http://localhost').pathname;if (path!=='/api/follow-ups' && path!=='/api/follow-ups/call') return next();
    const api=openApi(request,response,{staffOnly:true});if (!api) return;const {send,url}=api;
    mkdirSync(directory,{recursive:true});
    const follow=new FollowUpStore(resolve(directory,'follow-ups.sqlite'));const feedback=new FeedbackStore(resolve(directory,'feedback.sqlite'));const enrichment=new EnrichmentStore(resolve(directory,'enrichment.sqlite'));
    try {
      const gov=client();
      if (request.method==='GET' && path==='/api/follow-ups') {
        const id=url.searchParams.get('id');
        if (!id) return send(200,{configured:!!gov,sandbox:true,followUps:follow.list()});
        let current=follow.get(id);if (!current) return send(404,{error:'Follow-up not found.'});
        if (gov) current=await check(follow,feedback,current,gov);
        return send(200,{configured:!!gov,sandbox:true,followUp:current});
      }
      if (request.method!=='POST') return send(405,{error:'Method not allowed.'});
      const body=await readJson(request,4096);
      if (body==='too_large') return send(413,{error:'Request is too large.'});if (body==='invalid') return send(400,{error:'Invalid request.'});
      if (path==='/api/follow-ups') {
        // Staff attest that the customer agreed; without that tick nothing is stored.
        if (body.agreed!==true) throw new FollowUpError('Confirm that the customer agreed to a follow-up call.');
        const phone=normalisePhone(body.phone);const personName=normaliseName(body.firstName);
        const ids=Array.isArray(body.services) ? [...new Set(body.services.map(item => typeof item==='object' && item ? String((item as {id?:unknown}).id ?? '') : ''))].filter(Boolean) : [];
        if (!ids.length) throw new FollowUpError('Choose at least one service to follow up on.');
        if (ids.length>maxServices) throw new FollowUpError(`Follow up on at most ${maxServices} services.`);
        const services=ids.map(id => {const record=readCatalogueRecord(directory,id);if (!record) throw new FollowUpError('One of the services was not found.',404);return {id,name:String(record.name)};});
        return send(201,{sandbox:true,followUp:follow.create({personName,phone,services})});
      }
      if (!gov) return send(503,{error:notConfigured.replace('Web enrichment','Follow-up calls')});
      const id=typeof body.id==='string' ? body.id : '';
      const {phone,followUp}=follow.begin(id);
      try {
        const services=followUp.services.map(service => {const jobId=enrichment.latestSuccess(service.id)?.jobId;return {name:service.name,...(jobId ? {job_id:jobId} : {})};});
        const accepted=await gov.submitFollowup({person:{phone,...(followUp.personName ? {first_name:followUp.personName} : {})},consent:{attested:true},services,reference:id});
        follow.attach(id,accepted.id);
      } catch (error) {
        follow.release(id,error instanceof GovHackError ? error.message : 'The follow-up could not be requested.');
        throw error;
      }
      return send(202,{sandbox:true,followUp:follow.get(id)});
    } catch (error) {
      if (error instanceof FollowUpError) return send(error.status,{error:error.message});
      if (error instanceof GovHackError) return send(error.status,{error:error.message,code:error.code});
      console.error('Follow-up failed:',error);return send(500,{error:'Could not complete this follow-up request.'});
    } finally {follow.close();feedback.close();enrichment.close();}
  };
  return Object.assign(handler,{sweep});
}
const sweepEvery=10000;
export function followUpsApi():Plugin {
  const handler=followUpsHandler({directory:resolve(process.cwd(),'data'),client:()=>govHackClient()});
  const start=(server:{middlewares:{use:(fn:typeof handler)=>void};httpServer:{on:(event:'close',fn:()=>void)=>unknown} | null}) => {
    server.middlewares.use(handler);
    // Results are recorded on a timer so a call settles even when nobody is looking at the Follow-ups page.
    let running=false;
    const timer=setInterval(() => {if (running) return;running=true;void handler.sweep().finally(() => {running=false;});},sweepEvery);
    timer.unref();server.httpServer?.on('close',() => clearInterval(timer));
  };
  return {name:'local-follow-ups',configureServer(server) {start(server);},configurePreviewServer(server) {start(server);}};
}
