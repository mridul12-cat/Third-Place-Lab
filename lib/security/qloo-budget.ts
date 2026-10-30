import { ProviderError } from '../qloo/provider';
import { abortable } from '../qloo/http-utils';
import type { RequestBudgetStore } from './request-budget';

// One primary-key row, one atomic write: all hosting instances share the same allowance.
// Database time avoids caller-controlled windows and cross-isolate clock skew.
export const RESERVE_QLOO_REQUEST=`
INSERT INTO qloo_request_budget (id, utc_day, day_count, utc_minute, minute_count)
VALUES ('qloo', CAST(unixepoch('now') / 86400 AS INTEGER), 1, CAST(unixepoch('now') / 60 AS INTEGER), 1)
ON CONFLICT(id) DO UPDATE SET
 utc_day = excluded.utc_day,
 day_count = CASE WHEN utc_day = excluded.utc_day THEN day_count + 1 ELSE 1 END,
 utc_minute = excluded.utc_minute,
 minute_count = CASE WHEN utc_minute = excluded.utc_minute THEN minute_count + 1 ELSE 1 END
WHERE (utc_day <> excluded.utc_day OR day_count < ?1)
  AND (utc_minute <> excluded.utc_minute OR minute_count < ?2)
RETURNING id`;
export function releaseLimits(env:Record<string,string|undefined>){
 const parse=(key:string,max:number)=>{const text=env[key];if(!text||!/^\d+$/.test(text)||Number(text)<1||Number(text)>max)throw new ProviderError('Production Qloo request limits must be explicitly configured.',503);return Number(text);};
 const daily=parse('QLOO_DAILY_REQUEST_LIMIT',10000),perMinute=parse('QLOO_MINUTE_REQUEST_LIMIT',1000);
 if(perMinute>daily)throw new ProviderError('Production Qloo minute limit must not exceed its daily limit.',503);
 return {daily,perMinute};
}
export function productionRequestGuard(env:Record<string,string|undefined>,store?:RequestBudgetStore|(()=>RequestBudgetStore|undefined)){
 if(env.QLOO_PUBLIC_LIVE_ENABLED!=='true')throw new ProviderError('Production live cultural research is disabled pending release approval.',503);
 const limits=releaseLimits(env);
 const budget=typeof store==='function'?store():store;
 if(!budget?.reserve)throw new ProviderError('Production live cultural research requires the shared request-budget database.',503);
 return async(signal?:AbortSignal)=>{
  signal?.throwIfAborted();const timeout=AbortSignal.timeout(3000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  let reserved:boolean;
  try{combined.throwIfAborted();reserved=await abortable(budget.reserve(limits,combined),combined);combined.throwIfAborted();}
  catch{if(signal?.aborted)throw signal.reason;throw new ProviderError('Live cultural research protection is unavailable. Please retry later.',503);}
  if(reserved!==true)throw new ProviderError('The shared live research request limit has been reached. Please retry later.',429);
 };
}
