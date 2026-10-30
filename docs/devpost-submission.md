# Devpost draft — not submitted

Prepared October 23, 2026. Copy-ready product description follows. Complete the release checklist before submitting; local verification is not proof of public availability.

**Project:** Third Place Lab

**Tagline:** Turn little spaces into culturally grounded community gatherings.

**Public demo URL:** PENDING — restricted preview is not a submission URL.

**Public GitHub URL:** https://github.com/mridul12-cat/Third-Place-Lab — publication authorized; see github-publication.md for actual verification.

**Built with:** TypeScript, React, native Next.js App Router, Qloo API, Turso/libSQL, Zod, Vitest, Playwright. Vercel Hobby is the intended deployment target; no hosted migration or Turso provisioning has occurred. Sites/Vinext remains a rollback path.

## Inspiration

Independent cafés and bookshops often have a room, a few regulars, and a wish to bring people together. They need more than a list of popular event names. They need a gathering that reflects what their community enjoys and fits the space, time, and resources they actually have.

## What it does

Third Place Lab turns a venue profile and cultural interests into three event concepts: conversation, listening, and making. Owners can inspect the evidence and Cultural DNA, ask for a cheaper or differently directed plan, and develop a selected concept into an editable blueprint with a schedule, itemized estimate, and invitation copy.

The planning loop resolves interests, researches cross-domain references, observes gaps, broadens once when needed, plans candidates, and checks feasibility. Visible actions correspond to executed tools. Unresolved names and insufficient evidence are disclosed rather than filled with fictional Qloo findings.

## How we built it

The interface is a responsive React application backed by server-side route handlers in the Node.js runtime. Qloo is a callable cultural research tool: `/search` resolves inputs and `/v2/insights` returns references across books, artists, and films, with a fourth domain available for broadening or direction changes. The adapter preserves identity, signal IDs, affinity when supplied, and explanation metadata.

Creative planning uses deterministic, evidence-aware templates. There is no hosted LLM or claim of free-form autonomous reasoning. Returned references inform actual activities, while venue inputs control cost, capacity, atmosphere, and recognized operational constraints. The baseline comparison is rules-based; it is not a measured comparison against a frontier LLM.

Secrets remain server-side. Production live mode requires explicit activation and a shared atomic request allowance. Retries consume that allowance, failures remain visible, and no live failure silently becomes sample data. The budget database stores numeric quota windows only, not profiles or licensed Qloo response datasets.

## Challenges

Cultural entities can be ambiguous and provider payloads distinguish generic entity classes from specific categories. We added strict normalization and explicit missing-evidence handling. Refinements also needed to change budgets, groups, delivery, and resources rather than merely rename concepts; regression scenarios now cover those changes and retained history.

## What we verified

Bounded local live verification on October 23 resolved two different artist inputs and completed cross-domain planning with attributable Qloo evidence. Eight fresh successful upstream calls supported two venue runs; one budget refinement reused verified responses in a temporary local memory cache. That cache was discarded and is not a production feature. These results verify the documented scenarios, not every category, audience, or deployment.

Automated tests cover agent behavior, constraints, HTTP contracts, errors, public request validation, shared allowance enforcement, and desktop/mobile journeys. See the audit for current executed counts. Production runtime and signed-out access must still be verified after approval.

## What we learned

A useful cultural planning tool needs both an attributable reference and a practical way to use it. A reference alone does not establish attendance, demand, or a demographic fact. Honest uncertainty and material replanning are as important as a polished concept.

## What's next

Verify hosted operation and public access, review provider retention/export rights, and learn from venue-owner feedback. Prices are illustrative INR estimates and accessibility remains subject to host confirmation. No attendance, revenue, or real-world pilot outcomes are claimed.

## Testing instructions for judges — fill after release

Open PUBLIC_DEMO_URL without an account. Enter a venue and one specific artist interest, generate concepts, inspect Cultural DNA and evidence, choose a concept, request a cheaper refinement, and open the editable blueprint. Try keyboard navigation and mobile layout. If live research is unavailable, the app shows an error; it does not invent Qloo findings. Do not supply credentials. Replace this placeholder only after signed-out verification and quota review.

## Owner review before submission

Confirm authors/team, entrant eligibility, development dates and ownership, Qloo entitlement and public data-display/export permissions, and continued availability during judging. MIT covers original application code, not Qloo data or third-party services. Confirm the final text matches the actual deployed revision. Use only verified public app/source links. No accounts were registered, messages sent, or Devpost fields submitted by this preparation.
