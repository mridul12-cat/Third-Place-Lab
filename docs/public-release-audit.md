# Public release preparation audit

> October 30 update: the native Next.js migration is implemented locally. Use [native migration and release gates](native-next-migration.md) for current scripts/configuration; the following records the earlier Sites review or migration proposal. No hosted revision was changed.

Date: October 23, 2026. **Prepared locally; public release and submission remain blocked pending explicit owner approvals.** No remote deployment, publication, storage provisioning, production-live activation, environment mutation, visibility change, or paid service was performed. No additional real Qloo requests were made in this preparation.

The approved UI and event-planning behavior are preserved. Changes in this phase concern Worker configuration, outgoing request protection, regression tests, and release documentation/source packaging. Earlier uncommitted agent fixes and local live verification are recorded separately in [the integration audit](pre-api-readiness-audit.md).

## Results

| Area | Status | Evidence / practical limit |
| --- | --- | --- |
| Existing hosting policy | PASS inspection | Native read-only Sites controls report restricted `custom` audience; public is available but was not selected. |
| Production environment | PASS inspection | Revision 0, no configured entries. Local `.env.local` is ignored, 0600; it is not a hosted secret store. |
| Server-side credential boundary | PASS local | Server-only provider; exact allowed Qloo origins, no redirects, `X-Api-Key` confined to upstream requests. Trusted runtime bindings are request-scoped through the Worker, not client headers. |
| Production kill switch | PASS local Worker | Actual built Worker with live mode and flag false returns 503 for health and planning, makes no research call, and does not relabel itself mock. No key loaded in this check. |
| Shared outgoing allowance | PASS local SQL/integration | One atomic primary-key upsert reserves each attempt, including retries; independent guards share the cap. Daily/minute resets, cancellation, exhaustion, invalid configuration, database failure, and timeout are tested. |
| Per-run research bound | PASS | Maximum 12 outgoing attempts per provider/run; 13th attempt never reaches fetch. No added provider calls or broader evidence collection. |
| Failure honesty / provenance | PASS fixtures | Disabled live fails before research; mid-stream allowance exhaustion emits an error and no result. Existing provenance, normalization, trace, Cultural DNA, and refinement tests pass. No live-to-mock fallback. |
| Input protection | PASS existing suites | Strict venue/refinement/history schemas; 16 KB request, 512 KB upstream body, trusted-edge per-IP 8/minute, isolate 32/minute and 2 active runs, 90-second deadline, bounded retries and cancellation. |
| API surface | PASS inspection/build | Only `/api/events`, `/api/refine`, `/api/health`; no quota-admin, debug, key-check, or public database route was introduced. Health does not query Qloo or certify the table's existence. |
| Secret in artifacts | PASS | Actual local key compared privately against all 71 built files: zero matches. No key or upstream payload was printed/logged by the audit. |
| D1 schema/migration | PASS local | Drizzle generated a schema-only migration. Wrangler applied it successfully to the **local** D1 emulator. Native SQLite tests execute that same migration and atomic SQL. No hosted database created or migrated. |
| MIT / public source | PASS prepared | MIT LICENSE retained; README updated; offline GitHub CI and security instructions added. Sanitized export omits local environments, runtime state, Git history, and managed project identity. |
| Hackathon documentation | PASS prepared | Devpost draft and staged release checklist included. Official event page checked; live public URL and repository remain pending. |
| Hosted binding, migration, secret delivery, live research | NOT VERIFIED | Requires approved provisioning/deployment and production settings. Local Worker/synthetic tests do not certify hosted runtime behavior. |
| Signed-out public access / public GitHub | NOT VERIFIED | Current access remains restricted; GitHub connection/owner/repository approval absent. |
| Actual managed hosting free entitlement / Qloo remaining quota | NOT VERIFIED | Sites controls do not expose billing entitlement or Qloo balance. Confirm with the owners before provisioning or activating live. |
| Hackathon eligibility and final submission | NOT VERIFIED | Owner must confirm entry/rights and complete public checks. No submission was sent. |

## Safeguards implemented

Production live mode requires all of: server key, approved origin, `QLOO_MODE=live`, `QLOO_PUBLIC_LIVE_ENABLED=true`, explicit valid daily/minute limits, and shared `DB` binding. Missing controls fail closed. The source example proposes 100 attempts per UTC day and 20 per UTC minute; these are not active production settings or account-wide entitlements. Per-run maximum is 12 attempts including retries.

