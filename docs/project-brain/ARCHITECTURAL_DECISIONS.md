# Architectural decisions and invariants

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

These are observed design decisions inferred from implementation/comments, not newly approved ADRs.

| Decision | Existing rationale/invariant | Consequence |
|---|---|---|
|Shared caption JSON and page builder|Keep frontend/backend templates/defaults and preview/export grouping consistent|Preserve shared validation sources|
|Remotion captions in preview/export|One animation/typography implementation|Media scene remains separate and can drift|
|Worker-local inference|Large models/media processing outside browser|Hosted mode still sends media to worker|
|Separate analysis audio|ASR wants16k mono; export wants source fidelity|Track processed-audio provenance|
|Remux before returning upload|Avoid changing bytes under Range readers|Do not move remux back into active playback|
|Atomic JSON + RLock|Simple local persistence without DB|Only one-process coordination|
|Optional accounts|Zero-config local development|Auth-disabled shared deployment is not secure tenancy|
|Asymmetric JWT verification|Avoid storing Supabase signing secret|Preserve algorithm/issuer/audience checks|
|Scoped media capabilities|Media elements cannot set headers|Tokens expire; do not persist URLs as IDs|
|Export snapshot|Edits during rendering should not mutate output|Record revision and manage retained artifacts|
|Local-only font gate|Avoid shipping unlicensed selectable font|Build and backend must agree on flag|

Future decisions requiring product/operations input: durable storage/queue, supported engine/task matrix, transcript version retention, quotas and supported export layers. Do not assume these choices are already implemented or approved.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
