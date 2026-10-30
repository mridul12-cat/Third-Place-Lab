import 'server-only';
import { MockQlooProvider } from './mock-provider';
import { LiveQlooProvider, type LiveConfig } from './live-provider';
import { ProviderError } from './provider';
import { getReleaseContext } from '../security/release-context';
import { productionRequestGuard } from '../security/qloo-budget';
import { d1BudgetStore } from '../security/d1-budget-store';
import { tursoBudgetStore } from '../security/turso-budget-store';

export function qlooEnvironment(env:Record<string,string|undefined>=process.env){return getReleaseContext()?.env??env;}
export function selectProvider(env:Record<string,string|undefined>=process.env) {
 const config=qlooEnvironment(env),mode=config.QLOO_MODE??'mock';
 if(mode==='mock')return new MockQlooProvider();
 if(mode!=='live')throw new ProviderError('QLOO_MODE must be mock or live.',503);
 const release=getReleaseContext();
 const liveConfig:LiveConfig={key:config.QLOO_API_KEY??'',baseUrl:config.QLOO_BASE_URL??'https://hackathon.api.qloo.com'};
 // Constructor validates credentials/origin without performing any network operation.
 const provider=new LiveQlooProvider(liveConfig);
 // Never let development mode or a missing Worker context bypass live quotas.
 liveConfig.beforeRequest=productionRequestGuard(config,()=>release
  ?release.budgetStore??(release.budgetDb?d1BudgetStore(release.budgetDb):undefined)
  :tursoBudgetStore(config));
 return provider;
}
