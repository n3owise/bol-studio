# Version-aware dependency review

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Queries ran9 October2026. npm audit completed against the lock graph after the sandbox’s DNS restriction was bypassed through the approved read-only registry request. No fixes or installs were run. OSV was queried for15 selected Python packages (14 installed); this was not a complete transitive Python SBOM or container/OS scan.

| Package | Recorded version/path | Advisory and patched version | Application exposure assessment |
|---|---|---|---|
|source-map-js|1.2.1 via Vite→PostCSS|[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), high;1.2.2|Indexed source-map offsets can block parsing. First-party input flow does not accept user source maps; build-tool exposure, public route reachability not established.|
|fast-uri|3.1.7 via Remotion bundler→webpack→schema-utils→ajv|[GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), moderate;3.1.8|Host normalization ambiguity. No first-party authorization decision based on fast-uri was found. Bundler dependency still merits update.|
|PyJWT|2.14.0 installed|[GHSA-42vr-xj54-vc7v](https://github.com/advisories/GHSA-42vr-xj54-vc7v), moderate;2.15.0|Pre-verification nested payload parse. App uses its own async JWKS cache and verified jwt.decode, not PyJWKClient or verify_signature=False. Unauthenticated advisory path not demonstrated.|
|PyJWT|2.14.0 installed|[GHSA-x33g-cr3x-6449](https://github.com/advisories/GHSA-x33g-cr3x-6449), moderate;2.15.0|Inconsistent OKP private JWK identity. App allows ES256/RS256 and consumes trusted public JWKS; no DPoP/EdDSA private-JWK flow found.|

OSV returned two additional PYSEC IDs aliasing the PyJWT issues; do not count them as four independent vulnerabilities. Other queried installed versions returned no records at query time, which does not prove vulnerability-free software. Raw evidence is npm-audit.json, python-versions.json and python-advisories.json.

Installed highlights: FastAPI0.141.1, Starlette1.6.0, python-multipart0.0.32, Gradio6.26.0, torch2.14.0, torchaudio2.11.0, transformers5.17.0, huggingface-hub1.30.0, sherpa-onnx1.13.7, mlx-whisper0.4.3. faster-whisper is not installed in this Mac environment; deployment requirements include it. Torchaudio imports successfully; separation itself is untested.

Python requirements are broad ranges/unbounded lower bounds rather than an exact lock. Docker base/apt packages and model revisions are not immutable. npm uses a lock, but root Gradio bootstrap may prepare its own runtime. Record the deployed SBOM, FFmpeg version and architecture; scan OS packages separately; upgrade dependencies with auth/media regression tests. No production installed versions were inferred from the local environment.
