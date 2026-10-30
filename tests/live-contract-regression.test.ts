import { describe,expect,it,vi } from 'vitest';
import { LiveQlooProvider } from '../lib/qloo/live-provider';
import { runAgent,revisedVenue } from '../lib/agents/orchestrator';
import { samples } from '../data/sample-venues';

// Synthetic values only. These exercise the envelope shapes confirmed in the live check;
// no real Qloo IDs, recommendation names, or response datasets are retained here.
function fixtureTransport(){
 return vi.fn<typeof fetch>().mockImplementation(async(input)=>{
  const url=new URL(String(input));
  if(url.pathname==='/search')return Response.json({results:[{entity_id:'synthetic-artist-input',name:'Fixture Jazz Artist',types:['urn:entity','urn:entity:artist'],properties:{},popularity:.9,tags:[]}]});
  const category=url.searchParams.get('filter.type')!.replace('urn:entity:','');
  return Response.json({success:true,results:{entities:[{
   entity_id:`synthetic-${category}-recommendation`,name:`Fixture ${category} Reference`,type:'urn:entity',subtype:`urn:entity:${category}`,properties:{},popularity:.98,tags:[],
   query:{affinity:.37,measurements:{fixture:true},explainability:{fixture_signal:'synthetic-artist-input'}},
  }]},query:{explainability:{fixture_aggregate:true}}});
 });
}
const config=(fetcher:typeof fetch)=>({key:'test-only-not-a-real-key',baseUrl:'https://hackathon.api.qloo.com',fetcher});
describe('regressions for envelopes confirmed during local live verification',()=>{
 it('accepts search types with the generic class and the specific category',async()=>{
  const f=fixtureTransport();const results=await new LiveQlooProvider(config(f)).lookup('Fixture Jazz Artist');
  expect(results).toEqual([{id:'synthetic-artist-input',name:'Fixture Jazz Artist',type:'artist',source:'qloo'}]);expect(f).toHaveBeenCalledTimes(1);
 });
 it('completes three-domain planning without confusing popularity, measurements, or explanations',async()=>{
  const f=fixtureTransport(),provider=new LiveQlooProvider(config(f));
  const run=await runAgent({...samples[1],interests:['Fixture Jazz Artist']},provider);
  expect(f).toHaveBeenCalledTimes(4);expect(run.mode).toBe('live');expect(run.entities).toHaveLength(1);expect(run.evidence).toHaveLength(3);expect(run.concepts).toHaveLength(3);
  expect(new Set(run.evidence.map(e=>e.type))).toEqual(new Set(['book','artist','movie']));
  expect(run.evidence.every(e=>e.source==='qloo'&&e.score===.37&&e.explainability!==undefined)).toBe(true);
  expect(run.evidence.every(e=>e.metadata?.queryExplainability!==undefined)).toBe(true);
  for(const c of run.concepts){expect(c.evidence.every(e=>run.evidence.some(found=>found.id===e.id))).toBe(true);expect(c.activities.join(' ')).toContain(c.evidence[0].name);}
  expect(run.dna.filter(d=>d.source==='qloo')).toHaveLength(3);expect(run.warnings).toEqual([]);
 });
 it('replans costs while preserving actual adapter evidence and revision history',async()=>{
  const f=fixtureTransport(),provider=new LiveQlooProvider(config(f));
  const before=await runAgent({...samples[1],interests:['Fixture Jazz Artist']},provider);
  const after=await runAgent(revisedVenue(before.venue,'cheaper'),provider,undefined,'cheaper',before);
  expect(after.revisions).toHaveLength(1);expect(after.evidence.map(e=>e.id)).toEqual(before.evidence.map(e=>e.id));
  expect(after.concepts.every((c,i)=>c.budget.total<before.concepts[i].budget.total)).toBe(true);expect(after.trace.every(a=>!a.tool.startsWith('Mock'))).toBe(true);
 });
});
