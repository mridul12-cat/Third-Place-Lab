# Native Next.js migration — local implementation report

Date: October 30, 2026. Target: **native Next.js, Vercel Hobby, Turso Free/libSQL**. This report supersedes the active-build and deployment instructions in the earlier Sites audits. Those audits remain historical records.

**No cloud provisioning, deployment, publication, production environment edits, access changes, real Turso requests, or real Qloo requests were performed.** Only the open-source libSQL npm client was added, pinned to 0.18.0. Existing private `.env.local` was not edited or copied into the public source. No paid service or integration was introduced.

## Implementation

- Native typecheck runs `next typegen` before TypeScript. This repairs generated route types when switching back from the retained Vinext build, which writes its own type declarations into `.next`. Do not run the two build paths concurrently.
- Active commands now use `next dev`, `next build --webpack`, and `next start --hostname 0.0.0.0`. The already-installed Next.js 16.3.4/React versions are retained. No runtime or build upgrade was bundled into the migration.
- `dev:sites`, `build:sites`, and `start:sites` retain the original commands. The managed project identity/hosting manifest and storage schema are unchanged. No default command deploys or provisions resources.
- Both planning routes explicitly use `runtime='nodejs'` and `maxDuration=120`. The internal planning deadline stays 90 seconds. Health is an uncached Node route and performs configuration checks only.
- `RequestBudgetStore` is independent of D1/hosting. The Turso adapter executes the existing atomic SQL through `@libsql/client/web`; the D1 adapter remains for the explicitly selected Worker rollback context. No in-memory/local-file/embedded-replica fallback exists.
- All application live runs, **including local development**, require the existing activation switch, valid limits, credential, and a configured shared store. Setting `NODE_ENV` to development or omitting Worker context cannot bypass the guard. Mock runs do not require a store or key.
- The original single-row SQL reserves daily and minute windows atomically using database UTC time. Successful, failed, retried, and ambiguously committed attempts are never refunded. Exhaustion produces an honest failure; database errors/timeouts produce safe unavailable errors. Live mode never changes to sample data after failure.
- Turso URLs must be HTTPS or libSQL endpoints under `turso.io`, without credentials, custom port, path, query, or fragment. Local files and other hosts are rejected. The HTTP transport checks every destination, denies redirects, and receives the combined client-cancellation/protection timeout signal. The SDK client closes after each reservation.
- A reservation has a three-second protection timeout. Cancellation stops waiting and aborts HTTP transport; it cannot guarantee the remote server did not commit first. Such an ambiguous reservation remains consumed. A confirmed cancellation edge case in `abortable` was fixed so an already-rejected operation is observed even when its cancellation signal is already aborted; this avoids an unhandled rejection without advancing research.
- Production Origin validation uses the exact configured `APP_ORIGIN`, independent of a reconstructed internal Next URL. Invalid/missing production configuration fails closed; different origins, forwarded-host spoofs, `null`, empty Origin values, and suffix-domain tricks are rejected. Public origins require HTTPS; HTTP loopback is allowed for local production testing. Origin-less CLI requests remain supported and are subject to the same validation and quota protections; Origin checking is not authentication.
- Native Vercel reads its documented client-IP header only when server-owned `VERCEL=1` selects that environment. Arbitrary Cloudflare/forwarded headers cannot select this trust policy. Missing, multiple, malformed, or oversized IP values use a conservative shared bucket. The retained Worker context alone selects Cloudflare IP trust. Shared outgoing quotas remain authoritative across instances; inbound rate/concurrency limits remain per process.
- Cultural DNA, orchestration, event planning, live Qloo normalization, activities/refinements, UI, styles, illustrations, and layout sources were preserved. The browser test's error locator is scoped to the application's alert so Next's route announcer remains accessible without confusing the assertion. Test client identities now use the Vercel header in the synthetic local environment.
- Playwright starts a fresh native **production** server forced to mock, rather than reusing a potentially live development server. CI builds before E2E, scans secrets, and has no deployment or secret-upload step.

## Environment configuration

Never overwrite an existing private `.env.local` when following fresh-clone setup. Use `QLOO_MODE=mock` overrides for migration tests/builds; they take precedence over the existing local live setting.

