import { describe,it,expect,vi } from 'vitest';
import { venueSchema } from '../lib/validation/venue';
import { samples } from '../data/sample-venues';
import { selectProvider } from '../lib/qloo/select';
import { MockQlooProvider } from '../lib/qloo/mock-provider';
import { runAgent,revisedVenue } from '../lib/agents/orchestrator';
import { blueprintFor,estimateBudget } from '../lib/events/planner';
import { handlePlanning,rateAllowed } from '../lib/agents/http';
const venue=samples[0];
describe('venue validation',()=>{
 it('accepts an example and trims interests',()=>expect(venueSchema.parse({...venue,interests:['  A book ']}).interests).toEqual(['A book']));
 it.each([{capacity:0},{budget:-1},{interests:[]},{name:''},{interests:Array(7).fill('x')},{capacity:201}])('rejects invalid constraints %j',patch=>expect(venueSchema.safeParse({...venue,...patch}).success).toBe(false));
});
describe('provider selection and provenance',()=>{
 it('defaults to synthetic mode',()=>expect(selectProvider({})).toBeInstanceOf(MockQlooProvider));
 it('requires live credentials and rejects invalid modes',()=>{expect(()=>selectProvider({QLOO_MODE:'live'})).toThrow('key');expect(()=>selectProvider({QLOO_MODE:'invalid'})).toThrow();});
 it('returns fictional IDs with no fabricated scores',async()=>{const run=await runAgent(venue,new MockQlooProvider());expect(run.evidence.every(e=>e.source==='mock'&&e.id.startsWith('sample-')&&e.score===undefined)).toBe(true);expect(run.dna.some(d=>d.source==='user')).toBe(true);});
});
describe('bounded agent behavior',()=>{
 it('produces three distinct activities and observable stages',async()=>{const emit=vi.fn();const run=await runAgent(venue,new MockQlooProvider(),emit);expect(new Set(run.concepts.map(c=>c.kind)).size).toBe(3);expect(new Set(run.concepts.map(c=>c.activities[1])).size).toBe(3);expect(new Set(run.trace.map(t=>t.stage)).size).toBe(5);expect(emit).toHaveBeenCalledTimes(run.trace.length);});
 it('rejects ambiguous matches and discloses unsupported evidence',async()=>{const p=new MockQlooProvider();p.lookup=async n=>[{id:'one',name:n,type:'book',source:'mock'},{id:'two',name:n,type:'book',source:'mock'}];const discover=vi.spyOn(p,'discover');const run=await runAgent(venue,p);expect(run.entities).toHaveLength(0);expect(discover).not.toHaveBeenCalled();expect(run.warnings).toHaveLength(4);expect(run.concepts[0].evidence).toEqual([]);});
 it('broadens empty results exactly once and stops',async()=>{const p=new MockQlooProvider();const discover=vi.spyOn(p,'discover').mockResolvedValue([]);const run=await runAgent(venue,p);expect(discover).toHaveBeenCalledTimes(4);expect(run.trace.some(a=>a.action==='Broaden sparse research')).toBe(true);});
 it('changes queried categories for a cultural direction revision',async()=>{const p=new MockQlooProvider();const discover=vi.spyOn(p,'discover');await runAgent(venue,p,undefined,'direction');expect(discover.mock.calls.map(c=>c[1])).toEqual(['movie','brand','book']);});
});
describe('budgets, feasibility and refinements',()=>{
 it('uses exact arithmetic, respects ceilings and group size',()=>{for(const kind of ['story','music','making'] as const){const b=estimateBudget(venue,kind);expect(b.total).toBe(b.items.reduce((s,i)=>s+i.amount,0));expect(b.total).toBeLessThanOrEqual(venue.budget);expect(estimateBudget({...venue,capacity:10},kind).total).toBeLessThan(b.total);expect(estimateBudget({...venue,budget:100},kind).total).toBe(100);}});
 it('makes all three ideas materially cheaper',async()=>{const p=new MockQlooProvider(),before=await runAgent(venue,p),after=await runAgent(revisedVenue(venue,'cheaper'),p,undefined,'cheaper',before);after.concepts.forEach((c,i)=>{expect(c.budget.total).toBeLessThan(before.concepts[i].budget.total);expect(c.evaluation.withinBudget).toBe(true);});});
 it('changes capacity within maximum and recalculates costs',()=>{const intimate=revisedVenue(venue,'intimate');expect(intimate.capacity).toBe(15);expect(revisedVenue(intimate,'larger',venue.capacity).capacity).toBe(21);expect(revisedVenue(venue,'larger',venue.capacity).capacity).toBe(24);});
 it('changes family timing and surprise activities',async()=>{const base=await runAgent(venue,new MockQlooProvider());const family=await runAgent(venue,new MockQlooProvider(),undefined,'family',base);expect(family.concepts[0].duration).toBeLessThan(base.concepts[0].duration);expect(family.concepts[0].activities[0]).toContain('caregiver');const surprise=await runAgent(venue,new MockQlooProvider(),undefined,'surprise',family);expect(surprise.concepts[0].activities[1]).not.toBe(base.concepts[0].activities[1]);expect(surprise.revisions).toHaveLength(2);});
 it('exports a complete schedule ending before the event duration',async()=>{const run=await runAgent(venue,new MockQlooProvider());const b=blueprintFor(run.concepts[0],venue);expect(b.schedule).toHaveLength(5);expect(b.schedule.at(-1)!.minute).toBeLessThan(b.concept.duration);expect(b.staffing).toContain('facilitator');expect(b.preparation.length).toBeGreaterThan(4);});
});
describe('server boundary',()=>{
 it('rejects invalid and oversized requests',async()=>{expect((await handlePlanning(new Request('https://lab.test/api/events',{method:'POST',body:'{}'}))).status).toBe(400);expect((await handlePlanning(new Request('https://lab.test/api/events',{method:'POST',headers:{'content-length':'20000'},body:'{}'}))).status).toBe(413);});
 it('blocks cross-origin requests',async()=>expect((await handlePlanning(new Request('https://lab.test/api/events',{method:'POST',headers:{origin:'https://other.test'},body:JSON.stringify({venue})}))).status).toBe(403));
 it('streams real actions then a complete result',async()=>{const r=await handlePlanning(new Request('https://lab.test/api/events',{method:'POST',headers:{'cf-connecting-ip':'test-success'},body:JSON.stringify({venue})}));const messages=(await r.text()).trim().split('\n').map(l=>JSON.parse(l));expect(messages.at(-1).run.concepts).toHaveLength(3);expect(messages[0].type).toBe('progress');expect(messages.at(-1).run.mode).toBe('mock');});
 it('limits repeated requests and resets',()=>{for(let i=0;i<8;i++)expect(rateAllowed('test-limit',1000)).toBe(true);expect(rateAllowed('test-limit',1000)).toBe(false);expect(rateAllowed('test-limit',62000)).toBe(true);});
});
