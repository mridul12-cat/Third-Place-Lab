# Qloo integration and live verification

Status as of October 23, 2026: **bounded local live verification passed** for two artist-input scenarios, book/artist/movie Insights, and one cheaper refinement. Eight additional real HTTP requests all returned 200; the refinement reused four verified responses in temporary process memory. Production remains unchanged. See [the dated live verification section](pre-api-readiness-audit.md#local-live-integration-verification--october-23-2026) for exact scope, test results, and unverified areas.

Official documentation is authoritative. The main documentation host was inaccessible during development, so API details were reviewed against Qloo's official public documentation mirror:

- https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md
- https://github.com/qloo/docs-public/blob/main/reference/available-parameters-by-entity-type.md
- https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide

Use `QLOO_MODE=live`, a server-only `QLOO_API_KEY`, and `QLOO_BASE_URL=https://hackathon.api.qloo.com`. Requests use `X-Api-Key`, not bearer authentication. All parameters are GET query-string parameters.

- `/search?query=<name>&take=5`: entity lookup, expected `results[]` envelope.
- `/v2/insights?filter.type=urn:entity:<type>&signal.interests.entities=<comma-separated-IDs>&feature.explainability=true&take=4`: cross-domain discovery, expected `results.entities[]` envelope.
- `/v2/tags` is intentionally unused; no invented tag filters.

The application supports artist, book, brand, movie, place, destination, and tv_show normalized categories. Research currently queries artist/book/movie/brand only and passes no category-specific location or demographic filters. Metadata is not presented as a causal reason. A signal ID records a query input; only actual API explainability is labeled as an API explanation.

A documented search 404 normalizes to an empty match list. Authentication and permission failures are never retried. Transient failures and rate limits get at most three attempts with short bounded backoff. Each request has an abort timeout. Bad response shapes fail closed. No raw Qloo response dataset is committed. No server cache is enabled until applicable retention terms are confirmed. Limits are eight planning requests per client per minute, 32 total planning requests per minute, and two simultaneous runs per Worker isolate. Runs have a 90-second deadline; upstream calls are cancelled on disconnect. Request bodies are bounded to 16 KB and Qloo bodies to 512 KB. Platform-wide gateway controls are still needed at scale.

## Required real-key checks before submission

1. Configure live secrets in the hosting environment, redeploy, and confirm health reports live/configured (this is not authentication proof).
2. Use exact artists/books/films; verify accepted IDs against real search results. Studio Ghibli may resolve as an unsupported organization category; choose a specific film if unresolved.
3. Inspect real response schemas, entity category fields, affinity nesting, and explainability availability; adjust normalization only against actual documented payloads.
4. Verify each researched category is entitled and confirm the account supports `feature.explainability` for those categories.
5. Exercise success, empty and ambiguous results, quota exhaustion, and auth failure. Check the UI never labels synthetic results as live.
6. Record the date, host, endpoint status, and sanitized verification outcomes here. Never commit a key or private raw responses.
7. Review Qloo terms before publishing exported live evidence. Confirm live quota and availability for the judging period.

## Latest pre-API audit

See [pre-api-readiness-audit.md](pre-api-readiness-audit.md) for the documented type/subtype normalization fix, bounded transport tests, remaining unverified assumptions, and the safe `npm run qloo:smoke` dry-run command. Only the explicit future `--allow-live` flag can enable its bounded real smoke calls; it does not change QLOO_MODE. No real Qloo requests were made during the October 16 pre-API audit. The separately documented October 23 local live phase made eight successful requests with the official key; automated suites continued to use fixtures/mock mode.

## Production release protection — October 23, 2026

Local live verification remains separate from hosted activation. The production Worker reads Qloo configuration from trusted server bindings in request-scoped AsyncLocalStorage, including during streaming. It does not inherit a developer's local key, accept client configuration headers, or mutate global environment state per request.

Live mode requires `QLOO_PUBLIC_LIVE_ENABLED=true`, explicit daily/minute limits, and a `DB` binding with the included migration. Every outgoing HTTP attempt reserves from the shared fixed UTC-day/minute allowance through one atomic SQL upsert, including retries. A research run is capped at twelve attempts. Missing/disabled controls fail before research; database errors/timeouts and exhausted quotas stop the run with safe errors. No failure selects mock mode. Existing input, byte, concurrency, cancellation, and per-isolate rate controls remain in force.

The D1 row contains only an identifier and numeric time-window counters. It stores no venue profile, IP address, credential, or Qloo response. Guard queries use the primary database clock and no read replica/session cache. The migration and concurrency semantics are tested locally; hosted provisioning, environment delivery, production limits, and signed-out access require the separately approved [release steps](release-checklist.md). No production response cache is introduced. Do not assume the verification-only temporary memory cache is available in ordinary runs.

## Native Next.js migration — October 30, 2026

The active local runtime is now native Next.js/Node, with a hosting-independent allowance and a server-only Turso/libSQL adapter. The D1 adapter remains for the explicitly selected Sites rollback build. All application live runs, including development, require the release switch, valid limits, and a configured store. Native production also requires a canonical APP_ORIGIN for planning. No real Qloo calls were made during this migration and no real Turso database was tested. See [implementation, verification, environment and rollback report](native-next-migration.md). Prior live results above retain their bounded October 23 scope.
