import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { MockQlooProvider } from '../lib/qloo/mock-provider';
import { abortable } from '../lib/qloo/http-utils';
import { auditVenues } from './fixtures/audit-venues';
let handlePlanning: typeof import('../lib/agents/http').handlePlanning;
let select: typeof import('../lib/qloo/select');
const venue=auditVenues[1];
const request=(body:unknown,headers:Record<string,string>={})=>new Request('https://lab.test/api/refine',{method:'POST',headers,body:JSON.stringify(body)});
const messages=async(response:Response)=>(await response.text()).trim().split('\n').map(l=>JSON.parse(l));
beforeEach(async()=>{vi.resetModules();({handlePlanning}=await import('../lib/agents/http'));select=await import('../lib/qloo/select');vi.spyOn(select,'selectProvider').mockReturnValue(new MockQlooProvider());});
afterEach(()=>vi.restoreAllMocks());
describe('public handler hardening and revision integrity',()=>{
 it.each([{venue,extra:'unexpected'},{venue,request:'arbitrary-action'},{venue,maximumCapacity:5},{venue:{...venue,budget:'1000'}}])('rejects malformed, unknown, or contradictory fields before provider use',async body=>{
  expect((await handlePlanning(request(body),true)).status).toBe(400);expect(select.selectProvider).not.toHaveBeenCalled();
 });
 it('rejects body bytes above 16KB without Content-Length, including multibyte payloads',async()=>{
  const response=await handlePlanning(request({venue,extra:'🌷'.repeat(4500)}));expect(response.status).toBe(413);expect(select.selectProvider).not.toHaveBeenCalled();
 });
 it('stops reading an unbounded request stream at the size limit',async()=>{
  let chunks=0,cancelled=false;
  const body=new ReadableStream<Uint8Array>({pull(c){chunks++;c.enqueue(new TextEncoder().encode('x'.repeat(4096)));},cancel(){cancelled=true;}});
  const init:RequestInit&{duplex:'half'}={method:'POST',body,duplex:'half'};
  expect((await handlePlanning(new Request('https://lab.test/api/events',init))).status).toBe(413);expect(cancelled).toBe(true);expect(chunks).toBeLessThan(8);
 });
 it('does not allow refinement fields on the initial planning endpoint',async()=>expect((await handlePlanning(request({venue,request:'family'}))).status).toBe(400));
 it('does not let arbitrary X-Forwarded-For rotate around the local rate limit',async()=>{
  for(let i=0;i<8;i++)await handlePlanning(request({}, {'x-forwarded-for':`spoof-${i}`}));
  const r=await handlePlanning(request({}, {'x-forwarded-for':'fresh-spoof'}));expect(r.status).toBe(429);expect(r.headers.get('Retry-After')).toBe('60');
 });
 it('keeps a global request bound even with rotating client headers',async()=>{
  for(let i=0;i<32;i++)await handlePlanning(request({}, {'cf-connecting-ip':`synthetic-${i}`}));
  expect((await handlePlanning(request({}, {'cf-connecting-ip':'another'}))).status).toBe(429);
 });
 it('records and retains three consecutive refinements through the HTTP boundary',async()=>{
  let v=venue,history: {request:string;at:string;changes:string[]}[]=[];
  for(const kind of ['family','cheaper','direction']){
   const r=await handlePlanning(request({venue:v,request:kind,history,maximumCapacity:venue.capacity}),true);expect(r.status).toBe(200);
   const records=await messages(r);const run=records.at(-1).run;expect(run).toBeDefined();v=run.venue;history=run.revisions;
   for(const c of run.concepts){expect(c.activities.join(' ')).toMatch(/caregiver|family/i);expect(c.revision).toBe(history.length);}
  }
  expect(history.map(r=>r.request)).toEqual(['family','cheaper','direction']);expect(v.budget).toBeLessThan(venue.budget);
 });
 it('accepts an exact 70% budget reduction and explicit context change without applying another preset',async()=>{
  const r=await handlePlanning(request({venue:{...venue,budget:300,capacity:100,atmosphere:'Slow & cozy',constraints:'No audio playback; no food.'},request:'context',maximumCapacity:100}),true);
  const records=await messages(r);const run=records.at(-1).run;expect(run.venue.budget).toBe(300);expect(run.venue.capacity).toBe(100);expect(run.concepts.every((c:{budget:{total:number}})=>c.budget.total<=300)).toBe(true);expect(run.concepts[1].activities.join(' ')).toMatch(/Silent adaptation/);
 });
 it('cancels actual research and does not continue to other tools after a client disconnect',async()=>{
  const provider=new MockQlooProvider();let aborted=false;
  const lookup=vi.spyOn(provider,'lookup').mockImplementation(async(_name,signal)=>{signal?.addEventListener('abort',()=>{aborted=true;});return abortable(new Promise<never>(()=>{}),signal);});
  const discover=vi.spyOn(provider,'discover');vi.mocked(select.selectProvider).mockReturnValue(provider);
  const r=await handlePlanning(request({venue}));const reader=r.body!.getReader();expect((await reader.read()).done).toBe(false);await reader.cancel();await new Promise(resolve=>setTimeout(resolve,0));
  expect(aborted).toBe(true);expect(lookup).toHaveBeenCalledTimes(1);expect(discover).not.toHaveBeenCalled();
 });
 it('caps concurrent runs and releases slots when cancelled',async()=>{
  const provider=new MockQlooProvider();vi.spyOn(provider,'lookup').mockImplementation(async(_name,signal)=>abortable(new Promise<never>(()=>{}),signal));vi.mocked(select.selectProvider).mockReturnValue(provider);
  const first=await handlePlanning(request({venue})),second=await handlePlanning(request({venue}));expect((await handlePlanning(request({venue}))).status).toBe(429);
  await first.body!.cancel();await second.body!.cancel();await new Promise(resolve=>setTimeout(resolve,0));vi.mocked(select.selectProvider).mockReturnValue(new MockQlooProvider());expect((await messages(await handlePlanning(request({venue})))).at(-1).type).toBe('result');
 });
 it('does not echo upstream secrets, exception details, or a result on a failed run',async()=>{
  const provider=new MockQlooProvider();vi.spyOn(provider,'lookup').mockRejectedValue(new Error('sensitive-debug-secret'));vi.mocked(select.selectProvider).mockReturnValue(provider);
  const records=await messages(await handlePlanning(request({venue})));expect(records.at(-1).type).toBe('error');expect(JSON.stringify(records)).not.toContain('sensitive-debug-secret');expect(records.some(r=>r.type==='result')).toBe(false);
 });
 it('rejects overlong or fabricated revision history structures',async()=>{
  const h={request:'family',at:new Date().toISOString(),changes:[]};expect((await handlePlanning(request({venue,request:'cheaper',history:Array(20).fill(h)}),true)).status).toBe(400);
  expect((await handlePlanning(request({venue,request:'cheaper',history:[{...h,request:'unknown'}]}),true)).status).toBe(400);
 });
});
