# Executed tests and bugs

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

| Check/input | Expected | Actual | Result/evidence |
|---|---|---|---|
|Python safe suite|Contracts pass without root bootstrap|87 passed,1 deselected,2 deprecation warnings,73.20s|Pass: evidence/pytest.txt|
|Node suite|Caption/helper contracts pass|99 passed,0 failed,4974ms|Pass: evidence/node-tests.txt|
|TypeScript noEmit|No type errors|Exit0|Pass: evidence/typecheck.txt|
|Production frontend build in isolated copy|Build and chunk output|Exit0,1.70s|Pass: evidence/build.txt|
|4s synthetic H.264/AAC upload, autostart=false|201, ready, no inference|201 then fixture words PATCH200|Pass, temp backend only|
|Browser open/play/rename|Playback and persistent name|Reached4s; name Audit saved fixture persisted|Pass: browser-save-export.json|
|720p30fps burned export|Playable4s H.264/AAC|Ready; ffprobe720×1280,30/1,4s,73607bytes|Pass: export-probe.json; export-frame.png visually inspected|
|Cancel/retry fake worker|Old result cannot win|OLD RESULT overwrote queued retry|Bug BOL-02; reproductions.json|
|Stale write|409 conflict|200 without revision;409 with revision|Bug BOL-05|
|UI-produced settings probes|Accepted|position4/hero300 return422|Bug BOL-13|
|PATCH translate|Persist option|200 but absent|Bug BOL-23|
|Canvas traversal|Reject foreign path|200; resolved outside project|BOL-01 boundary verified, full disclosure not exercised|
|Twelve joined words|Respect ceiling|One page of12|Bug BOL-12; text-reproductions.json|
|Question mark inside name|Text entry|Shortcut modal opened|Bug BOL-09|
|Timeline Find & Replace|Search interface|Only state styling changes|Bug BOL-10|
|Responsive eleven widths|Reachable tools|Clipping in7 measured widths|BOL-08; responsive.json|

Commands: `.venv/bin/python -m pytest tests -q -k 'not the_space_entrypoint_actually_enforces_the_gate'` with auth disabled/model downloads offline; `node --import tsx --test tests/captions.test.ts`; `tsc --noEmit --incremental false`; Vite build in a source copy. Audit reproductions run with `PYTHONPATH=. .venv/bin/python docs/audit/evidence/reproduce.py` and `node --import tsx docs/audit/evidence/reproduce.mts`. They create only temporary synthetic data and stub model execution.

One root-entrypoint test was deliberately deselected because importing root app.py performs runtime preparation/model download. scripts/smoke-test.py was not run: it executes real inference and also has an outdated30fps assertion against the backend’s60fps default. No claim is made that the complete npm test command passes. Live speech quality, production Supabase sessions, second browser engine, long render/4K, green/video overlays, storage failure and recovery remain unverified.
