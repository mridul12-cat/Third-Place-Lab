# Decisions

- One server-rendered React app; use the Sites-supported Vinext runtime to deploy App Router handlers on Workers. Next.js compatibility is not a claim of official Next.js hosting.
- No user account, paid LLM, or external image dependency. Demo mode is database-free; production live uses D1 only for shared request counters. Browser storage holds drafts/plans.
- Mock IDs are prefixed `sample-`; fictional recommendation entities never impersonate Qloo data. User seed names are user supplied.
- Deterministic planning is the baseline: tools resolve signals, sparse results trigger broadening, ambiguity is excluded, constraints scale budgets, refinements rerun bounded research.
- At most six searches and four insights calls per run. Strict exact-name resolution intentionally sacrifices recall over ambiguous evidence.
- No raw-response caching: avoid retaining licensed datasets until applicable Qloo terms are confirmed. Browser plans contain normalized evidence; do not publish live exports without reviewing applicable terms.
- Budget estimates are illustrative INR amounts, never researched prices. Capacity is an owner-supplied maximum.
- Input/concurrency limits remain per isolate; production live additionally requires a shared D1 outgoing allowance and explicit kill switch. Native per-location rate limits alone cannot cap worldwide Qloo consumption.

- Portable development uses the Node Vinext server; Cloudflare remains enabled for production and managed previews. This avoids the local Worker emulator startup dependency.

## Pre-API audit decisions

- Use a finite, explicitly synthetic semantic catalog rather than hashing arbitrary names into apparent cultural matches. Unknown names are unresolved; a deliberate ambiguous fixture exercises rejection.
- Cultural references inform actual activity mechanisms. Domain fallback is attributed to the actual returned category. Sample theme metadata is never called Qloo explainability.
- Treat operational parsing as limited rules plus mandatory host review, not universal accessibility compliance. Recognized no-food/no-audio/time/capacity constraints change plan delivery and calculations.
- Transmit validated revision history through the existing refinement endpoint; preserve prior family/direction/surprise adaptations. Accept a context reevaluation action without adding UI controls.
- Fail closed on ambiguous or missing response categories. Prefer documented subtype over the generic urn:entity class; never infer an unsupported category from the requested filter.
- Keep upstream origins fixed to approved Qloo HTTPS hosts, deny redirects, bound bytes/retries/concurrency/run time, and propagate disconnect cancellation. The original per-isolate input limits are now supplemented by a shared production allowance.
- Disable initially rendered navigation/CTAs until hydration can service clicks, preserving their normal appearance and behavior after initialization.
- The smoke command is dry by default and opt-in for at most two future API calls. A smoke success does not establish full live-provider verification.

## Public release preparation decisions

- Reuse existing D1/Drizzle dependencies for an atomic fixed-window allowance; do not add paid gateways or store raw cultural responses. Count failures/retries conservatively, fail closed on missing protection, and cap each run at twelve attempts.
- Keep hosted activation, public access, public GitHub publication, and submission behind explicit owner approvals. Export fresh source rather than publishing private managed history or deployment identity.
