# Hosting portability assessment

> October 30 update: the native Next.js migration is implemented locally. Use [native migration and release gates](native-next-migration.md) for current scripts/configuration; the following records the earlier Sites review or migration proposal. No hosted revision was changed.

Reviewed October 23, 2026. **Assessment only.** No hosting resources were provisioned, deployments made, code published, production secrets uploaded, access settings changed, or real Qloo requests made. Application implementation files are unchanged. A disposable local source copy was used for compatibility experiments; this report is the only project addition in this phase.

## Recommendation

Prefer **native Next.js on Vercel Hobby plus a Turso Free remote SQLite/libSQL budget database**, conditional on personal/non-commercial Hobby eligibility and verified free account settings. Render Free with the same portable application/database is a fallback if its cold-start behavior is acceptable. Neither option guarantees uninterrupted availability or unrestricted free usage.

The smallest safe change is to retain the existing React/App Router source and agent, select the already-installed native Next.js runtime, and adapt the budget storage boundary. Retaining Vinext is possible through its platform adapters, but this checkout emits a Cloudflare Worker and runs Wrangler. Switching to a Nitro deployment introduces another adapter/dependency without removing the need to replace D1. Native Next.js is already installed and its compatibility was tested locally.

## Executed local evidence

A sanitized 164-file copy was created under `/tmp/third-place-lab-portability-review`, without `.env.local`, Git history, or deployment identity. Existing dependencies were linked locally; no package installation or remote service creation occurred.

- Native `next build --webpack` using installed Next.js 16.3.4: **PASS**, including TypeScript, static landing page and all three dynamic API routes.
- First native browser run with original application source: **2 passed / 6 failed**. Four failures came from the existing origin guard rejecting legitimate requests when Next reconstructed an internal URL. Two came from a test's generic `role=alert` selector also matching Next's route announcer.
- A configured origin comparison and a selector scoped to the application's `.error[role="alert"]` were applied **only to the disposable copy**. These are experiments, not a completed security implementation; production must validate the configured origin and reject invalid/missing production configuration.
- Native rebuild after those two adjustments: **PASS**.
- Repeated existing desktop/mobile browser suite: **8/8 PASS**. Covers generation, concepts, Cultural DNA/source panels, cheaper and three consecutive refinements, missing evidence, blueprint editing, JSON download, print invocation, and honest failure/status UI.
- Browser assessment used mock mode exclusively. No hosted streaming, live Turso SQL, deployment account eligibility, native-runtime live Qloo workflow, or production quota store has been verified.

## Provider comparison

| Topic | Vercel Hobby | Render Free web service |
| --- | --- | --- |
| Current artifacts deploy unchanged? | No: current output is a Worker, not a native Next deployment | No: `npm start` currently runs local Wrangler, not a public Node server |
| Recommended runtime | Native Next.js Node functions | Native Next.js Node web service |
| Adaptation | Scripts, portable budget adapter, origin/client-IP policy, route runtime/duration, tests | Same common adaptations, plus bind `0.0.0.0:$PORT` and select Free compute explicitly |
| Streaming | Node function response streaming supported; retain NDJSON and cancellation | Next Node server supports streaming; confirm proxy flushing and cancellation after deployment |
| Duration | Fluid Compute Hobby supports up to 300 seconds; configure 120 seconds for 90-second application deadline plus cleanup | Render documents long-running HTTP requests; application remains capped at 90 seconds. Cold start adds user-visible waiting |
| Free usage | 4 CPU-hours, 360 GB-hours provisioned memory, 1 million function invocations, 100 GB fast transfer in Hobby allowance | 750 shared instance hours/month; current Hobby allowance 5 GB outbound bandwidth, with build limits |
| Idle behavior | Serverless cold starts possible; no Render-style documented 15-minute idle suspension | Sleeps after 15 minutes idle; waking takes about one minute; arbitrary restarts possible |
| ₹0 controls | Stay Hobby; no Pro trial/paid add-ons/paid marketplace storage; exceeding Hobby limits can pause features | Stay Hobby workspace AND Free compute; no payment method; no paid disks/datastores/jobs; limits can suspend service/builds |
| Terms fit | Restricted to personal, non-commercial projects. Eligibility is conditional | Intended for prototypes/hobby/testing; Render explicitly advises against production use |
| Judging recommendation | Preferred subject to eligibility and end-to-end hosted validation | Fallback; materially weaker first-visit experience and availability |
| Quota protection | Shared remote SQL budget survives function scaling and redeploys | Same remote SQL budget survives process restarts and sleep |

