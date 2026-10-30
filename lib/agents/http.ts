import { z } from 'zod';
import { venueSchema, refinementSchema } from '../validation/venue';
import { selectProvider } from '../qloo/select';
import { ProviderError } from '../qloo/provider';
import { BodyTooLargeError, readBoundedJson } from '../qloo/http-utils';
import { runAgent, revisedVenue } from './orchestrator';
import { planningRequestPolicy } from '../security/request-policy';
const limits=new Map<string,{count:number;reset:number}>();
let inFlight=0;
export function rateAllowed(key:string,now=Date.now(),limit=8) {
 let entry=limits.get(key);if(!entry||entry.reset<=now){entry={count:0,reset:now+60000};limits.set(key,entry);}
 if(limits.size>1000){for(const [k,v] of limits)if(v.reset<=now)limits.delete(k);if(limits.size>1000){const oldest=limits.keys().next().value;if(oldest)limits.delete(oldest);}}
 return ++entry.count<=limit;
}
const historySchema=z.array(z.object({request:refinementSchema,at:z.string().datetime(),changes:z.array(z.string().max(300)).max(15)}).strict()).max(19);
const bodySchema=z.object({venue:venueSchema,request:refinementSchema.optional(),revision:z.number().int().min(0).max(20).optional(),maximumCapacity:z.number().int().min(2).max(200).optional(),history:historySchema.optional()}).strict();
export async function handlePlanning(request:Request,refine=false) {
 const failure=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(Number(request.headers.get('content-length'))>16000)return failure('Request too large.',413);
 let client:string;try{({client}=planningRequestPolicy(request));}catch(error){return failure(error instanceof ProviderError?error.message:'Request policy unavailable.',error instanceof ProviderError?error.status:503);}
 if(!rateAllowed('global:planning',Date.now(),32)||!rateAllowed(`client:${client}`))return new Response(JSON.stringify({error:'Too many plans. Please wait a minute.'}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'60','Cache-Control':'no-store'}});
 if(inFlight>=2)return failure('The planner is busy. Please retry shortly.',429);
 const abort=new AbortController();const signal=AbortSignal.any([request.signal,abort.signal]);
 const deadline=setTimeout(()=>abort.abort(new DOMException('Planning deadline exceeded','TimeoutError')),90000);
 let input:z.infer<typeof bodySchema>;
 try{input=bodySchema.parse(await readBoundedJson(request.body,16000,signal));if(refine&&!input.request)throw new Error('Missing refinement.');if(!refine&&(input.request||input.history?.length))throw new Error('Refinement fields require /api/refine.');if(input.maximumCapacity!==undefined&&input.venue.capacity>input.maximumCapacity)throw new Error('Capacity exceeds venue maximum.');}
 catch(error){clearTimeout(deadline);return failure(error instanceof BodyTooLargeError?'Request too large.':'Check your venue details: add interests, a budget of at least INR 100, a capacity of 2–200, and a valid refinement history.',error instanceof BodyTooLargeError?413:400);}
 if(inFlight>=2){clearTimeout(deadline);return failure('The planner is busy. Please retry shortly.',429);}
 let provider;try{provider=selectProvider();}catch(error){clearTimeout(deadline);return failure(error instanceof ProviderError?error.message:'Provider unavailable.',503);}
 const encoder=new TextEncoder();let cancelled=false,released=false;
 inFlight++;
 const release=()=>{if(!released){released=true;inFlight--;clearTimeout(deadline);}};
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   const send=(data:unknown)=>{if(!cancelled){signal.throwIfAborted();controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'));}};
   try{
    const venue=input.request?revisedVenue(input.venue,input.request,input.maximumCapacity??input.venue.capacity):input.venue;
    const previous=refine?{venue:input.venue,revisions:input.history??[]}:undefined;
    const run=await runAgent(venue,provider,a=>send({type:'progress',action:a}),input.request,previous,signal);
    send({type:'result',run});
   }catch(error){if(!cancelled&&!request.signal.aborted){controller.enqueue(encoder.encode(JSON.stringify({type:'error',error:abort.signal.aborted?'Planning timed out. Please retry.':error instanceof ProviderError?error.message:'Planning could not finish. Please retry.'})+'\n'));}}
   finally{if(!cancelled)controller.close();release();}
  },
  cancel(){cancelled=true;abort.abort(new DOMException('Client cancelled','AbortError'));release();},
 });
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
