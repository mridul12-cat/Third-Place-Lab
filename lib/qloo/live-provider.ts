import 'server-only';
import { z } from 'zod';
import { ProviderError, type CulturalIntelligenceProvider } from './provider';
import type { CulturalInsight, EntityType, ResolvedQlooEntity } from '../../types/lab';
import { abortable, BodyTooLargeError, readBoundedJson } from './http-utils';
const supported=['artist','book','brand','movie','place','destination','tv_show'] as const;
const entitySchema=z.object({
 entity_id:z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/),name:z.string().trim().min(1).max(300),
 types:z.array(z.string()).max(20).optional(),type:z.string().optional(),subtype:z.string().optional(),
 query:z.object({affinity:z.number().finite().optional(),explainability:z.unknown().optional()}).optional(),
});
const searchSchema=z.object({success:z.literal(true).optional(),results:z.array(entitySchema).max(100)});
const insightsSchema=z.object({success:z.literal(true).optional(),results:z.object({entities:z.array(entitySchema).max(100)}),query:z.object({explainability:z.unknown().optional()}).optional()});
export function normalizeEntity(raw:unknown,expected?:EntityType):ResolvedQlooEntity {
 const e=entitySchema.parse(raw);
 // `type: urn:entity` is a generic class; the category is normally in subtype.
 const categories=Array.from(new Set([e.subtype,...(e.types??[]),e.type].filter((s):s is string=>Boolean(s)&&s!=='urn:entity').map(s=>s.replace(/^urn:entity:/,''))));
 if(categories.length!==1||!supported.includes(categories[0] as EntityType))throw new ProviderError('Qloo returned an unsupported or ambiguous entity category.');
 const type=categories[0] as EntityType;
 if(expected&&type!==expected)throw new ProviderError('Qloo returned an entity outside the requested category.');
 return {id:e.entity_id,name:e.name,type,source:'qloo'};
}
export interface LiveConfig {key:string; baseUrl:string; timeout?:number; fetcher?:typeof fetch; sleep?:(ms:number,signal?:AbortSignal)=>Promise<void>; beforeRequest?:(signal?:AbortSignal)=>Promise<void>}
export class LiveQlooProvider implements CulturalIntelligenceProvider {
 readonly mode='live' as const;
 private fetcher:typeof fetch;
 private requestCount=0;
 constructor(private config:LiveConfig) {
  if(!config.key?.trim()||/[\r\n]/.test(config.key))throw new ProviderError('Live Qloo mode needs a valid server-side API key.',503);
  let u:URL;try{u=new URL(config.baseUrl);}catch{throw new ProviderError('Invalid Qloo base URL configuration.',503);}
  if(u.protocol!=='https:')throw new ProviderError('Qloo base URL must use HTTPS.',503);
  if(!['hackathon.api.qloo.com','api.qloo.com'].includes(u.hostname)||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw new ProviderError('Qloo base URL must be an approved Qloo origin without a path or credentials.',503);
  this.fetcher=config.fetcher??fetch;
 }
 private async pause(ms:number,signal?:AbortSignal){
  if(this.config.sleep){await abortable(this.config.sleep(ms,signal),signal);return;}
  await new Promise<void>((resolve,reject)=>{signal?.throwIfAborted();const onAbort=()=>{clearTimeout(timer);reject(signal?.reason);};const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);signal?.addEventListener('abort',onAbort,{once:true});});
 }
 private async request(path:'/search'|'/v2/insights',params:Record<string,string>,externalSignal?:AbortSignal):Promise<unknown> {
  const url=new URL(path,this.config.baseUrl);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  for(let attempt=0;attempt<3;attempt++){
   externalSignal?.throwIfAborted();
   if(++this.requestCount>12)throw new ProviderError('This plan reached its 12-request research limit. Try fewer interests or retry later.',429);
   await this.config.beforeRequest?.(externalSignal);
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(new DOMException('Timeout','TimeoutError')),this.config.timeout??8000);
   const signal=externalSignal?AbortSignal.any([controller.signal,externalSignal]):controller.signal;
   try {
    const response=await abortable(this.fetcher(url,{method:'GET',headers:{'X-Api-Key':this.config.key,Accept:'application/json'},redirect:'error',signal}),signal);
    if(response.ok){try{return await readBoundedJson(response.body,512*1024,signal);}catch(error){if(signal.aborted)throw error;if(error instanceof BodyTooLargeError)throw new ProviderError('Qloo response exceeded the safe size limit.');throw new ProviderError('Qloo returned invalid JSON.');}}
    void response.body?.cancel().catch(()=>{});
    if(response.status===404&&path==='/search')return {results:[]};
    if(response.status===401)throw new ProviderError('Qloo authentication failed. Check the server API key.',502);
    if(response.status===403)throw new ProviderError('Qloo denied this category or API access.',502);
    if((response.status===429||response.status>=500)&&attempt<2){
     clearTimeout(timeout);const retryAfter=response.headers.get('retry-after');const seconds=retryAfter===null?NaN:Number(retryAfter);const date=retryAfter?Date.parse(retryAfter):NaN;
     const delay=Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-Date.now():250*2**attempt;
     await this.pause(Math.max(250,Math.min(2500,delay)),externalSignal);continue;
    }
    throw new ProviderError(response.status===429?'Qloo rate limit reached. Please retry shortly.':`Qloo request failed (${response.status}).`,response.status===429?429:502);
   }catch(error){
    if(externalSignal?.aborted)throw externalSignal.reason;
    if(error instanceof ProviderError)throw error;
    if(attempt===2)throw new ProviderError(controller.signal.aborted?'Qloo request timed out. Please retry.':'Could not reach Qloo. Please retry.');
    clearTimeout(timeout);await this.pause(250*2**attempt,externalSignal);
   }finally{clearTimeout(timeout);}
  }
  throw new ProviderError('Qloo request failed.');
 }
 async lookup(name:string,signal?:AbortSignal):Promise<ResolvedQlooEntity[]> {
  const query=z.string().trim().min(1).max(100).safeParse(name);if(!query.success)throw new ProviderError('Invalid cultural interest.',400);
  const parsed=searchSchema.safeParse(await this.request('/search',{query:query.data,take:'5'},signal));
  if(!parsed.success)throw new ProviderError('Qloo search response did not match the documented contract.');
  return parsed.data.results.slice(0,5).flatMap(e=>{try{return [normalizeEntity(e)];}catch{return [];}});
 }
 async discover(seeds:ResolvedQlooEntity[],type:EntityType,signal?:AbortSignal):Promise<CulturalInsight[]> {
  if(!supported.includes(type))throw new ProviderError('Unsupported Qloo category.',400);
  if(!seeds.length)return [];
  if(seeds.length>6||seeds.some(s=>s.source!=='qloo'||!entitySchema.shape.entity_id.safeParse(s.id).success))throw new ProviderError('Invalid live Qloo research signals.',400);
  const ids=Array.from(new Set(seeds.map(s=>s.id)));
  const parsed=insightsSchema.safeParse(await this.request('/v2/insights',{'filter.type':`urn:entity:${type}`,'signal.interests.entities':ids.join(','),'feature.explainability':'true',take:'4'},signal));
  if(!parsed.success)throw new ProviderError('Qloo Insights response did not match the documented contract.');
  return parsed.data.results.entities.slice(0,4).map(e=>({...normalizeEntity(e,type),signals:ids,...(e.query?.affinity!==undefined?{score:e.query.affinity}:{}),...(e.query?.explainability!==undefined?{explainability:e.query.explainability}:{}),metadata:{queryExplainability:parsed.data.query?.explainability??null}}));
 }
}