Primary references: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [function limits](https://vercel.com/docs/functions/limitations), [streaming](https://vercel.com/docs/functions/streaming-functions), [fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Render Free](https://render.com/docs/free), [Render pricing](https://render.com/pricing), [Render billing FAQ](https://render.com/docs/faq), [Render Next.js guide](https://render.com/docs/deploy-nextjs-app), [Vinext platform deployment](https://github.com/cloudflare/vinext).

Vercel's non-commercial restriction must not be treated as automatic hackathon approval. A personal demo without payments or ads fits the stated purpose, but commercial sponsorship, paid development, business use, or uncertainty over prize-related use needs provider clarification. This assessment does not certify individual account eligibility. Render's free prototype offering is a more direct intended-use fit, with substantial reliability limits.

## Replacing D1 safely

**Recommended: Turso Free, using remote SQLite/libSQL-compatible execution.** Current published allowance: $0/month, no credit card required, 5 GB storage, 500 million rows read/month, 10 million rows written/month. The existing one-row allowance is negligible at 100 reservations/day, although denied/abusive traffic also consumes queries. Verify Free status and disabled overages before any later activation; do not enable a trial or paid plan.

Use the supported remote client (`@libsql/client/web` for a libSQL database) with no embedded replica, local file, offline write queue, or cached counter. Execute the existing `INSERT ... ON CONFLICT ... WHERE ... RETURNING id` statement against the database primary as a single write. Retain database-clock UTC windows, both caps in the same statement, and the existing create-table migration. One returned row means reserved; no returned row means exhausted. Connection/contract/time-limit errors must fail closed. Validate the exact statement on the selected hosted database engine before enabling live mode.

The original SQLite schema has no D1-only SQL, destructive operations, or pragma dependencies. Add a table-based migration journal for one-time application; do not reset counters in builds or cold starts. One durable database/row must be shared by every production instance/deployment using this application's key. A preview should remain mock and receive no production key or budget-store token. If another deployment uses the Qloo key separately, this application's cap cannot control it.

Turso documents durable acknowledged writes and primary-forwarded write transactions. That durability is distinct from availability: quota blocking and provider outages must still stop research. Use an expiration for the DB token extending beyond judging, and test rotation separately. Turso's announced removal of idle cold starts is helpful but is not an uptime SLA.

References: [pricing](https://turso.tech/pricing), [TypeScript execution and transactions](https://docs.turso.tech/sdk/ts/reference), [durability](https://docs.turso.tech/cloud/durability), [usage/blocked quotas](https://docs.turso.tech/help/usage-and-billing), [idle behavior announcement](https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan).

Other choices:

- **Upstash Redis Free:** viable with an atomic Lua script and durable state, but rewrites the SQL counter into Redis semantics. More change than Turso for this repository. Do not use two independent read/increment operations or an unclaimed temporary database. [Pricing](https://upstash.com/pricing/redis).
- **Render Free Postgres:** durable and atomic, but expires 30 days after creation, has no backups, and requires PostgreSQL schema/query/client changes. A newly created database could cover the presently published judging dates if its expiration is later, but it is an expiring workaround rather than the preferred portable solution.
- **Render Free Key Value:** loses all data on restart; unsuitable for a hard allowance.
- **Local SQLite / in-memory Map:** unsuitable on Vercel functions and Render Free's ephemeral filesystem. Losing counters can replenish the apparent allowance and permit excess Qloo use.

## Exact migration plan — not executed

1. **Confirm eligibility and cost settings.** Choose personal Vercel Hobby if eligible; otherwise Render Hobby workspace with Free web compute. Use the free provider subdomain. Confirm no paid trial, payment-linked overage, paid marketplace integration, or paid resource is selected. Verify the selected database remains Free with overages disabled. No provider account has been inspected or created in this assessment.

2. **Switch execution scripts in `package.json`.** Use the tested native build path:

   ```json
   {
     "dev": "next dev",
     "build": "next build --webpack",
     "start": "next start --hostname 0.0.0.0"
   }
   ```

   Keep the installed Next/React versions initially; no UI or agent rewrite. Pin a supported Node 22.x version at least 22.13 and verify on that version. Local assessment ran with the existing Node 25 installation. `vite.config.ts`, Sites plugins, the Worker wrapper and hosting manifest must not be selected by the new deployment. Legacy files can remain off the runtime path; mass dependency cleanup is unnecessary for this migration.

3. **Make the budget boundary portable.** In `lib/security/qloo-budget.ts`, replace the D1-specific dependency with a narrow `reserve`/SQL-execution interface. Keep limits, safe errors, timeout/cancellation, conservative no-refund behavior, and atomic SQL. Add one server-only Turso adapter and its single client dependency. Update `lib/qloo/select.ts` to construct the remote store from server environment in native production. The existing `release?.budgetDb` is unavailable outside the Worker and must not be bypassed. Isolate or replace `db/index.ts`'s Cloudflare import if it becomes part of the portable runtime. Keep `db/schema.ts` and the schema-only migration.

4. **Adapt HTTP trust deliberately.** In `lib/agents/http.ts`, require a validated canonical `APP_ORIGIN` in production and compare incoming browser Origin against that value, rather than an internally reconstructed request URL. Use a small explicit allowlist only if multiple legitimate domains are required. Keep cross-origin rejection; do not trust arbitrary forwarded host/protocol headers. Replace Cloudflare-specific client-IP trust with the host's verified forwarding policy. On direct Vercel ingress, use its documented overwritten client-IP header; on Render verify its proxy policy first, otherwise retain a conservative shared local bucket. Shared database allowance remains the authoritative upstream cap. [Vercel request headers](https://vercel.com/docs/headers/request-headers).

5. **Set route execution explicitly.** Both planning route files should export `runtime = 'nodejs'` and `maxDuration = 120` for Vercel, with Fluid Compute verified enabled. Keep the handler's 90-second deadline, 12-attempt run bound, stream schema, cancellation, no-store behavior, and no mock fallback. A 120-second setting does not work around a legacy non-Fluid Hobby maximum; enabling Fluid is required for this plan. No AI SDK, queue, new LLM, WebSocket rewrite, or frontend redesign is needed.

6. **Keep server secrets separate.** Add the following to documentation/example configuration, with blank secrets:

   | Setting | Treatment |
   | --- | --- |
   | `QLOO_API_KEY` | Server secret; production only, never `NEXT_PUBLIC_*` |
   | `TURSO_DATABASE_URL` | Validated server database endpoint |
   | `TURSO_AUTH_TOKEN` | Database-scoped server secret, valid through judging |
   | `APP_ORIGIN` | Exact production HTTPS origin |
   | `QLOO_MODE` | Initially `mock`; live only after separate approval |
   | `QLOO_PUBLIC_LIVE_ENABLED` | Initially `false`; retain explicit activation gate |
   | `QLOO_DAILY_REQUEST_LIMIT` | Explicit approved value; current proposal 100 is not sufficient for unrestricted judging traffic |
   | `QLOO_MINUTE_REQUEST_LIMIT` | Explicit approved value; current proposal 20 |

   On Vercel use Production-scoped Secret variables; leave previews mock without keys. On Render use service Environment secrets and keep preview services mock. Do not put secrets in `next.config.ts`'s `env`, public variables, YAML values, source, logs, or CLI command arguments. Database configuration should be lazy so build/mock operation needs no real secret or network call. [Vercel secrets](https://vercel.com/docs/environment-variables/sensitive-environment-variables), [Render environment controls](https://render.com/docs/configure-environment-variables).

7. **Update and execute verification locally.** Scope the error-message assertion in `tests/e2e/journey.spec.ts` so Next's own route announcer is not mistaken for the application alert. Point Playwright at the native Next runtime. Add origin/proxy spoofing tests and portable store contract tests. Verify concurrent independent store clients cannot exceed the cap, UTC rollover, exhausted limits, restart/redeploy persistence, timed-out or ambiguous reservations, missing configuration, and database outages. No external Qloo calls in automated suites. Run typecheck, lint, all unit/integration tests, desktop/mobile E2E, native production build, secret scans, and screenshot comparisons against the approved desktop/mobile UI. The disposable compatibility experiment does not substitute for these final migration tests.

8. **Only after separate provisioning/deployment approval:** create the Free remote database, apply the migration once using an explicitly authorized migration step, and validate atomic behavior without Qloo. Do not place schema resets in the build. Deploy initially mock/disabled. Vercel: Next.js preset, Node runtime, native build command, default `.next` output, Fluid enabled. Render: Node Web Service, explicit `plan: free`, build `npm ci && npm run build`, start `npm start -- --port $PORT`, health path `/api/health`; no disk or paid pre-deploy job. All health checks must make zero Qloo calls.

9. **Only after separate production-live/public-access approval:** upload production secrets, activate live under approved caps, and perform bounded hosted checks. Confirm signed-out access, stream chunks arriving before the final result, client cancellation, real evidence/provenance, one refinement, no fallback, and counters retained across restart/redeploy. Scan actual client artifacts privately for secret literals. Record actual upstream counts; stop on any guard failure. Freeze the verified revision during judging and use config-only health checks to preserve quota. Do not add artificial keep-alive traffic as an availability workaround.

## Judging availability and quota

The current official rules list judging November 2–5, 2026, ending 11:45 PM Eastern Time on November 5. Recheck for changes before submission and keep the app available through any announced extension. [Official rules](https://qloo.devpost.com/rules).

Vercel/Turso have no documented 30-day demo expiry in the reviewed Free offerings, but account quota, provider outages, terms enforcement, and the Qloo allowance can still make the demo unavailable. Render's 750 hours can cover a single continuously running service even in a 31-day month (744 hours), provided no other Free services consume the pool. This does not prevent sleeping, restarts, bandwidth suspension, or Render's external-traffic threshold.

Both supplied samples have three interests: normally six Qloo attempts per generation and six more per refinement. A 100/day cap therefore supports only eight such complete sessions without retries, operator checks, or other visitors. Ten judges doing one session each would require about 120 attempts; five judges trying both samples would also require 120. At 20/minute, two sample-based generation-plus-refinement sessions in the same UTC minute need 24 attempts and can interrupt research. Choose daily/minute values from expected traffic plus headroom, only after checking official Qloo entitlement and other clients using the key. Switching hosts does not increase that entitlement.

## Decision

**Conditional GO for migration preparation to native Next.js + Vercel Hobby + Turso Free.** Terms eligibility, actual Free account settings, hosted database compatibility/atomicity, and deployed streaming/live verification are outstanding. **Render Free is technically feasible but a weaker judging choice** because of idle wake-up delay and suspension/restart behavior. Neither is an unconditional availability or ₹0 certification before the actual accounts are checked. No deployment or provisioning is authorized by this assessment.
