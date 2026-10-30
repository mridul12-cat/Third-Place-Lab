import 'server-only';
import { createClient } from '@libsql/client/web';
import { ProviderError } from '../qloo/provider';
import { RESERVE_QLOO_REQUEST } from './qloo-budget';
import type { RequestBudgetStore } from './request-budget';

function approvedHost(url:URL){return url.hostname.endsWith('.turso.io')&&!url.username&&!url.password&&!url.port;}

/** Remote writes only: no embedded replica, local file, or offline reservation queue. */
export function tursoBudgetStore(env:Record<string,string|undefined>,transport:typeof fetch=fetch):RequestBudgetStore {
 let url:URL;
 try{url=new URL(env.TURSO_DATABASE_URL??'');}catch{throw new ProviderError('Production live cultural research requires a valid Turso database configuration.',503);}
 const token=env.TURSO_AUTH_TOKEN;
 if(!['libsql:','https:'].includes(url.protocol)||!approvedHost(url)||(url.pathname!==''&&url.pathname!=='/')||url.search||url.hash||!token?.trim()||token.length>8192||/\s/.test(token)){
  throw new ProviderError('Production live cultural research requires a valid Turso database configuration.',503);
 }
 return {async reserve(limits,signal){
  signal?.throwIfAborted();
  // A request-scoped transport cancels the SDK's HTTP work, not only our wait.
  // Validate every target, including SDK-provided continuation URLs.
  const boundedFetch:typeof fetch=async(input,init)=>{
   signal?.throwIfAborted();const request=new Request(input,init),target=new URL(request.url);
   if(target.protocol!=='https:'||!approvedHost(target))throw new Error('Unapproved budget transport origin.');
   return transport(request,{signal:signal?AbortSignal.any([signal,request.signal]):request.signal,redirect:'error'});
  };
  const client=createClient({url:url.href,authToken:token,fetch:boundedFetch});
  try{
   const result=await client.execute({sql:RESERVE_QLOO_REQUEST,args:[limits.daily,limits.perMinute]});
   signal?.throwIfAborted();
   if(result.rows.length===0&&result.rowsAffected===0)return false;
   if(result.rows.length===1&&result.rows[0].id==='qloo'&&result.rowsAffected===1)return true;
   throw new Error('Invalid budget reservation contract.');
  }finally{client.close();}
 }};
}
