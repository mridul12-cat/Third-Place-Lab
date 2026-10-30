import { describe, it, expect, vi } from 'vitest';
import { auditVenues } from './fixtures/audit-venues';
import { MockQlooProvider } from '../lib/qloo/mock-provider';
import { runAgent, revisedVenue } from '../lib/agents/orchestrator';
import { blueprintFor } from '../lib/events/planner';

describe('five-venue pre-API behavior audit',()=>{
 it.each(auditVenues)('$name: uses returned evidence in activities, respects bounds, and records actual tools',async venue=>{
  const provider=new MockQlooProvider();const lookup=vi.spyOn(provider,'lookup'),discover=vi.spyOn(provider,'discover');
  const run=await runAgent(venue,provider);
  expect(run.concepts).toHaveLength(3);
  expect(run.trace.filter(a=>a.action==='Resolve cultural interest')).toHaveLength(lookup.mock.calls.length);
  expect(run.trace.filter(a=>a.action==='Explore cross-domain connections')).toHaveLength(discover.mock.calls.length);
  for(const c of run.concepts){
   expect(c.budget.total).toBeLessThanOrEqual(venue.budget);expect(c.evaluation.capacity).toBeLessThanOrEqual(venue.capacity);
   expect(c.budget.items.reduce((n,i)=>n+i.amount,0)).toBe(c.budget.total);
   expect(c.evidence.every(e=>run.evidence.some(r=>r.id===e.id))).toBe(true);
   expect(c.evidence.some(e=>c.activities.some(a=>a.includes(e.name)))).toBe(true);
   const b=blueprintFor(c,venue);for(const a of c.activities)expect(b.schedule.some(s=>s.activity===a)).toBe(true);
  }
 });
 it('changes the activity mechanism when only interests change',async()=>{
  const activitySets=[];
  for(const {interests} of auditVenues){const run=await runAgent({...auditVenues[0],interests},new MockQlooProvider());
   // Strip evidence titles: differences must go beyond changing names in a template.
   activitySets.push(JSON.stringify(run.concepts.map(c=>c.activities.map(a=>c.evidence.reduce((s,e)=>s.replaceAll(e.name,'[reference]'),a)))));
  }
  expect(new Set(activitySets).size).toBe(5);
 });
 it('handles unknown and ambiguous names honestly',async()=>{
  const run=await runAgent({...auditVenues[0],interests:['Definitely Not A Known Cultural Entity','Dune']},new MockQlooProvider());
  expect(run.entities).toHaveLength(0);expect(run.evidence).toHaveLength(0);expect(run.warnings.length).toBeGreaterThan(0);
 });
 it('a no-audio and no-food constraint materially changes the plan and budget',async()=>{
  const venue={...auditVenues[1],constraints:'No audio playback. No amplified sound. No food or refreshments. Wheelchair access and large-print written participation required.'};
  const run=await runAgent(venue,new MockQlooProvider());
  const music=run.concepts.find(c=>c.kind==='music')!;
  expect(music.activities.join(' ')).toMatch(/silent|written/i);expect(music.setup.join(' ')).not.toMatch(/Existing speakers/);
  expect(music.budget.items.find(i=>i.label==='Tea & light refreshments')?.amount).toBe(0);
 });
 it('a 70% cut changes resources and activity delivery',async()=>{
  const before=await runAgent({...auditVenues[1],budget:1000},new MockQlooProvider());
  const after=await runAgent({...before.venue,budget:300},new MockQlooProvider(),undefined,undefined,before);
  for(let i=0;i<3;i++){expect(after.concepts[i].budget.total).toBeLessThanOrEqual(300);expect(after.concepts[i].activities).not.toEqual(before.concepts[i].activities);}
 });
 it('a capacity increase changes facilitation, not only numbers',async()=>{
  const before=await runAgent({...auditVenues[1],capacity:8},new MockQlooProvider());
  const after=await runAgent({...before.venue,capacity:100},new MockQlooProvider(),undefined,undefined,before);
  expect(after.concepts[0].activities).not.toEqual(before.concepts[0].activities);expect(blueprintFor(after.concepts[0],after.venue).staffing).not.toBe(blueprintFor(before.concepts[0],before.venue).staffing);
 });
 it('changing atmosphere changes activity delivery and timing',async()=>{
  const before=await runAgent(auditVenues[0],new MockQlooProvider());
  const after=await runAgent({...before.venue,atmosphere:'Lively & social'},new MockQlooProvider(),undefined,undefined,before);
  expect(after.concepts[0].activities).not.toEqual(before.concepts[0].activities);expect(after.concepts[0].duration).not.toBe(before.concepts[0].duration);
 });
 it('three consecutive refinements retain family adaptations and complete schedules',async()=>{
  const p=new MockQlooProvider();let run=await runAgent(auditVenues[1],p);
  for(const request of ['family','cheaper','direction'] as const)run=await runAgent(revisedVenue(run.venue,request),p,undefined,request,run);
  expect(run.revisions).toHaveLength(3);
  for(const c of run.concepts){expect(c.activities.join(' ')).toMatch(/caregiver|family/i);expect(c.duration).toBeLessThanOrEqual(75);expect(blueprintFor(c,run.venue).schedule.map(s=>s.activity)).toEqual(expect.arrayContaining(c.activities));}
 });
});

