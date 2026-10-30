import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe,expect,it,vi } from 'vitest';
import { d1BudgetStore } from '../lib/security/d1-budget-store';
import { productionRequestGuard,releaseLimits } from '../lib/security/qloo-budget';
import { withReleaseContext } from '../lib/security/release-context';
import { selectProvider } from '../lib/qloo/select';
import { LiveQlooProvider } from '../lib/qloo/live-provider';

const settings={APP_ORIGIN:'https://lab.test',QLOO_MODE:'live',QLOO_API_KEY:'synthetic-test-key',QLOO_PUBLIC_LIVE_ENABLED:'true',QLOO_DAILY_REQUEST_LIMIT:'10',QLOO_MINUTE_REQUEST_LIMIT:'4'};
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../drizzle/0000_lush_white_queen.sql',import.meta.url),'utf8'));
 const db={prepare(query:string){return {bind(...values:number[]){return {async first(){return sql.prepare(query).get(...values)??null;}};}};}} as unknown as D1Database;
 return {sql,db};
}
describe('shared production Qloo allowance',()=>{
 it('enforces one allowance across independent guards and concurrent reservations',async()=>{
  const {sql,db}=database();try{
   const guards=[productionRequestGuard(settings,d1BudgetStore(db)),productionRequestGuard(settings,d1BudgetStore(db))];
   const results=await Promise.allSettled(Array.from({length:12},(_,i)=>guards[i%2]()));
   expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(4);
   for(const r of results)if(r.status==='rejected')expect(r.reason.status).toBe(429);
   expect(sql.prepare('SELECT day_count, minute_count FROM qloo_request_budget').get()).toMatchObject({day_count:4,minute_count:4});
  }finally{sql.close();}
 });
 it('resets the minute independently and preserves the daily ceiling',async()=>{
  const {sql,db}=database();try{
   const guard=productionRequestGuard({...settings,QLOO_DAILY_REQUEST_LIMIT:'2',QLOO_MINUTE_REQUEST_LIMIT:'1'},d1BudgetStore(db));
   await guard();sql.exec('UPDATE qloo_request_budget SET utc_minute = utc_minute - 1');await guard();
   sql.exec('UPDATE qloo_request_budget SET utc_minute = utc_minute - 1');await expect(guard()).rejects.toMatchObject({status:429});
   sql.exec('UPDATE qloo_request_budget SET utc_day = utc_day - 1');await guard();
   expect(sql.prepare('SELECT day_count, minute_count FROM qloo_request_budget').get()).toMatchObject({day_count:1,minute_count:1});
  }finally{sql.close();}
 });
 it('fails closed when disabled, unbound, misconfigured, or unavailable',async()=>{
  const {sql,db}=database();try{
   expect(()=>productionRequestGuard({...settings,QLOO_PUBLIC_LIVE_ENABLED:'false'},d1BudgetStore(db))).toThrow('disabled');
   expect(()=>productionRequestGuard(settings)).toThrow(/database/i);
   for(const value of ['0','-1','1.5','Infinity','10001',''])expect(()=>releaseLimits({...settings,QLOO_DAILY_REQUEST_LIMIT:value})).toThrow();
   expect(()=>releaseLimits({...settings,QLOO_DAILY_REQUEST_LIMIT:'1'})).toThrow('minute');
   sql.exec('DROP TABLE qloo_request_budget');
   await expect(productionRequestGuard(settings,d1BudgetStore(db))()).rejects.toMatchObject({status:503,message:'Live cultural research protection is unavailable. Please retry later.'});
  }finally{sql.close();}
 });
 it('cancels without reserving a request when the client already disconnected',async()=>{
  const {sql,db}=database();try{
   const controller=new AbortController();controller.abort();
   await expect(productionRequestGuard(settings,d1BudgetStore(db))(controller.signal)).rejects.toThrow();
   expect(sql.prepare('SELECT count(*) AS n FROM qloo_request_budget').get()?.n).toBe(0);
  }finally{sql.close();}
 });
 it('fails closed on protection timeouts',async()=>{
  vi.useFakeTimers();try{
   const db={prepare(){return {bind(){return {first(){return new Promise(()=>{});}};}};}} as unknown as D1Database;
   // AbortSignal.timeout uses native timers, so inject an aborted combined signal.
   const timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(AbortSignal.abort());
   await expect(productionRequestGuard(settings,d1BudgetStore(db))()).rejects.toMatchObject({status:503});timeout.mockRestore();
  }finally{vi.useRealTimers();}
 });
});
describe('production isolation and actual HTTP attempts',()=>{
 it('uses trusted request-scoped settings and never borrows the local live key',async()=>{
  const {sql,db}=database();try{
   const output=await Promise.all([
    withReleaseContext({production:true,env:{}},async()=>{await Promise.resolve();return selectProvider(settings).mode;}),
    withReleaseContext({production:true,budgetDb:db,env:settings},async()=>{await Promise.resolve();return selectProvider().mode;}),
   ]);expect(output).toEqual(['mock','live']);
   expect(()=>selectProvider({...settings,NODE_ENV:'production'})).toThrow(/database/i);
   withReleaseContext({production:true,budgetDb:db,env:{...settings,QLOO_PUBLIC_LIVE_ENABLED:'false'}},()=>expect(()=>selectProvider()).toThrow('disabled'));
  }finally{sql.close();}
 });
 it('does not execute or retry HTTP when the shared allowance refuses it',async()=>{
  const {sql,db}=database();try{
   const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({results:[]}));
   const provider=new LiveQlooProvider({key:'synthetic-test-key',baseUrl:'https://hackathon.api.qloo.com',fetcher,beforeRequest:productionRequestGuard({...settings,QLOO_DAILY_REQUEST_LIMIT:'1',QLOO_MINUTE_REQUEST_LIMIT:'1'},d1BudgetStore(db))});
   await provider.lookup('Fixture');await expect(provider.lookup('Fixture')).rejects.toMatchObject({status:429});expect(fetcher).toHaveBeenCalledTimes(1);
  }finally{sql.close();}
 });
 it('reserves allowance for every retry, including unsuccessful HTTP responses',async()=>{
  const {sql,db}=database();try{
   const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>new Response(null,{status:503}));
   const provider=new LiveQlooProvider({key:'synthetic-test-key',baseUrl:'https://hackathon.api.qloo.com',fetcher,sleep:async()=>{},beforeRequest:productionRequestGuard(settings,d1BudgetStore(db))});
   await expect(provider.lookup('Fixture')).rejects.toMatchObject({status:502});expect(fetcher).toHaveBeenCalledTimes(3);
   expect(sql.prepare('SELECT day_count FROM qloo_request_budget').get()?.day_count).toBe(3);
  }finally{sql.close();}
 });
 it('caps a research provider at twelve actual attempts',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({results:[]}));
  const provider=new LiveQlooProvider({key:'synthetic-test-key',baseUrl:'https://hackathon.api.qloo.com',fetcher});
  for(let i=0;i<12;i++)await provider.lookup('Fixture');
  await expect(provider.lookup('Fixture')).rejects.toMatchObject({status:429});expect(fetcher).toHaveBeenCalledTimes(12);
 });
});
describe('production planning boundary with synthetic HTTP only',()=>{
 it('rejects disabled live configuration before research, with no mock substitution',async()=>{
  const {handlePlanning}=await import('../lib/agents/http');const {samples}=await import('../data/sample-venues');
  const fetcher=vi.fn<typeof fetch>();vi.stubGlobal('fetch',fetcher);
  try{
   const response=await withReleaseContext({production:true,env:{...settings,QLOO_PUBLIC_LIVE_ENABLED:'false'}},()=>handlePlanning(new Request('https://lab.test/api/events',{method:'POST',body:JSON.stringify({venue:samples[1]})})));
   expect(response.status).toBe(503);expect(await response.text()).toContain('disabled');expect(fetcher).not.toHaveBeenCalled();
  }finally{vi.unstubAllGlobals();}
 });
 it('ends the stream honestly if the shared quota runs out during real adapter operations',async()=>{
  const {handlePlanning}=await import('../lib/agents/http');const {samples}=await import('../data/sample-venues');const {sql,db}=database();
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({results:[{entity_id:'synthetic-input',name:'Fixture Artist',types:['urn:entity:artist']}]}));vi.stubGlobal('fetch',fetcher);
  try{
   const response=await withReleaseContext({production:true,budgetDb:db,env:{...settings,QLOO_DAILY_REQUEST_LIMIT:'1',QLOO_MINUTE_REQUEST_LIMIT:'1'}},()=>handlePlanning(new Request('https://lab.test/api/events',{method:'POST',body:JSON.stringify({venue:{...samples[1],interests:['Fixture Artist']}})})));
   const records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
   expect(records.at(-1)).toMatchObject({type:'error'});expect(records.at(-1).error).toContain('shared live research request limit');
   expect(records.some(row=>row.type==='result')).toBe(false);expect(JSON.stringify(records)).not.toContain('synthetic-test-key');expect(fetcher).toHaveBeenCalledTimes(1);
  }finally{sql.close();vi.unstubAllGlobals();}
 });
});
