import type { CulturalIntelligenceProvider } from './provider';
import type { CulturalInsight, EntityType, ResolvedQlooEntity } from '../../types/lab';

// Entirely handcrafted fiction. Themes describe this sample catalog, never Qloo findings.
interface SampleGroup {theme:string;seeds:readonly (readonly [string,EntityType])[];references:Partial<Record<EntityType,string>>}
const groups:readonly SampleGroup[] = [
 {theme:'imagination',seeds:[['Studio Ghibli','movie'],['Phoebe Bridgers','artist'],['Haruki Murakami','book']],references:{book:'The Atlas of Small Things',artist:'Juniper & the Satellites',movie:'The House of Paper Lanterns',brand:'Little Lantern Workshop'}},
 {theme:'reflection',seeds:[['Norah Jones','artist'],['Before Sunrise','movie'],['The Little Prince','book']],references:{book:'Letters from a Quiet Street',artist:'The Sunday Paper Trio',movie:'The Last Neighborhood Cinema',brand:'Sunday Paper Studio'}},
 {theme:'discovery',seeds:[['Carl Sagan','book'],['Interstellar','movie'],['Brian Eno','artist'],['The Martian','book']],references:{book:'An Imaginary Field Guide to Tomorrow',artist:'The Curious Orbit Ensemble',movie:'A Postcard from Tomorrow',brand:'Pocket Observatory Collective'}},
 {theme:'expression',seeds:[['Banksy','artist'],['Gorillaz','artist'],['Jean-Michel Basquiat','artist']],references:{book:'The Fictional Street Sketchbook',artist:'The Cardboard City Band',movie:'Colors on an Imaginary Wall',brand:'Little Paper Studio'}},
 {theme:'memory',seeds:[['R. K. Narayan','book'],['A. R. Rahman','artist'],['The Lunchbox','movie']],references:{book:'A Garden Between Pages',artist:'The Courtyard Letters',movie:'The Imaginary Neighborhood Archive',brand:'Courtyard Memory Press'}},
] as const;
const key=(name:string)=>name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const idFor=(name:string)=>`sample-input-${key(name).replace(/[^a-z0-9]+/g,'-')}`;
export class MockQlooProvider implements CulturalIntelligenceProvider {
 readonly mode='mock' as const;
 async lookup(name:string,signal?:AbortSignal):Promise<ResolvedQlooEntity[]> {
  signal?.throwIfAborted();
  if(key(name)==='dune')return [{id:'sample-ambiguous-book',name:'Dune',type:'book',source:'mock'},{id:'sample-ambiguous-movie',name:'Dune',type:'movie',source:'mock'}];
  const seed=groups.flatMap(g=>g.seeds).find(([n])=>key(n)===key(name));
  return seed?[{id:idFor(seed[0]),name:seed[0],type:seed[1],source:'mock'}]:[];
 }
 async discover(seeds:ResolvedQlooEntity[],type:EntityType,signal?:AbortSignal):Promise<CulturalInsight[]> {
  signal?.throwIfAborted();
  return groups.flatMap(group=>{
   const signals=seeds.filter(s=>group.seeds.some(([n])=>idFor(n)===s.id)).map(s=>s.id);
   const name=group.references[type];
   if(!signals.length||!name)return [];
   return [{id:`sample-${group.theme}-${type}`,name,type,source:'mock' as const,signals,metadata:{planningTheme:group.theme,notice:'Fictional demonstration connection, not a Qloo finding.'}}];
  }).slice(0,4);
 }
}
