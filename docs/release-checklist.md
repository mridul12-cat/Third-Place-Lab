# Release checklist — approval required

> October 30 update: the native Next.js migration is implemented locally. Use [native migration and release gates](native-next-migration.md) for current scripts/configuration; the following records the earlier Sites review or migration proposal. No hosted revision was changed.

Prepared October 23, 2026. This is a deployment runbook, not a declaration of submission readiness. No deployment, secret upload, repository publication, resource provisioning, or access change was performed during preparation.

## Current state

The managed Sites deployment remains restricted (`custom` audience). The hosted environment has zero configured entries (revision 0). The local checkout's ignored `.env.local` is separate and remains available for authorized local work. A successful local live test does not verify the hosted Worker. GitHub is not connected in this session and no public repository has been created. The existing managed Git remote must not be repurposed.

The source now requests a D1 binding named `DB` in `.openai/hosting.json`. This is a local manifest change only. The new schema is `drizzle/0000_lush_white_queen.sql`; it has no user, credential, or cultural-response data. Sites provisions requested storage and applies migrations on a later approved publish. Do not publish until free-tier entitlement is confirmed. No R2 binding is requested.

## Authorization gates

Obtain explicit approval for each concrete action below, or one approval naming the included actions. Supplying a repository name alone does not authorize public publication.

1. **Hosting:** confirm the managed hosting account can provision/use D1 within a free plan with no paid overages, then approve provisioning `DB`, applying the migration, and deploying this revision while retaining the current restricted audience and mock mode. If the account plan cannot be verified, stop here.
2. **GitHub:** supply owner/repository name, connect GitHub or authorize a CLI account, and approve creation of a **public** MIT repository from the sanitized source export. Do not push the private managed checkout's history or change its remote.
3. **Production live:** approve server-secret upload, the exact live settings below, and a new deployment to the same restricted audience. The proposed cap is **100 outgoing attempts per UTC day, 20 per UTC minute, 12 per planning run**, including retries. Confirm these numbers against the actual Qloo account allowance and any other clients using the same key. These are launch proposals, not a claim of account entitlement.
4. **Public access:** separately approve changing the deployment audience to **public/anyone**, plus the bounded verification below and permission to disable live research/redeploy on abuse. No paid upgrades are authorized.
5. **Submission:** approve Devpost submission after the final links, description, eligibility, and public checks are reviewed. No submission has been sent.

## Local release verification

Stop any live development server on port 3000 before running browser tests. Run sequentially from the source root:

```sh
QLOO_MODE=mock npm run typecheck
QLOO_MODE=mock npm run lint
QLOO_MODE=mock npm test
npx playwright install chromium
QLOO_MODE=mock npm run test:e2e
QLOO_MODE=mock npm run build
npm run release:source -- /tmp/third-place-lab-public-source
```

The export destination must not already exist. The helper copies source, tests, assets, license, lockfile, and documentation, replaces the hosting manifest with logical bindings only, and omits environment files except `.env.example`, Git history, deployment identity, caches, dependencies, and build output. It checks the actual local Qloo key in memory without printing it. Review the export and run an independent secret scan before publishing. This is not a proof against every possible unknown credential.

After approval, initialize Git **inside the export**, choose `main`, commit, and create/push the approved public repository using the connected GitHub account. Confirm MIT license detection and all required source assets. GitHub Actions runs offline verification only, with read-only repository permission and no deployment steps or secrets. Its first remote run remains unverified until publication.

## Deploy safely, retaining restricted access first

Use the Sites source/build/publish workflow with this tested source root and its unchanged managed project association. Do not use a static-only host; route handlers and the Worker entry are required. Do not change the audience in the deploy step.

1. Confirm no pending migration removes data; this migration only creates `qloo_request_budget`.
2. Publish the guarded revision in mock mode with `QLOO_PUBLIC_LIVE_ENABLED=false`. Check that the new Worker has the real `DB` binding and the migration succeeded. Inspect only schema and numeric counter columns, never environment values. The generated Wrangler database ID is a local placeholder; it must not be used as a real hosted binding.
3. Open the restricted deployment. GET `/api/health` must return mock/configured and `liveVerified:false`; generate a mock plan. Confirm hosted build revision, not just a successful upload.
4. Once production-live approval is granted, set these through Sites server-side environment controls:

