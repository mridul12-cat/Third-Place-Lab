import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const origin='https://hackathon.api.qloo.com';
const supported=new Set(['artist','book','brand','movie','place','destination','tv_show']);
function category(entity){const subtype=entity.subtype??entity.types?.find(t=>t.startsWith('urn:entity:'))??entity.type;const type=typeof subtype==='string'?subtype.replace(/^urn:entity:/,''):'';return supported.has(type)?type:null;}
export async function runSmoke({allowLive=false,key=process.env.QLOO_API_KEY,query='Norah Jones',fetcher=fetch,timeout=8000}={}) {
 if(!allowLive)return {status:'DRY RUN — no network calls',calls:0,origin,endpoints:['GET /search?query=<name>&take=5','GET /v2/insights?filter.type=urn:entity:book&signal.interests.entities=<resolved-id>&feature.explainability=true&take=1']};
 if(!key?.trim()||/[\r\n]/.test(key))throw new Error('A server-side QLOO_API_KEY is required. No request was made.');
 if(typeof query!=='string'||!query.trim()||query.length>100)throw new Error('Use one exact cultural name of 1–100 characters.');
 let calls=0;
 async function request(path,params){
  const url=new URL(path,origin);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   calls++;let response;try{response=await fetcher(url,{method:'GET',headers:{'X-Api-Key':key,Accept:'application/json'},redirect:'error',signal:controller.signal});}catch{throw new Error('Qloo smoke request timed out or could not connect. No retries performed.');}
   if(!response.ok){void response.body?.cancel().catch(()=>{});throw new Error(`Qloo smoke request returned HTTP ${response.status}. No retries performed.`);}
   if(!response.body)throw new Error('Qloo smoke response had no body.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024)throw new Error('Qloo smoke response exceeded the size limit.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();try{return JSON.parse(text);}catch{throw new Error('Qloo smoke response was not JSON.');}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
  }finally{clearTimeout(timer);}
 }
 const search=await request('/search',{query:query.trim(),take:'5'});
 if(search.success===false||!Array.isArray(search.results))throw new Error('Search response contract needs review.');
 const matches=search.results.filter(e=>typeof e.name==='string'&&e.name.trim().toLowerCase()===query.trim().toLowerCase()&&category(e));
 if(matches.length!==1||typeof matches[0].entity_id!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(matches[0].entity_id))throw new Error('No unique supported exact entity match. Stop and review the query.');
 const insights=await request('/v2/insights',{'filter.type':'urn:entity:book','signal.interests.entities':matches[0].entity_id,'feature.explainability':'true',take:'1'});
 if(insights.success===false||!Array.isArray(insights.results?.entities)||insights.results.entities.some(e=>!e.entity_id||!e.name||category(e)!=='book'))throw new Error('Insights response contract needs review.');
 return {status:'SMOKE COMPLETED — not a full live integration verification',calls,origin,resolvedCategory:category(matches[0]),recommendationCount:insights.results.entities.length,explainabilityPresent:insights.results.entities.some(e=>e.query?.explainability!==undefined)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const allowLive=process.argv.includes('--allow-live');
 try{console.log(JSON.stringify(await runSmoke({allowLive}),null,2));}catch(error){console.error(error instanceof Error&&error.message.startsWith('Qloo')||error instanceof Error&&/required|exact|contract|Search|Insights|No unique/.test(error.message)?error.message:'Smoke test failed. Inspect the response contract locally; do not publish raw responses or credentials.');process.exitCode=1;}
}
