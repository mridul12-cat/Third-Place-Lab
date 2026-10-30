import { withReleaseContext } from "../lib/security/release-context";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return withReleaseContext({production:import.meta.env.PROD,budgetDb:env.DB,env:{
      APP_ORIGIN:env.APP_ORIGIN,QLOO_MODE:env.QLOO_MODE,QLOO_API_KEY:env.QLOO_API_KEY,QLOO_BASE_URL:env.QLOO_BASE_URL,
      QLOO_PUBLIC_LIVE_ENABLED:env.QLOO_PUBLIC_LIVE_ENABLED,
      QLOO_DAILY_REQUEST_LIMIT:env.QLOO_DAILY_REQUEST_LIMIT,QLOO_MINUTE_REQUEST_LIMIT:env.QLOO_MINUTE_REQUEST_LIMIT,
    }},()=>runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx)));
  },
};
