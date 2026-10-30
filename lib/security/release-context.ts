import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestBudgetStore } from './request-budget';

export interface ReleaseContext {
 production: boolean;
 budgetDb?: D1Database;
 budgetStore?: RequestBudgetStore;
 env?: Record<string,string|undefined>;
}
const context=new AsyncLocalStorage<ReleaseContext>();
export function withReleaseContext<T>(value:ReleaseContext,run:()=>T):T{return context.run(value,run);}
export function getReleaseContext():ReleaseContext|undefined{return context.getStore();}
