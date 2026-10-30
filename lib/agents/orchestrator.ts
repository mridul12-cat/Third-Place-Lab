import { venueSchema } from '../validation/venue';
import { ProviderError, type CulturalIntelligenceProvider } from '../qloo/provider';
import type { AgentAction, AgentRun, CulturalInsight, EntityType, RefinementRequest, ResolvedQlooEntity, VenueCulturalDNA, VenueProfile } from '../../types/lab';
import { planConcepts } from '../events/planner';
import { interpretConstraints } from '../events/constraints';

export type PreviousPlan = Pick<AgentRun,'revisions'> & Partial<Pick<AgentRun,'venue'>>;
const canonical=(name:string)=>name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export async function runAgent(input:VenueProfile,provider:CulturalIntelligenceProvider,emit?:(action:AgentAction)=>void,request?:RefinementRequest,previous?:PreviousPlan,signal?:AbortSignal):Promise<AgentRun> {
 const venue=venueSchema.parse(input),trace:AgentAction[]=[],warnings:string[]=[];
 const effectiveRequest=request??(previous?'context':undefined),history=previous?.revisions??[];
 if(history.length+(effectiveRequest?1:0)>20)throw new ProviderError('This session has reached 20 refinements. Start a new plan.',400);
 const rules=interpretConstraints(venue);
 if(rules.maxGuests&&venue.capacity>rules.maxGuests){warnings.push(`The written operational constraint limits this plan to ${rules.maxGuests} people instead of ${venue.capacity}.`);venue.capacity=rules.maxGuests;}
 const act=(stage:number,action:string,tool:string,summary:string,decision:string,evidenceIds:string[]=[])=>{signal?.throwIfAborted();const a={id:trace.length+1,stage,action,tool,summary,decision,evidenceIds};trace.push(a);emit?.(a);};
 const call=async<T>(tool:string,operation:()=>Promise<T>)=>{signal?.throwIfAborted();try{const result=await operation();signal?.throwIfAborted();return result;}catch(error){if(!signal?.aborted)act(1,'Tool call failed',tool,error instanceof ProviderError?error.message:'The tool did not finish.','Stop without replacing failed research with fictional data.');throw error;}};
 act(0,'Understand the space','context',`${venue.name}: ${venue.capacity} seats, INR ${venue.budget} ceiling.`,`Reevaluate ${venue.atmosphere.toLowerCase()} delivery and the supplied operational constraints.`);
 const entities:ResolvedQlooEntity[]=[];
 for(const name of venue.interests){
  const tool=provider.mode==='mock'?'MockQloo.lookup':'Qloo /search';
  const results=await call(tool,()=>provider.lookup(name,signal));
  const exact=results.filter(e=>canonical(e.name)===canonical(name));
  const match=exact.length===1&&exact[0].source===(provider.mode==='live'?'qloo':'mock')?exact[0]:undefined;
  if(match){if(!entities.some(e=>e.id===match.id))entities.push(match);}else warnings.push(`“${name}” was not uniquely resolved. Try a more specific title or artist name.`);
  act(1,'Resolve cultural interest',tool,`${name}: ${match?'one exact name match accepted':'no unambiguous match'}.`,match?'Use the resolved entity as a research signal.':'Exclude this ambiguous signal; retain the owner input separately.',match?[match.id]:[]);
 }
 const evidence:CulturalInsight[]=[],requests=[...history.map(h=>h.request),...(effectiveRequest?[effectiveRequest]:[])];
 const categories:EntityType[]=requests.includes('direction')?['movie','brand','book']:venue.format==='Listening session'?['artist','movie','book']:['book','artist','movie'];
 const discover=async(type:EntityType,broaden=false)=>{
  const tool=provider.mode==='mock'?'MockQloo.discover':'Qloo /v2/insights';
  const found=await call(tool,()=>provider.discover(entities,type,signal));
  const accepted=found.filter(e=>e.source===(provider.mode==='live'?'qloo':'mock')&&e.type===type&&e.signals.length>0&&e.signals.every(id=>entities.some(s=>s.id===id)));
  for(const e of accepted)if(!evidence.some(existing=>existing.id===e.id))evidence.push(e);
  if(accepted.length<found.length)warnings.push(`Excluded ${found.length-accepted.length} ${type} results with incompatible provenance, category, or input signals.`);
  act(1,broaden?'Broaden sparse research':'Explore cross-domain connections',tool,`${found.length} ${type} references returned; ${accepted.length} accepted.`,accepted.length?'Preserve verified provenance and use these as creative starting points.':broaden?'Stop after this bounded fourth discovery query.':'Try the next cultural domain.',accepted.map(e=>e.id));
 };
 for(const type of categories){if(!entities.length)break;await discover(type);}
 if(entities.length&&!evidence.length)await discover(categories.includes('brand')?'artist':'brand',true);
 if(!evidence.length)warnings.push('No cultural recommendations available. Concepts use owner inputs and venue-based templates only.');
 act(2,'Plan three different gatherings','planner',`${evidence.length} references available; choose conversation, listening, and making.`,`Generate distinct activity mechanisms${effectiveRequest?` for the ${effectiveRequest} revision`:''}.`,evidence.map(e=>e.id));
 const concepts=planConcepts(venue,evidence,history.length+(effectiveRequest?1:0),effectiveRequest,history.map(h=>h.request));
 // These are actual rule outputs, not a claim of universal access compliance or verified prices.
 act(3,'Evaluate practical constraints','evaluator',`3 budgets checked; ${concepts.filter(c=>c.evaluation.withinBudget).length} fit the ceiling.`,`${rules.silent?'Selected silent delivery. ':''}${rules.noRefreshments?'Removed refreshments and recalculated costs. ':''}Group delivery, format, duration, and access preparation have been evaluated; full host review remains required.`);
 const changes=[...new Set(concepts.flatMap(c=>c.changes))];
 if(effectiveRequest==='cheaper'&&previous?.venue?.budget===venue.budget)changes.splice(0,changes.length,'The budget is already at the supported INR 100 minimum. No further reduction was applied; resources were reevaluated.');
 if(effectiveRequest==='larger'&&previous?.venue?.capacity===venue.capacity)changes.splice(0,changes.length,'No group-size increase was applied because the venue or written capacity ceiling was reached.');
 if(effectiveRequest&&history.some(h=>h.request===effectiveRequest)&&!['cheaper','intimate','larger','context'].includes(effectiveRequest))changes.splice(0,changes.length,`Reevaluated the existing ${effectiveRequest} adaptation using fresh provider results; earlier constraints remain active.`);
 if(previous?.venue){for(const key of ['budget','capacity','atmosphere','format','constraints','interests'] as const)if(JSON.stringify(previous.venue[key])!==JSON.stringify(venue[key]))changes.push(`Replanned after changing ${key}.`);}
 for(const c of concepts)c.changes=[...changes];
 const dna:VenueCulturalDNA[]=Array.from(new Set(evidence.map(e=>e.type))).map(type=>({theme:type==='book'?'Stories & belonging':type==='artist'?'Music & connection':type==='movie'?'Cinema & imagination':'Creative discovery',source:provider.mode==='live'?'qloo':'mock',evidenceIds:evidence.filter(e=>e.type===type).map(e=>e.id),names:evidence.filter(e=>e.type===type).map(e=>e.name)}));
 dna.push({theme:venue.atmosphere,source:'user',evidenceIds:[],names:[`Owner preference: ${venue.atmosphere}`]});
 act(4,'Prepare the concepts','finalize','Three concepts ready with evidence, estimates, and limitations.','Offer owner refinement and an editable event blueprint.');
 return {id:crypto.randomUUID(),venue,mode:provider.mode,entities,evidence,dna,concepts,trace,warnings,revisions:[...history,...(effectiveRequest?[{request:effectiveRequest,at:new Date().toISOString(),changes}]:[])]};
}
export function revisedVenue(venue:VenueProfile,request:RefinementRequest,maximumCapacity=venue.capacity):VenueProfile {
 const next={...venue,budget:request==='cheaper'?Math.max(100,Math.floor(Math.min(venue.budget,350+venue.capacity*18)*.6)):venue.budget,capacity:request==='intimate'?Math.max(2,Math.floor(venue.capacity*.65)):request==='larger'?Math.min(maximumCapacity,Math.ceil(venue.capacity*1.4)):venue.capacity,atmosphere:request==='intimate'?'Slow & cozy' as const:venue.atmosphere};
 return venueSchema.parse(next);
}
