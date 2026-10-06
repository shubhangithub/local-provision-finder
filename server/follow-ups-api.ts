import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { openApi, readCatalogueRecord, readJson } from './api-util.ts';
import { EnrichmentStore } from './enrichment-store.ts';
import { FeedbackStore } from './feedback-store.ts';
import { reportFromFinding, type CallFinding } from './follow-up-findings.ts';
import { FollowUpError, FollowUpStore, type FollowUp } from './follow-ups-store.ts';
import { GovHackError, govHackClient, notConfigured, type FollowupResponse, type GovHackClient } from './gov-hack.ts';

const terminal=new Set(['resolved','failed','denied','rejected']);
/** Outcomes where nobody confirmed anything, so the number is kept and staff can try again. */
const retryable:Record<string,string>={no_answer:'Nobody answered the call.',ended_early:'The call ended before any answers were given.',dry_run:'This was a dry run, so no call was placed.'};
function refusal(response:FollowupResponse):string {
  if (response.status==='rejected') return 'The follow-up was rejected by an approver.';
  const blocked=[...(response.decisions ?? [])].reverse().find(decision=>decision.result==='deny');
  return blocked?.reason || response.error || 'The follow-up service did not place the call.';
}
export interface Options {directory:string;client:()=>GovHackClient | null}
export function followUpsHandler({directory,client}:Options) {
  /** Ends a follow-up whose call has finished. Reports are made only by the one request that wins the status change. */
  const settle=(follow:FollowUpStore,feedback:FeedbackStore,current:FollowUp,response:FollowupResponse) => {
    if (!terminal.has(response.status)) return;
    if (response.status!=='resolved') {follow.finish(current.feedbackId,response.status==='failed' ? 'failed' : 'denied',{reason:refusal(response)});return;}
    const outcome=response.outcome ?? response.result?.outcome ?? '';
    if (retryable[outcome]) {follow.finish(current.feedbackId,'failed',{outcome,reason:retryable[outcome]});return;}
    const service=readCatalogueRecord(directory,current.serviceId) ?? {id:current.serviceId,name:current.serviceName};
    const drafts=['answered','partly_answered'].includes(outcome) ? (response.result?.services ?? []).flatMap(finding=>{const draft=reportFromFinding(finding as CallFinding,current.serviceName);return draft ? [draft] : [];}) : [];
    if (!follow.finish(current.feedbackId,'completed',{outcome})) return;
    const ids=drafts.map(draft=>feedback.submit(service as {id:string;name:string},draft,draft.proposal ? {...draft.proposal,previous:String((service as Record<string,unknown>)[draft.proposal.field] ?? ''),source:'follow-up'} : undefined).id);
    follow.setReports(current.feedbackId,ids);
  };
  return async (request:IncomingMessage,response:ServerResponse,next:()=>void) => {
    const path=new URL(request.url ?? '/','http://localhost').pathname;if (path!=='/api/follow-ups') return next();
    const api=openApi(request,response,{staffOnly:true});if (!api) return;const {send,url}=api;
    mkdirSync(directory,{recursive:true});
    const follow=new FollowUpStore(resolve(directory,'follow-ups.sqlite'));const feedback=new FeedbackStore(resolve(directory,'feedback.sqlite'));const enrichment=new EnrichmentStore(resolve(directory,'enrichment.sqlite'));
    try {
      const gov=client();
      if (request.method==='GET') {
        const id=url.searchParams.get('feedbackId');
        if (!id) return send(200,{configured:!!gov,sandbox:true,followUps:follow.list()});
        let current=follow.get(id);if (!current) return send(404,{error:'No follow-up for this report.'});
        if (gov && current.status==='requested' && current.followupId) {
          try {settle(follow,feedback,current,await gov.getFollowup(current.followupId));current=follow.get(id)!;} catch (error) {
            if (!(error instanceof GovHackError)) throw error;
            // The service no longer knows this request (for example it was restarted), so staff can place it again.
            if (error.code==='followup_not_found') {follow.release(id,'The follow-up service no longer has this request. Try again.');current=follow.get(id)!;}
          }
        }
        return send(200,{configured:!!gov,sandbox:true,followUp:current});
      }
      if (request.method!=='POST') return send(405,{error:'Method not allowed.'});
      const body=await readJson(request,4096);
      if (body==='too_large') return send(413,{error:'Request is too large.'});if (body==='invalid') return send(400,{error:'Invalid request.'});
      if (!gov) return send(503,{error:notConfigured.replace('Web enrichment','Follow-up calls')});
      const feedbackId=typeof body.feedbackId==='string' ? body.feedbackId : '';
      if (!feedback.get(feedbackId)) return send(404,{error:'Report not found.'});
      const {phone,followUp}=follow.begin(feedbackId);
      try {
        const jobId=enrichment.latestSuccess(followUp.serviceId)?.jobId;
        const accepted=await gov.submitFollowup({person:{phone},consent:{attested:true},services:[{name:followUp.serviceName,...(jobId ? {job_id:jobId} : {})}],reference:feedbackId});
        follow.attach(feedbackId,accepted.id);
      } catch (error) {
        follow.release(feedbackId,error instanceof GovHackError ? error.message : 'The follow-up could not be requested.');
        throw error;
      }
      return send(202,{sandbox:true,followUp:follow.get(feedbackId)});
    } catch (error) {
      if (error instanceof FollowUpError) return send(error.status,{error:error.message});
      if (error instanceof GovHackError) return send(error.status,{error:error.message,code:error.code});
      console.error('Follow-up failed:',error);return send(500,{error:'Could not complete this follow-up request.'});
    } finally {follow.close();feedback.close();enrichment.close();}
  };
}
export function followUpsApi():Plugin {
  const handler=followUpsHandler({directory:resolve(process.cwd(),'data'),client:()=>govHackClient()});
  return {name:'local-follow-ups',configureServer(server) {server.middlewares.use(handler);},configurePreviewServer(server) {server.middlewares.use(handler);}};
}
