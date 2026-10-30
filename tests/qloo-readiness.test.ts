import { describe,it,expect,vi } from 'vitest';
import { LiveQlooProvider,normalizeEntity } from '../lib/qloo/live-provider';
import { runAgent } from '../lib/agents/orchestrator';
import { auditVenues } from './fixtures/audit-venues';
import { runSmoke } from '../scripts/qloo-smoke.mjs';
const seed={id:'synthetic-seed',name:'Norah Jones',type:'artist' as const,source:'qloo' as const};
const documentedShape={entity_id:'synthetic-book-fixture',name:'Synthetic Book',type:'urn:entity',subtype:'urn:entity:book'};
const live=(fetcher:typeof fetch,options:Partial<{timeout:number;sleep:(ms:number)=>Promise<void>}>= {})=>new LiveQlooProvider({key:'test-only-not-a-real-key',baseUrl:'https://hackathon.api.qloo.com',fetcher,sleep:async()=>{},...options});
describe('pre-API documented contracts and safe failure behavior',()=>{
 it('normalizes documented type/subtype without mistaking the generic class for a category',()=>expect(normalizeEntity(documentedShape)).toMatchObject({type:'book',source:'qloo',id:documentedShape.entity_id}));
 it('rejects absent, conflicting, or wrong-category metadata',()=>{
  expect(()=>normalizeEntity({entity_id:'fixture',name:'Fixture'},'book')).toThrow();
  expect(()=>normalizeEntity({...documentedShape,types:['urn:entity:movie']})).toThrow();
  expect(()=>normalizeEntity(documentedShape,'movie')).toThrow('requested category');
 });
 it('rejects credential-bearing origins and redirects',async()=>{
  for(const baseUrl of ['https://evil.test','https://user@hackathon.api.qloo.com','https://hackathon.api.qloo.com/v2','https://hackathon.api.qloo.com?key=hidden'])expect(()=>new LiveQlooProvider({key:'fixture',baseUrl})).toThrow('approved Qloo origin');
  const f=vi.fn<typeof fetch>().mockResolvedValue(Response.json({results:[]}));await live(f).lookup('Norah Jones');expect(f.mock.calls[0][1]?.redirect).toBe('error');expect(new URL(String(f.mock.calls[0][0])).origin).toBe('https://hackathon.api.qloo.com');
 });
 it('validates lookup names and prevents synthetic or delimiter-injected signals before HTTP',async()=>{
  const f=vi.fn<typeof fetch>();await expect(live(f).lookup('')).rejects.toThrow('Invalid');
  await expect(live(f).discover([{...seed,source:'mock'}],'book')).rejects.toThrow('Invalid live');
  await expect(live(f).discover([{...seed,id:'one,two'}],'book')).rejects.toThrow('Invalid live');expect(f).not.toHaveBeenCalled();
 });
 it('preserves aggregate explanation separately and does not turn popularity into affinity',async()=>{
  const f=vi.fn<typeof fetch>().mockResolvedValue(Response.json({results:{entities:[{...documentedShape,popularity:.99}]},query:{explainability:{warning:'Synthetic warning'}}}));
  const [result]=await live(f).discover([seed],'book');expect(result.score).toBeUndefined();expect(result.explainability).toBeUndefined();expect(result.metadata?.queryExplainability).toEqual({warning:'Synthetic warning'});
 });
 it('fails success:false envelopes and unsupported result categories',async()=>{
  await expect(live(vi.fn<typeof fetch>().mockResolvedValue(Response.json({success:false,results:{entities:[]}}))).discover([seed],'book')).rejects.toThrow('contract');
  await expect(live(vi.fn<typeof fetch>().mockResolvedValue(Response.json({results:{entities:[{...documentedShape,subtype:'urn:entity:movie'}]}}))).discover([seed],'book')).rejects.toThrow('requested category');
 });
 it.each([400,401,403])('does not retry HTTP %i',async status=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('',{status}));await expect(live(f).lookup(seed.name)).rejects.toThrow();expect(f).toHaveBeenCalledTimes(1);
 });
 it.each([500,502,503])('bounds HTTP %i retries and stops',async status=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('',{status}));await expect(live(f).lookup(seed.name)).rejects.toThrow();expect(f).toHaveBeenCalledTimes(3);
 });
 it('honors Retry-After with a bounded wait',async()=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('',{status:429,headers:{'Retry-After':'3600'}})),sleep=vi.fn<(ms:number)=>Promise<void>>().mockResolvedValue(undefined);
  await expect(live(f,{sleep}).lookup(seed.name)).rejects.toThrow('rate limit');expect(sleep.mock.calls.map(c=>c[0])).toEqual([2500,2500]);
 });
 it('retries network failures, does not retry malformed JSON, and caps response bytes',async()=>{
  const unavailable=vi.fn<typeof fetch>().mockRejectedValue(new Error('secret upstream failure'));await expect(live(unavailable).lookup(seed.name)).rejects.toThrow('Could not reach');expect(unavailable).toHaveBeenCalledTimes(3);
  const malformed=vi.fn<typeof fetch>().mockResolvedValue(new Response('{bad'));await expect(live(malformed).lookup(seed.name)).rejects.toThrow('invalid JSON');expect(malformed).toHaveBeenCalledTimes(1);
  const huge=vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(512*1024+1)));await expect(live(huge).lookup(seed.name)).rejects.toThrow('size limit');expect(huge).toHaveBeenCalledTimes(1);
 });
 it('times out while reading a stalled response body, not only while waiting for headers',async()=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async()=>new Response(new ReadableStream<Uint8Array>({start(){}})));
  await expect(live(f,{timeout:5}).lookup(seed.name)).rejects.toThrow('timed out');expect(f).toHaveBeenCalledTimes(3);
 });
 it('cancels external aborts without further calls or retries',async()=>{
  const controller=new AbortController();const f=vi.fn<typeof fetch>().mockImplementation(async()=>{controller.abort(new DOMException('Cancelled','AbortError'));return Response.json({results:[]});});
  await expect(live(f).lookup(seed.name,controller.signal)).rejects.toThrow('Cancelled');expect(f).toHaveBeenCalledTimes(1);
 });
 it('never falls back to fictional data after failed live research and records the failure',async()=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async url=>String(url).includes('/search?')?Response.json({results:[{...seed,entity_id:seed.id,type:'urn:entity',subtype:'urn:entity:artist'}]}):new Response('',{status:403}));
  const actions: {action:string;tool:string}[]=[];await expect(runAgent({...auditVenues[1],interests:[seed.name]},live(f),a=>actions.push(a))).rejects.toThrow('denied');
  expect(actions.at(-1)).toMatchObject({action:'Tool call failed',tool:'Qloo /v2/insights'});expect(actions.some(a=>a.tool.startsWith('Mock'))).toBe(false);
 });
});
describe('opt-in smoke command',()=>{
 it('performs zero calls by default, even if a key is present',async()=>{const f=vi.fn<typeof fetch>();const result=await runSmoke({key:'synthetic-fixture',fetcher:f});expect(result.calls).toBe(0);expect(f).not.toHaveBeenCalled();});
 it('requires a key before the live opt-in can make a request',async()=>{const f=vi.fn<typeof fetch>();await expect(runSmoke({allowLive:true,key:'',fetcher:f})).rejects.toThrow('required');expect(f).not.toHaveBeenCalled();});
 it('bounds the smoke to two intercepted calls and returns no key, IDs, or raw data',async()=>{
  const f=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({results:[{entity_id:'synthetic-input',name:'Norah Jones',type:'urn:entity',subtype:'urn:entity:artist'}]})).mockResolvedValueOnce(Response.json({results:{entities:[documentedShape]}}));
  const result=await runSmoke({allowLive:true,key:'synthetic-fixture',fetcher:f});expect(result.calls).toBe(2);expect(f).toHaveBeenCalledTimes(2);expect(JSON.stringify(result)).not.toMatch(/synthetic-fixture|synthetic-input|Synthetic Book/);expect(new URL(String(f.mock.calls[1][0])).searchParams.get('take')).toBe('1');
 });
 it('stops on authentication failure without a second request',async()=>{const f=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:401}));await expect(runSmoke({allowLive:true,key:'synthetic-fixture',fetcher:f})).rejects.toThrow('HTTP 401');expect(f).toHaveBeenCalledTimes(1);});
});
