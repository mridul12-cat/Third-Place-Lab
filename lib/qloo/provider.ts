import type { CulturalInsight, EntityType, ResolvedQlooEntity } from '../../types/lab';
export interface CulturalIntelligenceProvider {
 readonly mode: 'mock' | 'live';
 lookup(name: string, signal?: AbortSignal): Promise<ResolvedQlooEntity[]>;
 discover(seeds: ResolvedQlooEntity[], type: EntityType, signal?: AbortSignal): Promise<CulturalInsight[]>;
}
export class ProviderError extends Error {
 constructor(message: string, public status = 502) { super(message); this.name = 'ProviderError'; }
}
