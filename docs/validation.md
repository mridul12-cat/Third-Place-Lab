# Verification record

This records the original build. For the latest audit and expanded results, see [pre-api-readiness-audit.md](pre-api-readiness-audit.md).

Run on October 16, 2026, locally on macOS / Node 25.5.0.

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 36 unit/integration cases passed in two files. Uses synthetic HTTP fixtures only.
- `npx playwright test`: two complete journeys passed, desktop Chromium and 390px mobile Chromium. Covers sample loading, venue edit, generation, three concepts, DNA sources, generic comparison, evidence inspection, material cheaper revision, editable budget, JSON download, and print invocation.
- Additional Chromium visual inspection: landing page, mobile results, and print CSS captured and inspected. No browser page errors; 390px document and body widths matched.
- Production build: passed before the final UI polish; repeated in publication packaging.
- Secrets: provider imports are guarded by `server-only`; .env.local is ignored, .env.example is explicitly included. No live API key supplied or stored.

## What is not proven

- The print-command test intercepts window.print; print CSS was separately inspected, but physical printers and every browser's pagination are not tested.
- Live Qloo calls, account entitlements, real response shape, explainability coverage, and quota are not verified.
- Public source publication requires a connected GitHub account. The Sites source repository is not a substitute for a public hackathon repository.
- Hosting, anonymous visitor access, and production API checks are recorded after deployment in the delivery report.

## Recovered setup issues

The initial sandboxed npm install failed; the authorized retry succeeded. Portable Worker preview startup stalled, so local development uses the Node Vinext runtime while production retains the Cloudflare build. Browser installation was required. The first mobile test used an accessible name containing text intentionally hidden on mobile; its selector was corrected to target the stable visible label. No application behavior was weakened to pass the test.

## October 23 release preparation

Latest results: 108 unit/integration tests, 8 desktop/mobile cases, typecheck, lint, and production build pass. Local D1 migration and built Worker kill switch pass. See [public release audit](public-release-audit.md) for actual checks, bounded earlier live results, and hosted/public steps still unverified. Historical unverified statements above describe the original build.

## October 30 native migration

See [native migration](native-next-migration.md) for current results and limitations. The active build now uses native Next.js; the original Worker path is an explicit rollback command. Hosted Turso concurrency/persistence and native Vercel operation remain unverified.
