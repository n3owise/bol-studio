# Final local re-audit — 10 October 2026

The team completed the local repair pass, independently compared the original audit with current source, fixed additional omissions discovered in that comparison, then reran the combined checks. **All executed final local checks passed. Full production/model/accessibility acceptance is not established.** This report separates those conclusions rather than relabeling missing evidence as a pass.

The original 8–9 October report, reproduction evidence and inventory remain historical records. Current dispositions are in [findings.json](findings.json), [independent cross-audit](independent-cross-audit.md) and this report. Original causes/evidence were retained. [Current operations](../project-brain/CURRENT_OPERATIONS.md) supersedes operational statements in dated brain chapters.

Latest follow-up: [local accessibility and playback indexing](LOCAL_FOLLOWUP.md), with 139 frontend tests passing and short-height dialog evidence. The table below retains the preceding complete team pass.

Further follow-up: [cached timeline and preview lookup](TIMELINE_FOLLOWUP.md), with 141 frontend tests passing.

Latest acceptance pass (11 October): [auth, backup, operations, codecs and contrast](ACCEPTANCE_FOLLOWUP.md). This supersedes earlier statements that local backup/checker tooling is absent.

## Executed final checks

| Check | Result | Evidence |
|---|---|---|
| Backend regression | 216 passed; one external Gradio/ZeroGPU boot test deliberately excluded; two dependency deprecation warnings | [backend](evidence/team-final-backend.txt) |
| Node/frontend/renderer regressions | 137 passed, zero failed/skipped | [Node](evidence/team-final-node.txt) |
| TypeScript checking | Exit 0 | [typecheck](evidence/team-final-typecheck.txt) |
| Isolated production build | Exit 0; checkout fonts/output preserved | [build](evidence/team-final-build.txt) |
| npm dependency audit | Zero reported vulnerabilities after targeted patches | [npm](evidence/team-npm-security.json) |
| Selected installed Python dependencies | 16 versions queried against OSV, zero returned advisories; package compatibility check passed | [Python](evidence/team-python-security.json) |
| Actual caption/media exports | Burned 720p at 24 fps, green 720p at 30 fps, burned 1080p at 60 fps; expected H264/duration/AAC properties | [render matrix](evidence/team-final-render-matrix.json) |
| Running API export | Accepted→rendered→downloaded 102,244 bytes; diagnostics persisted; snapshot/log removed | [API](evidence/team-api-export.json) |
| Long transcript browser fixture | 10,000 groups, 100 caption rows, 199 timeline groups, 301 ruler ticks; pagination reaches word 100 | [browser](evidence/team-frontend-browser.json) |
| Timeline drag | One pointer drag then one Undo restores exact .08/.48 timing | [drag](evidence/team-drag-undo.png) |
| Canvas keyboard/history/modal | Keyboard position/size; two rapid Undos restore the exact baseline and two Redos restore the edited scene; CmdK inside media dialog creates no second modal; Escape clears background inert state | [keyboard](evidence/team-final-keyboard.json) |
| Native dialog restore/theme | Keyboard-open/Escape returns focus to Keyboard shortcuts trigger; light/dark screenshots inspected | [light](evidence/team-shortcuts-light.png), [dark](evidence/team-shortcuts-dark.png) |

The dependency checks cover the npm audit database and selected Python versions on this host at query time. They do not certify every installed package or future release. The first sandboxed real-render attempt failed due local process/port restrictions; the approved synthetic-media render rerun passed. The original deployment boot test was not run against external services. Source wiring and local auth/ownership tests do not replace that test.

## Cross-check: omissions found in the second audit and corrected

| Missing from the earlier fix evidence | Resulting correction |
|---|---|
| Accepted jobs disappeared on restart | SQLite unfinished payload journal and bounded replay; completed/cancelled/deleted work skipped; legacy unjournaled jobs explicitly retryable |
| Full transcript still transferred by active/export polls | Metadata summaries during recognition and export-array-only polling; complete transcript fetched on terminal recognition status |
| Plain zoom handler still intercepted browser modifier shortcuts | Explicit modifier/numpad passthrough; timeline-only plain-key zoom preserved |
| Canvas layers remained mouse-only | Focusable labelled layers with keyboard movement, size and rotation; locked bounds respected |
| Native modal focus restored to body | Explicit post-unmount trigger restoration, verified using keyboard activation |
| Development-mode canvas mutations duplicated history | Edits moved outside React updater callbacks; synchronous history/future refs handle rapid Undo/Redo |
| Palette could create a second independent focus trap | Opening blocked while another modal is active; modal targets excluded from background editing shortcuts |
| Upload quotas did not bound aggregate parser/output resources | Global upload cap, multipart part/header limits, temp/data free-space headroom, bounded child stdout/stderr and output watchdogs |
| Many image/video layers could exhaust compositor allocations | Visual-count/native-image-pixel/overlapping-video-decoder/frame-pixel admission before renderer allocation; timed decoder release |
| Unsupported MOV/AVI/MKV preview differed from export | Bounded browser preview normalization while original download/export source stays intact; duplicate has its own preview; animated images/unsupported alpha normalization rejected clearly |
| Model/benchmark claims could not be reproduced | Immutable revisions, file hashes, primary/companion provenance and incomplete-result coverage; unsupported accuracy/same-architecture claims removed |
| Current guidance still quoted baseline behavior | README corrected and brain chapters linked to current operations; historical audit unchanged |

