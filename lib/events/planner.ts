import type { BudgetEstimate, CulturalInsight, EventBlueprint, EventConcept, RefinementRequest, VenueProfile } from '../../types/lab';
import { groupPlan, interpretConstraints } from './constraints';

const templates=[
 {kind:'story' as const,title:'Between the Pages',hook:'A good story. A warm cup. A little less distance between strangers.',duration:90},
 {kind:'music' as const,title:'The Slow Sunday Listening Club',hook:'Let the music start the conversation.',duration:75},
 {kind:'making' as const,title:'Little Things, Made Together',hook:'Make something small. Leave with something that matters.',duration:120},
];
const directions={
 imagination:['Build an imaginary neighborhood through a chain of short story contributions','Trade imaginary soundtrack scenes, then connect them into a shared journey','Make a fold-out map of an imaginary place to belong'],
 reflection:['Exchange anonymous reflection prompts, then discuss one in pairs','Compare two personal responses to a listening prompt without ranking them','Create a private postcard to your future self, with optional sharing'],
 discovery:['Sort question cards into a collective field guide and test a shared story hypothesis','Compare rhythm patterns and build a shared listening observation chart','Prototype a paper invention and invite others to test its idea'],
 expression:['Remix a story from different viewpoints in a collaborative word collage','Trade musical motifs as drawn symbols and co-create a community score','Create a collaborative neighborhood zine from individual visual contributions'],
 memory:['Assemble a neighborhood oral-history timeline from voluntary contributions','Exchange music-linked memories and arrange them into a collective timeline','Create a neighborhood memory archive using postcards and place markers'],
 connection:['Exchange cultural recommendations and explain one personal connection','Compare personal responses to a cultural reference in small groups','Create a community recommendation wall from individual contributions'],
} as const;
function creativeTheme(evidence:CulturalInsight[]):keyof typeof directions {
 // Sample catalog themes are synthetic evidence. Live-name interpretation is local creative logic.
 const sample=evidence.find(e=>e.source==='mock'&&typeof e.metadata?.planningTheme==='string')?.metadata?.planningTheme;
 if(typeof sample==='string'&&sample in directions)return sample as keyof typeof directions;
 const names=evidence.map(e=>e.name).join(' ').toLowerCase();
 if(/space|atlas|cosmos|science|tomorrow/.test(names))return 'discovery';
 if(/memory|archive|garden/.test(names))return 'memory';
 if(/dream|lantern|imaginar/.test(names))return 'imagination';
 return 'connection';
}
export function estimateBudget(venue:VenueProfile,kind:EventConcept['kind']):BudgetEstimate {
 const noFood=interpretConstraints(venue).noRefreshments;
 const perPerson=kind==='making'?32:kind==='music'?18:22;
 const total=Math.min(venue.budget,Math.round((350+venue.capacity*perPerson)*(noFood ? 0.6 : 1)));
 const materials=Math.round(total*(noFood ? 0.54 : 0.32)),refreshments=noFood?0:Math.round(total*.4),access=Math.round(total*(noFood ? 0.27 : 0.16));
 return {items:[{label:'Materials & activity supplies',amount:materials},{label:'Tea & light refreshments',amount:refreshments},{label:'Access & preparation',amount:access},{label:'Contingency',amount:total-materials-refreshments-access}],total,source:'calculation'};
}
export function planConcepts(venue:VenueProfile,evidence:CulturalInsight[],revision=0,request?:RefinementRequest,history:RefinementRequest[]=[]):EventConcept[] {
 const rules=interpretConstraints(venue),groups=groupPlan(venue),requests=[...history,...(request?[request]:[])];
 const family=requests.includes('family'),direction=requests.includes('direction'),surprise=requests.includes('surprise');
 return templates.map((t,i)=>{
  const preferred=t.kind==='story'?'book':t.kind==='music'?(direction?'brand':'artist'):'movie';
  const matching=evidence.filter(e=>e.type===preferred);const used=(matching.length?matching:evidence).slice(0,2);
  const actualDomain=used[0]?.type??'owner-supplied';const theme=creativeTheme(used),reference=used[0]?.name??venue.interests[0];
  const budget=estimateBudget(venue,t.kind),standard=350+venue.capacity*(t.kind==='making'?32:t.kind==='music'?18:22);
  const lean=budget.total<standard*(rules.noRefreshments ? 0.6 : 1);
  const refreshments=rules.noRefreshments?'no refreshments will be served':'refreshments are optional';
  const resourceMode=budget.total/venue.capacity<20?`Use owner-supplied objects and reusable verbal prompts; ${refreshments} and no purchased take-home supplies are assumed`:lean?`Borrow materials, reuse existing equipment; ${refreshments}`:'Prepare reusable prompt sets and optional take-home contributions';
  const atmosphere=venue.atmosphere==='Slow & cozy'?'Begin with quiet individual reflection; invite voluntary paired sharing':venue.atmosphere==='Playful & creative'?'Begin with a playful prompt-building exercise in small teams':'Begin with timed opt-in introductions and rotating neighbor exchanges';
  let mechanism=directions[theme][i] as string;
  if(venue.format==='Conversation')mechanism=`Discuss how to ${mechanism.charAt(0).toLowerCase()+mechanism.slice(1)}, without requiring a physical artifact`;
  if(direction)mechanism=['Use a cultural object to build a collaborative neighborhood story instead of a book discussion','Translate a brand reference into a community sound-map concept instead of a standard listening round','Turn a film reference into a collaborative neighborhood storyboard instead of individual postcards'][i];
  if(surprise)mechanism=['Build a choose-your-own neighborhood story through a round-robin exchange','Co-create a community soundtrack map with opt-in personal annotations','Create a collaborative imaginary museum with object labels and guided swaps'][i];
  const format=venue.format==='Conversation'?'Deliver the central activity as a facilitated conversation with optional spoken or written responses':venue.format==='Listening session'?'Use short listening or spoken-reference segments with reflection between each':venue.format==='Creative workshop'?'Deliver the central activity as a guided hands-on workshop with a host demonstration':'Let the host alternate individual participation and small-group sharing';
  let activities=[`${family?'A caregiver-and-family welcome with optional individual participation. ':''}${atmosphere}; arrange ${groups.delivery}.`,`${mechanism}. Creative starting reference: ${reference}. ${format}. ${resourceMode}.`,`${t.kind==='story'?'Exchange a personal recommendation':t.kind==='music'?'Share a voluntary listening reflection':'Offer an optional show-and-tell'} and leave a community invitation for next time.`];
  const setup=['Seated work or discussion areas with clear wheelchair routes and a quiet corner',`Reusable activity prompts, large-print instructions, and optional ${rules.silent?'nonverbal':rules.noWriting?'spoken or host-assisted':'written or spoken'} responses`,rules.noRefreshments?'No food or refreshments; preserve access routes':'Optional refreshments with ingredient labels; confirm dietary needs',`Prepare ${groups.groups} activity group${groups.groups===1?'':'s'}; confirm a host for each station`];
  if(t.kind==='music'&&!rules.silent)setup.push('Existing speakers at conversation-friendly volume; use only permitted audio or spoken prompts');
  if(rules.silent){activities=activities.map(a=>a.replace(/listening or spoken-reference segments/g,'silent visual-reference segments').replace(/listening reflection/g,'written reflection').replace(/spoken or written/g,'written or nonverbal').replace(/verbal prompts/g,'visual prompts'));
   activities[1]+=' Silent adaptation: no audio playback or amplified sound; use '+(rules.noWriting?'nonverbal object-based':'written or visual')+' music associations with no performance required.';setup.push('Silent delivery only; all instructions available in a written or visual form');}
  if(rules.largePrint){activities[1]+=' Offer large-print prompts and a host-supported response option.';setup.push('Prepare high-contrast large-print prompts; confirm individual access needs with guests');}
  if(rules.seated)activities[1]+=' All roles can be completed seated; rotate prompts rather than requiring guests to move.';
  if(rules.noScreen){activities[1]+=' Use physical reference prompts without a projector or screen.';setup.push('No screen or projector required');}
  if(rules.noWriting){activities=activities.map(a=>a.replace(/paper invention/g,'reusable-object arrangement').replace(/mini zine|zine|postcard|word collage/g,'reusable-object display').replace(/written or nonverbal/g,'nonverbal host-supported').replace(/written or spoken/g,'spoken or host-supported').replace(/written reflection/g,'host-supported reflection'));
   activities[1]+=' No paper, pens, or independent writing required: use reusable objects or host-assisted responses.';setup.push('Offer reusable objects and host-assisted response methods instead of paper or pens');}
  if(venue.constraints)setup.push(`Host must verify the full constraint: ${venue.constraints}`);
  const baseDuration=t.duration+(venue.atmosphere==='Slow & cozy'?15:venue.atmosphere==='Lively & social'?-15:0)+(groups.groups>4?15:0);
  const duration=Math.min(family?75:180,rules.maxDuration??180,Math.max(30,baseDuration));
  const title=family?`${t.title}: All Ages Edition`:direction||surprise?['The Neighborhood Story Exchange','Postcards in Stereo','A Map of Our Little World'][i]:t.title;
  const noEvidence=!used.length;
  const risks=[...(lean?[`Reduced-resource plan: borrow supplies, ${rules.noRefreshments?'omit refreshments':'make refreshments optional'}, and confirm volunteer availability. The estimate may omit actual labor or rights fees.`]:[]),...(family?['Family-friendly describes the activity format, not verified age suitability of every cultural reference. The host must review all material.']:[]),'Illustrative INR estimates; confirm local quotes and any licensing fees before booking.','Obtain permission before using copyrighted works; cultural inspiration does not include rights clearance.',...(venue.constraints?[`Constraint interpretation uses a limited rule set, not an accessibility certification. Host review required for all of: ${venue.constraints}`]:['Confirm step-free access, seating, dietary needs, and sensory comfort.']),...(rules.silent&&rules.noWriting?['Combined no-audio and no-writing requirements need an agreed nonverbal communication method and suitable host support before the event can be confirmed.']:[]),...(duration<30?['This short time limit requires host review; simplify the activity and confirm it can fit.']:[])];
  const checks=[`Planned for ${venue.capacity} people; never exceed venue or fire limits.`,`INR ${budget.total} within INR ${venue.budget} ceiling.`,`Delivery: ${groups.delivery}.`,`Atmosphere changes introductions and timing: ${venue.atmosphere}.`,...(venue.format!=='Open to possibilities'?[`Hosting adapted to ${venue.format.toLowerCase()}.`]:[]),...(rules.silent?['Audio disabled; silent written/visual alternative selected.']:[]),...(rules.noRefreshments?['Refreshments disabled and budget line set to zero.']:[]),...(rules.largePrint?['Large-print preparation added.']:[]),...(venue.constraints?['Unverified: host must confirm the full free-text constraint and access requirements.']:[])];
  const hook=rules.noRefreshments&&t.kind==='story'?'A good story. A shared moment. A little less distance between strangers.':rules.silent&&t.kind==='music'?'Let shared memories of music start the conversation.':t.hook;
  return {id:t.kind,kind:t.kind,title,hook,description:`Turn ${venue.name} into a ${venue.atmosphere.toLowerCase()} gathering for up to ${venue.capacity} people. ${noEvidence?'No cultural recommendations resolved; this is an owner-input template.':`Use ${used.map(e=>e.name).join(' and ')} as references for ${mechanism.toLowerCase()}.`} The owner describes the space as: ${venue.personality} Participation is optional.`,activities,fit:`Designed around the owner's audience description: ${venue.audience}`,evidence:used,interpretation:noEvidence?'No recommendation evidence was returned. This is a transparent venue-based template using your supplied interests.':`The returned ${actualDomain} reference informed the central activity. The ${theme} activity direction is a local creative interpretation${used.some(e=>e.source==='mock')?' of fictional sample evidence':''}, not API explainability or a prediction of attendance.`,setup,budget,duration,promotion:`A little reason to gather. Join ${venue.name} for ${title}: ${hook} Up to ${venue.capacity} places; ask us about access needs.`,risks,evaluation:{withinBudget:budget.total<=venue.budget,capacity:venue.capacity,checks,source:'calculation'},revision,changes:request?[request==='cheaper'?'Reduced the budget ceiling and scaled supplies and refreshments.':request==='intimate'?'Reevaluated group size, seated-circle delivery, and per-person supplies.':request==='larger'?'Reevaluated group size within the venue maximum, station delivery, and per-person supplies.':request==='family'?'Added caregiver participation and shortened the schedule.':request==='context'?'Reevaluated the supplied budget, capacity, atmosphere, format, and operational constraints.':'Changed the central activity and cultural research direction.']:[]};
 });
}
export function blueprintFor(concept:EventConcept,venue:VenueProfile):EventBlueprint {
 const minute=(fraction:number)=>Math.round(concept.duration*fraction*100)/100;
 const schedule=[{minute:0,activity:'Welcome, access check, and gentle introductions'},...concept.activities.map((activity,i)=>({minute:minute(0.1+i*0.65/Math.max(1,concept.activities.length-1)),activity})),{minute:minute(0.95),activity:'Closing reflection, feedback, and an invitation to return'}];
 const groups=groupPlan(venue).groups;
 return {concept,venue,schedule,preparation:['One week before: confirm access, materials, permissions, and local prices.','Three days before: publish the invitation and collect access requests.','One hour before: arrange clear routes, brief hosts, and prepare the quiet area.',...concept.setup],staffing:groups===1?'One facilitator plus one welcome and access helper.':`One facilitator, ${groups} station helpers, and one welcome/access helper; confirm volunteer availability and any actual staffing costs.`,promotion:concept.promotion};
}
