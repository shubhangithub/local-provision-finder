import { loadEnv } from 'vite';
export interface GovHackConfig {url:string;token:string}
export class GovHackError extends Error {constructor(message:string,public status:number,public code='gov_hack_error'){super(message);}}
/** Reads the connection settings on each call so a restart is not needed after editing .env. */
export function govHackConfig():GovHackConfig | null {
  const env=loadEnv('development',process.cwd(),'GOV_HACK_');
  const url=(process.env.GOV_HACK_URL||env.GOV_HACK_URL||'').trim().replace(/\/+$/,'');
  const token=(process.env.GOV_HACK_API_TOKEN||env.GOV_HACK_API_TOKEN||'').trim();
  return url && token ? {url,token} : null;
}
export const notConfigured='Web enrichment is not configured. Set GOV_HACK_URL and GOV_HACK_API_TOKEN on the server.';
export interface JobResponse {id:string;status:'queued'|'running'|'completed'|'error';result?:Record<string,any>;error?:{code?:string;message?:string};[key:string]:unknown}
export interface FollowupResponse {id:string;status:string;outcome?:string;result?:{outcome?:string;services?:Record<string,any>[]};decisions?:{check?:string;result?:'allow'|'deny'|'defer'|'needs_approval'|'info';reason?:string}[];error?:string;[key:string]:unknown}
export class GovHackClient {
  constructor(private config:GovHackConfig,private fetcher:typeof fetch=fetch) {}
  private async request<T>(method:string,path:string,body?:unknown):Promise<T> {
    let response:Response;
    try {
      response=await this.fetcher(`${this.config.url}${path}`,{method,headers:{Authorization:`Bearer ${this.config.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    } catch {throw new GovHackError('The enrichment service could not be reached.',502,'unreachable');}
    const data=await response.json().catch(()=>({})) as Record<string,any>;
    if (response.status===401||response.status===403) throw new GovHackError('The enrichment service rejected the access token.',502,'unauthorised');
    if (!response.ok) throw new GovHackError(String(data.message||data.error||`The enrichment service returned ${response.status}.`),response.status===503?503:502,String(data.error||'gov_hack_error'));
    return data as T;
  }
  submitJob(name:string,context:Record<string,unknown>,previous?:unknown) {return this.request<{id:string;status:string}>('POST','/jobs',{name,context,...(previous?{previous}:{})});}
  getJob(id:string) {return this.request<JobResponse>('GET',`/jobs/${encodeURIComponent(id)}`);}
  submitFollowup(body:unknown) {return this.request<{id:string;status:string}>('POST','/followups',body);}
  getFollowup(id:string) {return this.request<FollowupResponse>('GET',`/followups/${encodeURIComponent(id)}`);}
}
export function govHackClient(fetcher?:typeof fetch):GovHackClient | null {const config=govHackConfig();return config ? new GovHackClient(config,fetcher) : null;}