describe('grounding and constraint edge cases',()=>{
 it('adapts a difficult combined constraint without claiming host requirements are certified',async()=>{
  const run=await runAgent({...auditVenues[1],constraints:'No audio playback; no paper or pens; no projector; wheelchair access. A tactile communication interpreter must be arranged. Maximum 45 minutes.'},new MockQlooProvider());
  for(const c of run.concepts){expect(c.duration).toBeLessThanOrEqual(45);expect(c.setup.join(' ')).not.toContain('Existing speakers');expect(c.activities.join(' ')).toMatch(/nonverbal object-based/);expect(c.risks.join(' ')).toMatch(/communication method/);expect(c.evaluation.checks.join(' ')).toContain('Unverified: host');}
 });
 it('never offers refreshments as optional when the owner disallows them',async()=>{
  const run=await runAgent({...auditVenues[3],budget:100,constraints:'No food or refreshments.'},new MockQlooProvider());
  for(const c of run.concepts){expect(c.activities.join(' ')).not.toMatch(/refreshments (are )?optional/);expect(c.hook).not.toContain('warm cup');expect(c.budget.items.find(i=>i.label.includes('refreshments'))!.amount).toBe(0);}
 });
 it('honors an explicit capacity limit in operational constraints',async()=>{
  const run=await runAgent({...auditVenues[2],constraints:'Maximum 12 guests. Step-free access.'},new MockQlooProvider());
  expect(run.venue.capacity).toBe(12);expect(run.concepts.every(c=>c.evaluation.capacity===12)).toBe(true);expect(run.warnings.join(' ')).toContain('12 people');
 });
 it.each([1,5,30])('includes all activities within a %i-minute hard limit',async limit=>{
  const run=await runAgent({...auditVenues[0],constraints:`Maximum ${limit} minutes.`},new MockQlooProvider());
  for(const c of run.concepts){expect(c.duration).toBe(limit);const b=blueprintFor(c,run.venue);expect(b.schedule.every(s=>s.minute<c.duration)).toBe(true);expect(b.schedule.map(s=>s.minute)).toEqual([...b.schedule.map(s=>s.minute)].sort((a,b)=>a-b));}
 });
 it('does not misattribute a fallback domain to the preferred category',async()=>{
  const p=new MockQlooProvider();const original=p.discover.bind(p);vi.spyOn(p,'discover').mockImplementation((seeds,type,signal)=>type==='book'?original(seeds,type,signal):Promise.resolve([]));
  const run=await runAgent(auditVenues[1],p);expect(run.concepts[1].evidence[0].type).toBe('book');expect(run.concepts[1].interpretation).toContain('returned book reference');
 });
 it('excludes ungrounded provider results and counts the actual broader call',async()=>{
  const p=new MockQlooProvider();const discover=vi.spyOn(p,'discover').mockResolvedValue([{id:'synthetic-bad',name:'Unsupported fixture',type:'book',source:'mock',signals:['unresolved-seed']}]);
  const run=await runAgent(auditVenues[0],p);expect(run.evidence).toEqual([]);expect(discover).toHaveBeenCalledTimes(4);expect(run.trace.filter(a=>a.tool==='MockQloo.discover')).toHaveLength(4);expect(run.warnings.join(' ')).toMatch(/Excluded/);
 });
 it('reevaluates entirely new cultural inputs and returns a new evidence domain on direction refinement',async()=>{
  const before=await runAgent(auditVenues[0],new MockQlooProvider());const after=await runAgent({...before.venue,interests:auditVenues[3].interests},new MockQlooProvider(),undefined,'direction',before);
  expect(after.concepts[1].evidence[0].type).toBe('brand');expect(after.evidence.every(e=>!before.evidence.some(old=>old.id===e.id))).toBe(true);expect(after.concepts.every((c,i)=>c.activities[1]!==before.concepts[i].activities[1])).toBe(true);
 });
 it('discloses no-op refinements at budget and capacity limits',async()=>{
  const p=new MockQlooProvider(),venue={...auditVenues[0],budget:100};const before=await runAgent(venue,p);
  const cheaper=await runAgent(revisedVenue(before.venue,'cheaper'),p,undefined,'cheaper',before);expect(cheaper.concepts[0].changes.join(' ')).toContain('No further reduction');
  const larger=await runAgent(revisedVenue(before.venue,'larger'),p,undefined,'larger',before);expect(larger.concepts[0].changes.join(' ')).toContain('No group-size increase');
 });
});
