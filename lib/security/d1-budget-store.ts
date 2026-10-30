import type { RequestBudgetStore } from './request-budget';
import { RESERVE_QLOO_REQUEST } from './qloo-budget';

/** Retained for the explicitly selected Sites rollback entry point. */
export function d1BudgetStore(db:D1Database):RequestBudgetStore {
 return {async reserve(limits,signal){
  signal?.throwIfAborted();
  const row=await db.prepare(RESERVE_QLOO_REQUEST).bind(limits.daily,limits.perMinute).first<{id:string}>();
  return row?.id==='qloo';
 }};
}