| Variable | Required behavior |
| --- | --- |
| `QLOO_MODE` | Defaults to `mock`; `live` only after explicit activation approval |
| `QLOO_API_KEY` | Server secret; required for live, never `NEXT_PUBLIC_*`, source, command arguments, or logs |
| `QLOO_BASE_URL` | Defaults to approved `https://hackathon.api.qloo.com`; original allowlist retained |
| `QLOO_PUBLIC_LIVE_ENABLED` | Must equal `true` for any application live run; keep false pending release approval |
| `QLOO_DAILY_REQUEST_LIMIT` | Explicit integer 1–10,000; example proposal 100 is not activated or a claim of entitlement |
| `QLOO_MINUTE_REQUEST_LIMIT` | Explicit integer 1–1,000, at most the daily limit; example proposal 20 |
| `TURSO_DATABASE_URL` | Remote libSQL/HTTPS database endpoint; required for native live mode |
| `TURSO_AUTH_TOKEN` | Database-scoped server secret; required for native live mode |
| `APP_ORIGIN` | Exact browser origin; required in production even for mock planning. Example `http://localhost:3000`; public deployments must use their exact HTTPS origin |
| `VERCEL` | Deployment-owned platform variable. Do not derive it from caller headers. Local Playwright sets it only in its synthetic server environment |
| `DB` | Retained Sites Worker binding only, not a native Next environment variable |

Production Vercel secrets should be Production-scoped Secret variables. Previews stay mock and receive no production Qloo key or DB token. Do not use `next.config.ts`'s `env` object to expose secrets. Native builds and mock tests need no database or key; store creation is lazy and health makes no network call.

The existing hosted app and its environment remain unchanged. `/api/health`'s `liveVerified:false` remains deliberate: a successful configuration check does not certify APP_ORIGIN, a migrated table, database accessibility, Qloo entitlement, or real research. Validate those separately before activating a public deployment.

## Verification and scope

All new SQL tests execute the unchanged migration in an **in-memory SQLite fixture** and intercept the real libSQL SDK's HTTP protocol. They test independent application-store clients contending for the same fixture allowance; that is not a hosted Turso concurrency or durability test. A new integration case executes the native provider factory, real live adapter, planner, and refinement against synthetic database/Qloo transports, checks provenance and budget changes, then confirms exhaustion ends the stream without a fabricated result. Its ten Qloo-shaped fixture responses are **zero real Qloo calls**.

Tests cover conservative reservations, both UTC rollovers, exhausted daily/minute limits, SDK failures/malformed responses, unsafe endpoints/tokens, missing configuration in production/development, client cancellation, transport timeout, retained counters when a store object is recreated, canonical-origin spoofing, trusted-edge IP selection, and zero-network health checks. Earlier regression scenarios and assertions remain; no test is removed or skipped in the final full run.

| Check | Actual result |
| --- | --- |
| Native typecheck (including regenerated route types) | PASS |
| Lint | PASS |
| All unit/integration tests | PASS — 156 tests across 9 files, including 48 added migration cases; none skipped |
| Desktop/mobile E2E on native production server | PASS — 8 cases |
| Native production build | PASS — static landing page and three dynamic API routes |
| Compiled route configuration | PASS — both planning routes record maxDuration 120 |
| Retained Sites rollback build | PASS — local Worker/client/SSR artifacts only |
| Actual private-key literal scan | PASS — 328 source/artifact files, zero secret matches; no published environment files |
| Client-only secret/provider markers | PASS — absent from all 23 client artifact files |
| Approved core source hashes | PASS — 8 files unchanged: page, CSS, layout, venue illustration, orchestrator, planner, live provider, hosting manifest |
| Whitespace diff check | PASS |
| Real Turso concurrency/persistence | NOT VERIFIED — synthetic SQL/HTTP fixtures only |
| Native hosted Vercel streaming/live workflow | NOT VERIFIED — no deployment or real API calls |

A rollback build exposed generated route-type collisions in .next; native typecheck now regenerates its own route types before tsc. Early fixture assertions were corrected to match the SDK's numeric wire encoding and Request-body ownership. The first adapted timeout check exposed an unobserved rejected promise, which was fixed in abortable and then verified by the full suite. These are local findings, not remote-provider failures. Initial restricted npm metadata lookup could not resolve the registry; approved registry access subsequently installed the pinned open-source dependency. SQLite experimental and framework punycode warnings remain informational.

Runtime for local checks: Node 25.5.0, npm, macOS; GitHub Actions remains configured for Node 22. No claim is made that remote CI or Vercel Node 22 execution has already passed.

## Local commands and artifacts

Run sequentially from this project root. Stop any other server using port 3000 first; Playwright refuses to reuse it.

```sh
QLOO_MODE=mock npm run typecheck
QLOO_MODE=mock npm run lint
QLOO_MODE=mock npm test
QLOO_MODE=mock NEXT_TELEMETRY_DISABLED=1 npm run build
QLOO_MODE=mock npm run test:e2e
npm run security:scan
```

Native output is `.next/`, not `dist/`. Secret scans compare private known credential literals in memory with source and published client/server artifacts; only counts are printed. They also reject unexpected published environment files. This does not replace an independent scan for unknown credentials before public publication. No private values or real response datasets are included in tests/reports.

## Later authorized deployment procedure — NOT performed

