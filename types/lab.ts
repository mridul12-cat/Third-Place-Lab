import type { VenueProfile, RefinementRequest } from '../lib/validation/venue';
export type { VenueProfile, RefinementRequest };
export type Provenance = 'user' | 'qloo' | 'mock' | 'calculation' | 'creative';
export type EntityType = 'artist' | 'book' | 'movie' | 'brand' | 'place' | 'destination' | 'tv_show';
export interface CulturalInterest { name: string; source: 'user' }
export interface ResolvedQlooEntity { id: string; name: string; type: EntityType; source: 'qloo' | 'mock' }
export interface CulturalInsight extends ResolvedQlooEntity { signals: string[]; score?: number; explainability?: unknown; metadata?: Record<string, unknown> }
export type CulturalEvidence = CulturalInsight;
export interface VenueCulturalDNA { theme: string; source: Provenance; evidenceIds: string[]; names: string[] }
export interface AgentAction { id: number; stage: number; action: string; tool: string; summary: string; decision: string; evidenceIds: string[] }
export interface BudgetEstimate { items: { label: string; amount: number }[]; total: number; source: 'calculation' }
export interface FeasibilityEvaluation { withinBudget: boolean; capacity: number; checks: string[]; source: 'calculation' }
export interface EventConcept { id: string; kind: 'story' | 'music' | 'making'; title: string; hook: string; description: string; activities: string[]; fit: string; evidence: CulturalInsight[]; interpretation: string; setup: string[]; budget: BudgetEstimate; duration: number; promotion: string; risks: string[]; evaluation: FeasibilityEvaluation; revision: number; changes: string[] }
export interface AgentRun { id: string; venue: VenueProfile; mode: 'mock' | 'live'; entities: ResolvedQlooEntity[]; evidence: CulturalInsight[]; dna: VenueCulturalDNA[]; concepts: EventConcept[]; trace: AgentAction[]; warnings: string[]; revisions: { request: RefinementRequest; at: string; changes: string[] }[] }
export interface EventBlueprint { concept: EventConcept; venue: VenueProfile; schedule: { minute: number; activity: string }[]; preparation: string[]; staffing: string; promotion: string }
export interface ProviderStatus { mode: 'mock' | 'live'; configured: boolean; liveVerified: false }
