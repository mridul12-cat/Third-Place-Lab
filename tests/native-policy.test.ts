import { describe,expect,it,vi } from 'vitest';
import { planningRequestPolicy } from '../lib/security/request-policy';
import { withReleaseContext } from '../lib/security/release-context';
import { GET } from '../app/api/health/route';

const env={NODE_ENV:'production',VERCEL:'1',APP_ORIGIN:'https://third-place.example'};
const request=(headers:Record<string,string>={})=>new Request('http://localhost:3000/api/events',{method:'POST',headers});
describe('native canonical Origin policy',()=>{
 it('accepts the configured public origin despite Next reconstructing an internal URL',()=>{
  expect(planningRequestPolicy(request({origin:env.APP_ORIGIN}),env).origin).toBe(env.APP_ORIGIN);
 });
 it.each(['https://attacker.example','https://third-place.example.attacker.test','http://third-place.example','https://third-place.example:444','https://third-place.example/','null',''])('rejects the spoofed/cross-origin value %s',origin=>{
  expect(()=>planningRequestPolicy(request({origin,host:'attacker.example','x-forwarded-host':env.APP_ORIGIN,'x-forwarded-proto':'https'}),env)).toThrow('Cross-origin');
 });
 it('does not accept a spoofed forwarded host as the canonical application origin',()=>{
  expect(()=>planningRequestPolicy(request({origin:'https://attacker.example','x-forwarded-host':'attacker.example',host:'attacker.example','x-forwarded-proto':'https'}),env)).toThrow('Cross-origin');
 });
 it.each(['', 'http://public.example','https://third-place.example/path','https://user:pass@third-place.example','https://third-place.example?query=1','https://third-place.example#hash','not-a-url'])('fails closed for invalid/missing production APP_ORIGIN %s',origin=>{
  expect(()=>planningRequestPolicy(request(),{...env,APP_ORIGIN:origin})).toThrow(/origin/i);
 });
 it('keeps CLI requests without Origin supported under the same quota protections',()=>expect(planningRequestPolicy(request(),env).client).toBe('shared'));
 it('allows HTTP loopback for local production browser tests only, not public HTTP origins',()=>{
  expect(planningRequestPolicy(request({origin:'http://127.0.0.1:3000'}),{...env,APP_ORIGIN:'http://127.0.0.1:3000'}).origin).toBe('http://127.0.0.1:3000');
 });
 it('uses request URL fallback only outside production',()=>{
  expect(planningRequestPolicy(request({origin:'http://localhost:3000'}),{NODE_ENV:'development'}).origin).toBe('http://localhost:3000');
 });
});
describe('deployment-specific trusted client identities',()=>{
 it('uses only the Vercel edge identity in a Vercel environment',()=>{
  expect(planningRequestPolicy(request({'x-vercel-forwarded-for':'198.51.100.8','cf-connecting-ip':'192.0.2.9','x-forwarded-for':'203.0.113.1'}),env).client).toBe('198.51.100.8');
 });
 it('does not let client headers select Vercel trust on another runtime',()=>{
  expect(planningRequestPolicy(request({'x-vercel-forwarded-for':'198.51.100.8',vercel:'1','cf-connecting-ip':'192.0.2.9'}),{...env,VERCEL:undefined}).client).toBe('shared');
 });
 it.each(['malformed','198.51.100.8, 203.0.113.5','1'.repeat(65)])('uses a conservative shared bucket for invalid edge IP %s',ip=>expect(planningRequestPolicy(request({'x-vercel-forwarded-for':ip}),env).client).toBe('shared'));
 it('supports IPv6 edge identities',()=>expect(planningRequestPolicy(request({'x-vercel-forwarded-for':'2001:db8::1'}),env).client).toBe('2001:db8::1'));
 it('retains Cloudflare trust exclusively inside the retained Worker context',()=>{
  withReleaseContext({production:true,env:{APP_ORIGIN:env.APP_ORIGIN}},()=>expect(planningRequestPolicy(request({'cf-connecting-ip':'192.0.2.9','x-vercel-forwarded-for':'198.51.100.8'}),env).client).toBe('192.0.2.9'));
 });
});
describe('native production health is configuration-only',()=>{
 it('validates live settings with zero database or Qloo HTTP calls',async()=>{
  const fetcher=vi.fn<typeof fetch>();vi.stubGlobal('fetch',fetcher);
  const settings={NODE_ENV:'production',QLOO_MODE:'live',QLOO_API_KEY:'synthetic-qloo-key',QLOO_PUBLIC_LIVE_ENABLED:'true',QLOO_DAILY_REQUEST_LIMIT:'100',QLOO_MINUTE_REQUEST_LIMIT:'20',TURSO_DATABASE_URL:'libsql://synthetic.turso.io',TURSO_AUTH_TOKEN:'synthetic-database-token'};
  try{
   for(const [key,value]of Object.entries(settings))vi.stubEnv(key,value);
   const valid=GET();expect(valid.status).toBe(200);expect(await valid.json()).toEqual({status:'ok',mode:'live',configured:true,liveVerified:false});
   vi.stubEnv('TURSO_AUTH_TOKEN','');expect(GET().status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}
 });
});
