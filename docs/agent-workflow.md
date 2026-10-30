# Bounded planning workflow

1. **Plan/context:** parse the owner profile, capacity, atmosphere, and budget.
2. **Tool calls:** resolve up to six names. Accept one exact case-insensitive match. Reject multiple exact matches, missing matches, and unsupported types. More specific names may be needed in live mode.
3. **Observe:** research book, artist, and movie domains. A listening preference puts artist first. A new direction replaces artist with brand. Preserve input IDs and API-supplied affinity/explainability without invented scores.
4. **Revise research:** if the initial three domains are empty, broaden once to brand. Stop after four discovery calls. If still empty, disclose that plans use venue-based templates and owner inputs.
5. **Evaluate:** choose distinct conversation, listening, and making structures; scale illustrative supplies by capacity and ceiling. Report capacity, cost, access, and rights checks.
6. **Finalize:** emit the three concepts, cultural themes, concise observable trace, and warnings.
7. **Owner revision:** cheaper lowers the ceiling below the previous per-person planning estimate; intimate reduces capacity; larger grows only up to the owner's venue maximum; family changes activities and timing; direction changes queried categories and activities; surprise changes central activities. Every revision reruns research and retains its visible session history.

This is a deterministic tool workflow, not an LLM or a claim of private model reasoning. It offers predictable, reviewable behavior without a paid inference dependency. A live auth or transport error terminates the run honestly; it never substitutes the mock provider.