1. Confirm personal/non-commercial Vercel Hobby eligibility, available Free account usage, and Turso Free/libSQL availability. Reject paid trials, paid marketplace resources, or payment-linked overages. No free-tier or account eligibility was established by local tests.
2. After provisioning approval, create one Free remote libSQL-compatible database in a suitable region, confirm Free status/overages disabled, and issue a database-scoped token valid through judging. Do not use a temporary/unclaimed database or an embedded/offline replica.
3. Apply `drizzle/0000_lush_white_queen.sql` exactly once through an approved database migration step. Record the migration application; do not reset/recreate the table during builds, cold starts, or routine redeployments. There are no destructive statements and no live counter data was migrated in this local change. Retain any existing quota state if cutting over an already-active app; otherwise wait for a fresh approved quota window.
4. Verify exact SQL/RETURNING behavior, UTC windows, concurrent remote clients, database failure behavior, and counters surviving a new connection and service restart **before** relying on the store. These checks need a real Free DB and are explicitly NOT VERIFIED now. They need not call Qloo.
5. After private deployment approval, select the Next.js preset and native build command, supported Node version, and Fluid Compute. Leave Qloo mock/disabled. Confirm compiled route duration of 120 seconds is applied; non-Fluid legacy Hobby duration is insufficient for the application's full deadline. Configure canonical `APP_ORIGIN` and keep previews mock. Do not send the native build to a Sites Worker publisher.
6. After separate secret/live activation approval, upload the server secrets and approved caps, redeploy, and verify one bounded real workflow/refinement. Account for all attempts including retries; test failure branches with fixtures, not deliberate real quota exhaustion. Confirm evidence provenance, Cultural DNA, three concepts, material refinement, stream chunks before completion, and client cancellation.
7. After separate public-access approval, verify signed-out desktop/mobile access without platform login or bypass token, verify the actual deployed revision and private secret scans, and record statuses/counts. GitHub publication and Devpost submission are separate authorization gates.

The current 100/day and 20/minute values remain proposals. With three interests in each supplied sample, generation plus one refinement normally costs twelve attempts: only eight complete sessions/day without retries or other visitors. Confirm judge traffic and official Qloo quota before choosing the final caps. Anonymous traffic can exhaust an allowance and cause an outage. The guard covers this shared database, not unrelated clients using the key. There is no production cross-run Qloo response cache.

## Rollback

### Local Sites/Vinext build path

```sh
QLOO_MODE=mock npm run dev:sites
QLOO_MODE=mock npm run build:sites
```

`start:sites` retains the original localhost Wrangler emulator command and `.wrangler/state`. Its Worker must receive its real `DB` binding, migrated schema, and canonical `APP_ORIGIN` for planning; private preview values may be passed as non-secret local environment/vars. Live mode still requires its guard, limits, activation switch, and key. The new Worker source forwards APP_ORIGIN from its server binding. The original `.openai/hosting.json` and project identity remain intact. This is a rollback **capability**, not a hosted rollback action. Publishing/reverting a hosted revision requires explicit approval.

### Native deployment rollback, once a deployment exists

Keep the last verified native commit/deployment and database. An authorized incident response can disable `QLOO_PUBLIC_LIVE_ENABLED` and redeploy while leaving mode live so failures remain honest; do not silently switch users to sample data. Reverting a deployment must preserve database identity/counters and cannot revoke a leaked credential. Any key exposure requires provider revocation/rotation. Avoid running independent D1 and Turso budgets concurrently against the same key; coordinate state or cut over at an approved new UTC window.

No Git commit/reset, host rollback, or remote operation was performed. Earlier changes in the working tree were preserved rather than reset.

## Actions still requiring authorization / remaining blockers

- Confirm Vercel Hobby terms eligibility and actual ₹0 account allowances; confirm Turso Free/libSQL availability and no paid overages.
- Create/provision the remote Free database, apply its migration, mint its scoped token, and run remote atomicity/persistence tests.
- Create/configure a Vercel project and deploy privately, including actual Fluid settings, runtime, streaming, origins, and edge-header verification.
- Transfer encrypted production secrets, choose Qloo caps against actual entitlement/judge load, activate live mode, and run bounded real research.
- Change public access and test signed-out availability. Local tests do not certify judging-period uptime or remote account limits.
- Connect the intended GitHub owner/repository and approve publication; approve final Devpost submission after public links and entrant/data-display rights are confirmed.

No action in this list is authorized by completing the local migration. The implementation is not a claim of remote Turso persistence, public availability, or hackathon submission readiness.

## Primary references

- [Turso client and transaction reference](https://docs.turso.tech/sdk/ts/reference)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Vercel server secrets](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
- [Vercel Hobby terms/allowances](https://vercel.com/docs/plans/hobby)

Provider documentation informs the target configuration; it does not verify the user's actual accounts. Any later deployment or resources must remain strictly ₹0 under separately approved settings.