## All 30 original findings

“Local fixed” means the concrete source defect is corrected and cited local evidence exists. It is not a claim that every real deployment, codec, hardware or assistive technology combination has been exercised.

| ID | Current disposition | Supporting fix/evidence |
|---|---|---|
|01|Local fixed: canonical manifest containment|priority-fixes.md; asset-containment tests|
|02|Local fixed: cancellation/generation fencing|priority-fixes.md; threaded stale-worker tests|
|03|Local fixed: platform admission/routing|next-priority-fixes.md; Linux/admission decoder fixtures|
|04|Routing fixed; real translation/timing evaluation pending|model-reproducibility-and-evaluation.md|
|05|Local fixed: revision save/conflict recovery|priority-fixes.md; revision-save tests|
|06|Local synthetic parity fixed, broader codec/stress matrix pending|media-parity-fixes.md; final render matrix; normalized ProRes tests|
|07|Local fixed: protected downloads and AAC audio|next-priority-fixes.md; protected-fetch/media tests|
|08|Local responsive toolbar fixed|ui-fixes.md; 320–1440 evidence; short-height/device matrix pending|
|09|Local editable/IME shortcut guards fixed|ui-fixes.md; editable browser checks|
|10|Local shared search modal fixed|ui-fixes.md; replacement tests/browser evidence|
|11|Local Safe Area enum/labels fixed|ui-fixes.md; guides explicitly approximate|
|12|Local page ceiling fixed|caption-reliability-fixes.md; constrained grouping tests|
|13|Local shared size/position bounds fixed|caption-reliability-fixes.md; bounds tests/browser extrema|
|14|Local isolation signal routing fixed; true quality pending|isolation-signal-fixes.md; cleaned-array/file/companion tests|
|15|Local credential/URL refresh fixed; hosted rotation pending|media-link-fixes.md; expired-url/browser/cache tests|
|16|Single-process durable recovery fixed; distributed scaling unsupported|jobs tests/current operations; persistent volume/backup required|
|17|Local request/media/storage/resource admission fixed|admission tests/render-resource-fixes.md; sampling/codec-memory limits disclosed|
|18|Local keyboard/focus improvements verified; accessibility matrix pending|team keyboard/focus/browser evidence; screen-reader testing pending|
|19|Source/native shortcut passthrough fixed; genuine 200%/400% zoom pending|frontend-reliability test; in-app shell cannot magnify page through tested keys|
|20|Reported versions patched and queried|dependency evidence above; PyJWT floor 2.15|
|21|Local timing/metadata preservation fixed|caption-reliability-fixes.md; timing/LCS tests|
|22|Local matching/count/replacement fixed|text-exports tests; one shared word matcher|
|23|Local emoji/translation flag persistence fixed|next-priority-fixes.md; backend PATCH/routing tests|
|24|Local VTT/CSV hardening fixed; target-app matrix pending|text-exports tests; JSON exact text remains available|
|25|Local rendering/payload bounds mitigated; complete device profiler pending|10k DOM evidence/poll endpoints; some whole-document/group scans remain|
|26|Model provenance fixed; real quality evaluation pending|model pins/hash/companion/benchmark tests; old upstream revisions not invented|
|27|Local drag/history fixed|pointer Undo plus rapid canvas Undo/Redo browser evidence|
|28|Local CSS/token/hover repairs verified|PostCSS/type/build checks and light/dark screenshots; not universal contrast certification|
|29|Local correlated traces/retry/recovery fixed; operations pipeline pending|diagnostics/durable/failure tests; alert/retention/backup validation remains|
|30|Current product guidance corrected|README/DESIGN/CHANGELOG/onboarding/current brain operations|

## Remaining acceptance and inputs

- A consenting held-out speech corpus with reviewed Hindi/Hinglish/English transcripts, English translation references and timing annotations is needed for real quality acceptance. The optional folder request received no path during this pass. No new large weights were downloaded and no private clip was treated as ground truth. See [model evaluation](model-reproducibility-and-evaluation.md).
- Authorized staging accounts/deployment and persistent storage are needed for hosted Supabase refresh/JWKS rotation, real Linux/GPU inference, proxy/TLS limits, deployment boot and crash/backup restoration. No external publication/deployment occurred in this local pass.
- Actual 200%/400% browser magnification, screen readers, short-height layouts and broader mobile/codec combinations require their own device/browser matrix. Bounded DOM evidence is not a full performance/assistive technology certification.
- The product explicitly supports one writer per data directory. Horizontal scaling needs transactional project storage/distributed leases; it is not silently enabled by the job journal. Stage logs have no managed alert/retention service configured. Watchdog caps can overshoot between samples; admitted RGBA pixels do not bound codec internals/Chromium/copies.

## Current inventory

The current source/config/test inventory contains **125 paths**: **29 baseline hashes changed**, **30 new paths**. [Current inventory](current-inventory.json) preserves baseline linkage and distinguishes unchanged original review, focused team review and justified exclusions. The original 95-path/78-reviewed/17-exclusion ledger was not rewritten. Generated reports, dependencies, model weights, user media and secrets are outside its line-coverage claim. This is not an assertion that every new line or every possible interaction has been exhaustively audited.