| Name | Value / treatment |
| --- | --- |
| `QLOO_MODE` | `live` |
| `QLOO_API_KEY` | Official credential, encrypted **secret** (`is_secret:true`); transfer directly from ignored local configuration, never paste into command history, documentation, client code, or tool output |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com` |
| `QLOO_PUBLIC_LIVE_ENABLED` | `true` only after explicit approval |
| `QLOO_DAILY_REQUEST_LIMIT` | `100` if approved against actual entitlement |
| `QLOO_MINUTE_REQUEST_LIMIT` | `20` if approved against actual entitlement |

5. Redeploy; Sites environment changes require a new deployment. GET `/api/health` should report live/configured with `liveVerified:false`. Health is configuration-only, makes zero Qloo calls, and does **not** query the budget table or certify Qloo availability. Confirm the table/binding independently before the first live run.
6. Missing flag, limits, binding, migration, unavailable D1, or exhausted allowance must produce an honest failure with no sample substitution. Keep the same D1 binding across redeploys. Do not reset counters or clone deployments to circumvent a cap.

If moving to an independent Cloudflare account, review the Sites wrapper, supply a real deployment identity and D1 binding, apply the migration through the host, and retain request-scoped runtime settings. A generic production Node deployment without this shared binding fails closed for live Qloo. Independent hosting is not verified by this project.

## Bounded hosted and public verification

After the production-live gate, perform one restricted venue run with **one exact artist interest**, such as the previously verified Norah Jones. Normal successful research uses one search plus three Insights requests (4 attempts). Verify source `qloo`, an exact resolved input, attributable signal IDs, explanations when supplied, Cultural DNA, three concept kinds, budget/capacity, trace counts, and blueprint rendering.

After public-access approval, switch audience to anyone/public and open an incognito signed-out desktop and mobile session. Confirm no platform login, invitation, bypass token, or access credential is needed. Perform **one cheaper refinement** using that same venue context (normally 4 additional upstream attempts because production has no cross-run response cache). Check reduced costs, history, evidence provenance, and honest live labeling. Do not embed a key or private access URL in a Devpost testing note.

Budget this verification at **8 successful upstream attempts total**, hard stop after at most **12 actual attempts total** if retries occur. Observe numeric budget-counter deltas between operations; do not retry a failed run blindly. If the first run consumes more than 8 attempts, skip the second to retain the 12-attempt ceiling. Test error/exhaustion branches using synthetic tests, not real quota exhaustion. Stop if entitlement is uncertain, the cap is unavailable, a key appears in browser assets/requests, or any mock result appears in live mode. Record actual statuses/counts and hosted revision in the audit without retaining raw Qloo response datasets.

Check generated client assets and browser requests for the actual secret literal using a private in-memory comparison; report only pass/fail. Verify key use is confined to Worker → Qloo requests. Do not enable verbose request/header logging. Do not call `qloo:smoke -- --live` additionally unless separately budgeted.

## Rollback and ongoing availability

If authorized with release, set `QLOO_PUBLIC_LIVE_ENABLED=false` and redeploy on abuse or provider failure; leave `QLOO_MODE=live` so the UI reports a configuration failure rather than quietly replacing live output with mock data. Keep the secret encrypted and preserve D1 counters. A rollback does not revoke an exposed key: revoke/rotate through Qloo if exposure occurs. Any audience rollback also requires the owner's authorization.

Check health and numeric counters manually during judging. Health does not prove upstream access. Avoid automated live canaries that consume quota. Anonymous users may deliberately exhaust the shared allowance; there is no bot identity or distributed concurrency gate. Adding account-wide caps and edge protection can be considered only within verified free controls and a separately reviewed scope.

## Submission finish

Use [Devpost draft](devpost-submission.md) and [submission checklist](submission-checklist.md). Replace link placeholders only with verified public URLs. The official deadline is October 30, 2026 at 11:45 PM EDT, equivalent to **October 31, 2026 at 9:15 AM IST**. The official overview requires an externally published app and public licensed source; videos are optional. Recheck the live [official page](https://qloo.devpost.com/) and [rules](https://qloo.devpost.com/rules) before submitting. Availability, quotas, rights, and entrant eligibility are owner confirmations; this preparation does not certify them.
