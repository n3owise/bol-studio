# Security and privacy

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The strongest first-party security finding is BOL-01: canvas asset paths are not constrained to the current project during export. A synthetic path escape, API/renderer acceptance and loading an 8×8 image outside the project were demonstrated without reading private images. Authentication middleware cannot repair an internal renderer that accepts arbitrary asset paths after authorization. Fix both schema and resource resolution.

Positive controls: UUID path validation for project routes; optional verified Supabase identity; issuer/audience/expiry requirements; ES256/RS256 algorithm allowlist; owner check shared across project routes; project-scoped expiring GET media signatures; argument-vector subprocess calls; finite Word/settings validation; atomic project JSON writes. Existing tests cover cross-user access, invalid/expired JWTs, algorithm confusion, signed token scope and CORS stripping.

Auth-disabled mode trusts a browser workspace ID and exposes unowned projects by design; it must not be marketed as secure multi-tenant auth. VITE_API_KEY ships publicly and is only a traffic deterrent. Media URLs are bearer capabilities lasting2h; sanitize query strings in logs and avoid persisting them as durable scene data. An ephemeral signing secret invalidates tokens on restart and differs across processes unless configured consistently.

Uploads, codecs, image decoding and unbounded jobs remain resource boundaries (BOL-17). There is no storage quota/retention policy, tested backup restore, encrypted object-storage design or malware scan in this code. Project deletion removes its directory but infrastructure backups/logs require separate policies. Passwords are handled by Supabase SDK/auth, not this Python backend.

External data paths: browser sends media/transcripts to configured API; browser sends credentials to Supabase; backend fetches JWKS and model artifacts. Model inference executes in the worker. No first-party hosted MT/LLM request was found. Hosted worker processing is not equivalent to on-device privacy. Production configuration, TLS/proxy behavior and tenant deployment state were not inspected. See dependency-security.md for version-specific advisory scope.
