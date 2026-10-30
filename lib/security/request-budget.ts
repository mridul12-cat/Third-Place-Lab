/** Shared durable allowance, independent of the hosting/runtime database API. */
export interface RequestBudgetLimits { daily: number; perMinute: number }
export interface RequestBudgetStore {
  /** Atomically reserve both UTC windows using database time. No refund on failure. */
  reserve(limits: RequestBudgetLimits, signal?: AbortSignal): Promise<boolean>;
}
