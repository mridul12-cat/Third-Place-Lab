import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe,expect,it,vi } from 'vitest';
import { tursoBudgetStore } from '../lib/security/turso-budget-store';
import { productionRequestGuard,RESERVE_QLOO_REQUEST } from '../lib/security/qloo-budget';
import { selectProvider } from '../lib/qloo/select';
import { withReleaseContext } from '../lib/security/release-context';
import { LiveQlooProvider } from '../lib/qloo/live-provider';
import { abortable } from '../lib/qloo/http-utils';

const config={TURSO_DATABASE_URL:'libsql://synthetic-budget.turso.io',TURSO_AUTH_TOKEN:'synthetic-database-token',QLOO_MODE:'live',QLOO_API_KEY:'synthetic-qloo-key',QLOO_PUBLIC_LIVE_ENABLED:'true',QLOO_DAILY_REQUEST_LIMIT:'10',QLOO_MINUTE_REQUEST_LIMIT:'4'};
// Actual libSQL SDK + synthetic intercepted Hrana HTTP. SQLite simulates shared SQL
// semantics only: this is not remote Turso concurrency or persistence verification.
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_lush_white_queen.sql',import.meta.url),'utf8'));
 const fetcher=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
  const request=new Request(input,init);expect(new URL(request.url).hostname).toBe('synthetic-budget.turso.io');expect(request.redirect).toBe('error');
  expect(request.headers.get('authorization')).toBe('Bearer synthetic-database-token');
  const payload=await request.json() as {requests:{type:string;stmt:{sql:string;args:{type:string;value:number|string}[]}}[]};
  expect(payload.requests.map((r:{type:string})=>r.type)).toEqual(['execute','close']);
  const statement=payload.requests[0].stmt;expect(statement.sql).toBe(RESERVE_QLOO_REQUEST);expect(statement.args.map((a:{type:string})=>a.type)).toEqual(['float','float']);
  const rows=sql.prepare(statement.sql).all(...statement.args.map((a:{value:number|string})=>Number(a.value)));
  return Response.json({baton:null,base_url:null,results:[{type:'ok',response:{type:'execute',result:{cols:[{name:'id',decltype:'TEXT'}],rows:rows.map(()=>[{type:'text',value:'qloo'}]),affected_row_count:rows.length,last_insert_rowid:null}}},{type:'ok',response:{type:'close'}}]});
 });return {sql,fetcher};
}
describe('portable live request budgets, using synthetic database responses only',()=>{
 it('shares a cap across independent SDK instances and concurrent calls',async()=>{
  const {sql,fetcher}=fixture();try{
   const guards=[productionRequestGuard(config,tursoBudgetStore(config,fetcher)),productionRequestGuard(config,tursoBudgetStore(config,fetcher))];
   const outcomes=await Promise.allSettled(Array.from({length:12},(_,i)=>guards[i%2]()));
   expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(4);expect(fetcher).toHaveBeenCalledTimes(12);
   for(const outcome of outcomes)if(outcome.status==='rejected')expect(outcome.reason.status).toBe(429);
   expect(sql.prepare('SELECT day_count, minute_count FROM qloo_request_budget').get()).toMatchObject({day_count:4,minute_count:4});
   // Recreating the application store must not recreate/reset the database row.
   await expect(productionRequestGuard(config,tursoBudgetStore(config,fetcher))()).rejects.toMatchObject({status:429});
  }finally{sql.close();}
 });
 it('retains daily usage across minute rollover and resets both after UTC-day rollover',async()=>{
  const {sql,fetcher}=fixture();try{
   const settings={...config,QLOO_DAILY_REQUEST_LIMIT:'2',QLOO_MINUTE_REQUEST_LIMIT:'1'};
   const reserve=productionRequestGuard(settings,tursoBudgetStore(settings,fetcher));
   await reserve();sql.exec('UPDATE qloo_request_budget SET utc_minute=utc_minute-1');await reserve();
   sql.exec('UPDATE qloo_request_budget SET utc_minute=utc_minute-1');await expect(reserve()).rejects.toMatchObject({status:429});
   sql.exec('UPDATE qloo_request_budget SET utc_day=utc_day-1');await reserve();
   expect(sql.prepare('SELECT day_count,minute_count FROM qloo_request_budget').get()).toMatchObject({day_count:1,minute_count:1});
  }finally{sql.close();}
 });
 it.each(['', 'file:local.db','http://synthetic-budget.turso.io','https://attacker.test','https://db.turso.io.attacker.test','https://user:password@db.turso.io','https://db.turso.io:443/path','https://db.turso.io?token=bad'])('rejects unsafe or missing database endpoint %s',url=>{
  expect(()=>tursoBudgetStore({...config,TURSO_DATABASE_URL:url})).toThrow(/configuration/);
 });
 it.each(['','bad token','bad\r\ntoken'])('rejects missing or invalid database tokens',token=>expect(()=>tursoBudgetStore({...config,TURSO_AUTH_TOKEN:token})).toThrow(/configuration/));
 it('requires the guard in native production AND native development, without issuing HTTP',()=>{
  for(const NODE_ENV of ['production','development'])expect(()=>selectProvider({...config,TURSO_DATABASE_URL:'',NODE_ENV})).toThrow(/database/);
  expect(()=>selectProvider({...config,QLOO_PUBLIC_LIVE_ENABLED:'false',NODE_ENV:'production'})).toThrow('disabled');
  expect(selectProvider({...config,QLOO_MODE:'mock',TURSO_DATABASE_URL:''}).mode).toBe('mock');
 });
 it('maps SQL/network/malformed response errors to safe failure and no Qloo attempt',async()=>{
  for(const response of [()=>Promise.reject(new Error('sensitive-database-details')),()=>Promise.resolve(new Response('broken',{status:503})),()=>Promise.resolve(Response.json({unexpected:'payload'}))]){
   const database=vi.fn<typeof fetch>().mockImplementation(response),upstream=vi.fn<typeof fetch>();
   const provider=new LiveQlooProvider({key:'synthetic-qloo-key',baseUrl:'https://hackathon.api.qloo.com',fetcher:upstream,beforeRequest:productionRequestGuard(config,tursoBudgetStore(config,database))});
   await expect(provider.lookup('Fixture')).rejects.toMatchObject({status:503,message:'Live cultural research protection is unavailable. Please retry later.'});expect(upstream).not.toHaveBeenCalled();expect(database).toHaveBeenCalledTimes(1);
  }
 });
 it('does not start a database request for an already cancelled run',async()=>{
  const database=vi.fn<typeof fetch>(),abort=new AbortController();abort.abort();
  await expect(productionRequestGuard(config,tursoBudgetStore(config,database))(abort.signal)).rejects.toThrow();expect(database).not.toHaveBeenCalled();
 });
 it('aborts the SDK transport on client cancellation and never advances to Qloo',async()=>{
  const abort=new AbortController();let observed:AbortSignal|undefined;
  const database=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{observed=new Request(input,init).signal;return abortable(new Promise<never>(()=>{}),observed);});
  const upstream=vi.fn<typeof fetch>(),provider=new LiveQlooProvider({key:'synthetic-qloo-key',baseUrl:'https://hackathon.api.qloo.com',fetcher:upstream,beforeRequest:productionRequestGuard(config,tursoBudgetStore(config,database))});
  const pending=provider.lookup('Fixture',abort.signal);await vi.waitFor(()=>expect(database).toHaveBeenCalledTimes(1));abort.abort();
  await expect(pending).rejects.toThrow();expect(observed?.aborted).toBe(true);expect(upstream).not.toHaveBeenCalled();
 });
 it('times out database work, including its transport, without an upstream call',async()=>{
  const deadline=new AbortController();const timer=vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);let observed:AbortSignal|undefined;
  const database=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{observed=new Request(input,init).signal;return abortable(new Promise<never>(()=>{}),observed);});
  try{
   const reserve=productionRequestGuard(config,tursoBudgetStore(config,database));const pending=reserve();await vi.waitFor(()=>expect(database).toHaveBeenCalledTimes(1));deadline.abort();
   await expect(pending).rejects.toMatchObject({status:503});expect(observed?.aborted).toBe(true);
  }finally{timer.mockRestore();}
 });
 it('never refunds an ambiguously committed reservation after disconnection',async()=>{
  const {sql,fetcher}=fixture(),abort=new AbortController();try{
   const transport:typeof fetch=async(input,init)=>{const response=await fetcher(input,init);abort.abort();return response;};
   await expect(productionRequestGuard(config,tursoBudgetStore(config,transport))(abort.signal)).rejects.toThrow();
   expect(sql.prepare('SELECT day_count FROM qloo_request_budget').get()?.day_count).toBe(1);
  }finally{sql.close();}
 });
 it('honors request-scoped store injection without relying on Worker bindings',async()=>{
  const reserve=vi.fn().mockResolvedValue(false);const fetcher=vi.fn<typeof fetch>();vi.stubGlobal('fetch',fetcher);
  try{
   const provider=withReleaseContext({production:true,env:config,budgetStore:{reserve}},()=>selectProvider());
   await expect(provider.lookup('Fixture')).rejects.toMatchObject({status:429});expect(reserve).toHaveBeenCalledTimes(1);expect(fetcher).not.toHaveBeenCalled();
  }finally{vi.unstubAllGlobals();}
 });
});
describe('complete native production handler using intercepted database and Qloo fixtures',()=>{
 it('grounds generation/refinement in executed research and stops honestly at the shared ceiling',async()=>{
  const {handlePlanning}=await import('../lib/agents/http');const {samples}=await import('../data/sample-venues');const {sql,fetcher}=fixture();let qlooCalls=0;const databaseErrors:unknown[]=[];
  const transport=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
   const request=new Request(input,init),url=new URL(request.url);
   if(url.hostname==='synthetic-budget.turso.io'){try{return await fetcher(request);}catch(error){databaseErrors.push(error);throw error;}}
   if(url.origin!=='https://hackathon.api.qloo.com')throw new Error('Unexpected synthetic transport target.');
   qlooCalls++;expect(request.headers.get('X-Api-Key')).toBe('synthetic-qloo-key');
   if(url.pathname==='/search')return Response.json({results:[{entity_id:'synthetic-artist',name:'Fixture Artist',types:['urn:entity:artist']}]});
   const type=url.searchParams.get('filter.type')!.replace('urn:entity:','');
   return Response.json({success:true,results:{entities:[{entity_id:`synthetic-${type}`,name:`Fixture ${type}`,type:'urn:entity',subtype:`urn:entity:${type}`,query:{affinity:.4,explainability:{synthetic:true}}}]}});
  });
  try{
   vi.stubGlobal('fetch',transport);
   for(const [key,value]of Object.entries({...config,NODE_ENV:'production',APP_ORIGIN:'https://lab.test',QLOO_MINUTE_REQUEST_LIMIT:'10'}))vi.stubEnv(key,value);
   const run=async(body:unknown,refine=false)=>{
    const response=await handlePlanning(new Request(`https://lab.test/api/${refine?'refine':'events'}`,{method:'POST',headers:{Origin:'https://lab.test'},body:JSON.stringify(body)}),refine);
    expect(response.status).toBe(200);return (await response.text()).trim().split('\n').map(line=>JSON.parse(line));
   };
   const records=await run({venue:{...samples[1],interests:['Fixture Artist']}}),before=records.at(-1).run;
   expect(databaseErrors).toEqual([]);expect(records.at(-1)).toMatchObject({type:'result'});expect(before.mode).toBe('live');expect(before.concepts).toHaveLength(3);expect(before.evidence).toHaveLength(3);
   expect(before.dna.filter((d:{source:string})=>d.source==='qloo')).toHaveLength(3);
   for(const concept of before.concepts){expect(concept.activities.join(' ')).toContain(concept.evidence[0].name);expect(concept.evidence.every((e:{source:string})=>e.source==='qloo')).toBe(true);}
   const revised=(await run({venue:before.venue,request:'cheaper',history:before.revisions},true)).at(-1).run;
   expect(revised.revisions).toHaveLength(1);expect(revised.evidence.map((e:{id:string})=>e.id)).toEqual(before.evidence.map((e:{id:string})=>e.id));
   expect(revised.concepts.every((c:{budget:{total:number}},i:number)=>c.budget.total<before.concepts[i].budget.total)).toBe(true);
   expect(qlooCalls).toBe(8);expect(sql.prepare('SELECT day_count FROM qloo_request_budget').get()?.day_count).toBe(8);
   const stopped=await run({venue:before.venue});expect(stopped.at(-1).type).toBe('error');expect(stopped.at(-1).error).toContain('shared live research request limit');expect(stopped.some(r=>r.type==='result')).toBe(false);
   expect(qlooCalls).toBe(10);expect(sql.prepare('SELECT day_count FROM qloo_request_budget').get()?.day_count).toBe(10);
  }finally{sql.close();vi.unstubAllGlobals();vi.unstubAllEnvs();}
 });
});