`lib/security/qloo-budget.ts` uses database time and a single atomic `INSERT ... ON CONFLICT ... WHERE ... RETURNING` reservation. There is no read-then-write race or replica read. Reservations are conservative: an HTTP failure, client abort after reservation, or later timeout does not refund budget. Protection timeouts can consume a reservation even if the app stops waiting. Retries reserve again. A missing migration or unavailable binding stops research; it never creates a fictional success. Shared limits cover this application's binding, not other deployments/clients using the key.

The D1 row contains only `id`, UTC-day/minute buckets, and counts. No IP, profile, key, raw Qloo response, or licensed evidence cache is stored. `.openai/hosting.json` now requests logical D1 binding `DB`; this is an undeployed source change. D1 is the only new hosting resource requested; existing Drizzle/D1 dependencies were reused, with no added package or paid service.

`build/sites-worker.ts` passes trusted server settings through AsyncLocalStorage. Health, streaming handlers, and the provider share that context without request-to-request environment mutation. In production runtimes without the required binding, live research fails closed. Demo mode remains explicit and available without database calls.

## Free-tier control review

Sites exposes encrypted server secrets, audience controls, and logical D1 provisioning/migrations. Environment edits require redeployment; no edits were made. Its inspected API does not disclose this project's underlying Cloudflare billing tier or promise free resources.

Cloudflare documents D1 on Workers Free at 5 million rows read/day, 100,000 rows written/day, and 5 GB storage, with failures when free allowances are exceeded. Those are platform/account limits, not this app's Qloo caps, and do not establish the managed account's entitlement. Confirm the free plan and absence of paid overages before provisioning. ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/))

Cloudflare's native Worker rate limiter is approximate and scoped per location, so it cannot provide a strict worldwide Qloo cap. The source therefore uses shared atomic D1 reservations plus existing local limits. No reliance is placed on an unverified WAF/bot feature or paid gateway. ([Worker rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/))

Anonymous clients can still exhaust the allowance and deny research to legitimate visitors. Repeated denied requests also consume Worker/D1 capacity. The kill switch and D1 failure behavior prevent additional Qloo use, but do not guarantee platform availability, fairness, bot resistance, or zero costs on an unknown paid hosting plan. No global concurrency control or permanent cross-run response cache was added. Fixed UTC windows permit bursts across boundaries; choose conservative caps against actual entitlement.

## Executed verification

All automated tests use mock mode or synthetic intercepted HTTP. No real service credentials are used by CI or the suites.

| Command/check | Actual outcome |
| --- | --- |
| `QLOO_MODE=mock npm run typecheck` | PASS |
| `QLOO_MODE=mock npm run lint` | PASS |
| `QLOO_MODE=mock npm test` | PASS — 108 tests across 7 files; 11 new release-protection tests |
| `QLOO_MODE=mock npm run test:e2e` | PASS — 8 desktop/mobile Chromium cases |
| `QLOO_MODE=mock npm run build` | PASS — Worker, client, SSR artifacts; no deploy |
| Local Wrangler D1 migration | PASS — schema created locally only |
| Built Worker live-disabled health + planner | PASS — both 503, live/unavailable, safe error |
| Actual-key literal scan of built artifacts | PASS — 71 files, zero matches |
| `.env.local` ignore and mode | PASS — ignored, 0600 |
| `git diff --check` | PASS |
| Sanitized source export | PASS — 164 files; MIT, README, lockfile included; local environments, runtime state, Git history and project identity absent. Export separately passed typecheck and production build using existing dependencies, then generated artifacts/dependency link were removed. |

Initial sandboxed browser/emulator startup attempts failed with localhost `EPERM` before test execution. Approved local execution outside that sandbox subsequently passed. Node emitted SQLite experimental and punycode deprecation warnings; no test was skipped or dependency changed to hide them. GitHub-hosted CI has not run because the public repository has not been created.

## Release blockers and exact next actions

Follow [the release checklist](release-checklist.md), which contains exact settings, verification bounds, and rollback steps. Required authorizations are: verified-free D1 provisioning/migration plus private guarded deployment; public GitHub owner/name and publication; encrypted production key upload plus live activation/deploy at approved caps; changing the audience to public and bounded verification; and final Devpost submission.

Remaining owner confirmations include hosting billing, account-wide Qloo quota/other consumers, Qloo public display/export/retention rights, continued judging access, eligibility and ownership. The proposed daily cap might be insufficient for unrestricted judging traffic; approve a revised cap only after quota review. Public access must be tested signed out on desktop/mobile after the audience change. None of these are silently assumed complete.
