# Known Bugs

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

No P0 is asserted. P1 means fix before relying on the affected workflow or public multi-user use. “Verified” distinguishes execution evidence from source-verified behavior; no model accuracy or production security certification is implied. Effort estimates are engineering estimates, excluding external approvals and corpus collection.

| ID | Priority | Classification | Finding |
|---|---|---|---|
| [BOL-01](#bol-01) | P1 | Security finding | Export asset paths escape their project |
| [BOL-02](#bol-02) | P1 | Verified bug | Cancelled workers can overwrite a retried job |
| [BOL-03](#bol-03) | P1 | Verified configuration bug | Native Hindi routes to Apple-only MLX on Linux |
| [BOL-04](#bol-04) | P1 | Verified configuration bug | Translation selects a model not trained for translation |
| [BOL-05](#bol-05) | P1 | Verified bug | Autosave omits optimistic-concurrency revision |
| [BOL-06](#bol-06) | P1 | Source-verified bug | Placed video and primary media changes do not match export |
| [BOL-07](#bol-07) | P1 | Source-verified bug | Audio download bypasses authentication and API origin |
| [BOL-08](#bol-08) | P1 | Verified UI bug | Responsive toolbars clip essential actions |
| [BOL-09](#bol-09) | P2 | Verified UI bug | Typing a question mark opens shortcuts |
| [BOL-10](#bol-10) | P2 | Verified UI bug | Timeline find-and-replace button opens nothing |
| [BOL-11](#bol-11) | P2 | Source-verified bug | Safe-area command writes an unused setting |
| [BOL-12](#bol-12) | P2 | Verified bug | Joined captions bypass the seven-word ceiling |
| [BOL-13](#bol-13) | P2 | Verified API mismatch | Editor can create settings the server rejects |
| [BOL-14](#bol-14) | P2 | Source-verified bug | Vocal isolation is unused by MLX and faster-whisper decoding |
| [BOL-15](#bol-15) | P2 | Source-verified risk | Saved overlay URLs expire with their signatures |
| [BOL-16](#bol-16) | P2 | Architectural risk | Queue and storage do not survive scaled deployment safely |
| [BOL-17](#bol-17) | P2 | Security/resource risk | Media admission lacks quotas and full asset constraints |
| [BOL-18](#bol-18) | P2 | Accessibility finding | Custom dialogs and drag controls lack consistent keyboard support |
| [BOL-19](#bol-19) | P2 | Accessibility finding | Application suppresses browser zoom |
| [BOL-20](#bol-20) | P2 | Dependency finding | Locked npm and installed PyJWT versions have advisories |
| [BOL-21](#bol-21) | P2 | Source-verified bug | Inline group editing rewrites timing and word metadata |
| [BOL-22](#bol-22) | P2 | Source-verified bug | Find count and replacement use different matching rules |
| [BOL-23](#bol-23) | P2 | Verified API bug | PATCH accepts translation options but does not persist them |
| [BOL-24](#bol-24) | P2 | Export/data finding | VTT and CSV escape syntax incompletely |
| [BOL-25](#bol-25) | P2 | Performance issue | Playback and workspace polling scale with whole transcripts |
| [BOL-26](#bol-26) | P2 | AI quality risk | Model artifacts and accuracy claims are not reproducibly validated |
| [BOL-27](#bol-27) | P2 | Source-verified risk | Drag history may capture the already-dragged state |
| [BOL-28](#bol-28) | P3 | Design-system debt | New overlays use undeclared tokens and CSS contains invalid declarations |
| [BOL-29](#bol-29) | P2 | Observability risk | Job diagnostics do not provide a complete trace or recovery policy |
| [BOL-30](#bol-30) | P3 | Documentation drift | Product guidance overstates features and historical guarantees |

## BOL-01

**Fixed locally on 9 October 2026.** See [priority fix verification](../audit/priority-fixes.md). The original audit evidence below describes the pre-fix implementation.

**Export asset paths escape their project** — P1; Security finding.

- Affected file: `server/render.ts`; symbols: `renderCaptionVideo`; routes: `POST /api/projects/{id}/exports`.
- Root cause: Client canvas assetId and name are interpolated into resolve(assetsDir, ...) without containment or membership validation.
- Evidence: API probe accepted ../../other/assets/audit. Renderer validation also accepted traversal and loadImage loaded an 8×8 synthetic image outside the project (evidence/text-reproductions.txt). Full cross-account render not attempted.
- Reproduction: PATCH a disposable project with the traversal canvas element in evidence/reproduce.py; inspect resolved path in text-reproductions.json.
- User and technical impact: A caller who knows a readable image path could incorporate another project’s image into their export. This is not arbitrary text-file disclosure or shell execution.
- Recommended fix: Resolve opaque asset IDs through the current project asset manifest; reject separators, unknown IDs and paths outside a canonical project directory. Validate the complete element schema.
- Estimated effort: 1–2 days.
- Confidence: High; boundary acceptance and path escape reproduced.
- Acceptance criteria: Traversal, absolute paths, extension tricks and foreign assets rejected; own image export still works.

## BOL-02

**Fixed locally on 9 October 2026.** See [priority fix verification](../audit/priority-fixes.md). The original audit evidence below describes the pre-fix implementation.

**Cancelled workers can overwrite a retried job** — P1; Verified bug.

- Affected file: `server/app.py`; symbols: `transcription_job / retry_transcription / cancel_transcription`; routes: `POST /transcribe; POST /cancel`.
- Root cause: Cancellation is keyed only by project ID and retry clears it before the old worker acknowledges cancellation.
- Evidence: Controlled threaded probe: cancel=200, retry=200, old worker wrote OLD RESULT and changed queued retry to ready.
- Reproduction: Run evidence/reproduce.py; it blocks a fake decoder, cancels, retries, then releases the old decoder.
- User and technical impact: Stale captions are presented as a successful new run; overlapping workers can remove each other’s audio and cancellation flag.
- Recommended fix: Assign a generation/job ID; compare it on every progress/result write; keep cancelling state until acknowledgement and reject stale commits.
- Estimated effort: 2–3 days.
- Confidence: High; deterministic runtime reproduction.
- Acceptance criteria: Old worker cannot write status, words or clean up the new generation’s resources after retry.

## BOL-03

**Fixed locally on 9 October 2026.** See [second fix batch](../audit/next-priority-fixes.md). The original evidence below describes the pre-fix implementation.

**Native Hindi routes to Apple-only MLX on Linux** — P1; Verified configuration bug.

- Affected file: `server/transcription.py`; symbols: `decode_plan`; routes: `POST /transcribe`.
- Root cause: The Sherpa fallback is hardcoded to mlx, independent of platform; Linux requirements exclude mlx-whisper.
- Evidence: decode_plan(..., native, False) returns mlx and the Turbo repo; requirements contain Darwin/arm64 marker. No Linux inference was run.
- Reproduction: Call decode_plan with Sherpa/native on a Linux-target configuration.
- User and technical impact: Native Hindi and English translation fail on the configured Sherpa Linux deployment path.
- Recommended fix: Choose a supported backend by platform/capability and validate model availability before accepting the job.
- Estimated effort: 1 day.
- Confidence: High; dispatch reproduced, deployment failure inferred.
- Acceptance criteria: Linux configuration selects installed faster-whisper; Mac can select MLX; an unavailable engine fails before queuing.

## BOL-04

**Model selection fixed locally on 9 October 2026; live translation evaluation remains open.** See [second fix batch](../audit/next-priority-fixes.md). The original evidence below describes the pre-fix implementation.

**Translation selects a model not trained for translation** — P1; Verified configuration bug.

- Affected file: `server/transcription.py`; symbols: `decode_plan / transcribe`; routes: `POST /transcribe`.
- Root cause: Default multilingual model is large-v3-turbo and task=translate is passed to it.
- Evidence: Dispatch reproduced. OpenAI Whisper README explicitly says Turbo is not trained for translation; live translated audio was not evaluated.
- Reproduction: Enable translation with default MLX model or default portable Turbo configuration.
- User and technical impact: English translation cannot be relied on; source-language words may be labelled as translated.
- Recommended fix: Use a validated translation-capable checkpoint, separate task capability from engine selection, and add bilingual acceptance fixtures.
- Estimated effort: 1–3 days plus evaluation.
- Confidence: High; source and upstream capability evidence.
- Acceptance criteria: Non-English fixture produces checked English content; translation failure never masquerades as successful source transcription.

## BOL-05

**Fixed locally on 9 October 2026.** See [priority fix verification](../audit/priority-fixes.md). The original audit evidence below describes the pre-fix implementation.

**Autosave omits optimistic-concurrency revision** — P1; Verified bug.

- Affected file: `src/main.tsx`; symbols: `flushSave`; routes: `PATCH /api/projects/{id}`.
- Root cause: Backend revision guard is optional and flushSave does not send revision despite receiving it.
- Evidence: API probe: stale write without revision=200; same stale revision=409. Source flushSave body contains no revision.
- Reproduction: Open two clients, edit in A, then submit older whole-project state from B.
- User and technical impact: One tab silently overwrites another tab’s words/settings.
- Recommended fix: Send revision; preserve unsaved local state on 409 and offer compare/reload or explicit overwrite.
- Estimated effort: 1–2 days.
- Confidence: High; API behavior reproduced.
- Acceptance criteria: Two-client stale update is rejected and local unsaved edits remain recoverable.

## BOL-06

**Fixed locally (2026-10-09):** see [media parity fix report](../audit/media-parity-fixes.md). Original evidence below describes the pre-fix behavior.

**Placed video and primary media changes do not match export** — P1; Source-verified bug.

- Affected file: `server/render.ts`; symbols: `renderCaptionVideo`; routes: `POST /exports`.
- Root cause: Placed assets use loadImage, failures are silently ignored, and rendering uses source.bin rather than the editor’s active media selection.
- Evidence: Preload loop only decodes images; frame compositor reads loadedCanvasImages. Main editor has separate video/active-media paths.
- Reproduction: Add a video overlay or switch primary displayed media; compare preview and downloaded MP4. Not executed in browser.
- User and technical impact: An apparently successful export can omit visible media; project style parity does not imply scene parity.
- Recommended fix: Define one persisted scene graph and use time-aware video decoding, z-order and chromakey consistently in preview/export; reject unsupported layers visibly.
- Estimated effort: 4–7 days.
- Confidence: High for image-only export branch; composite scenarios unverified.
- Acceptance criteria: Golden exports cover image/video overlay, selected primary media, rotation, z-order and chromakey at multiple timestamps.

## BOL-07

**Fixed locally on 9 October 2026.** See [second fix batch](../audit/next-priority-fixes.md). The original evidence below describes the pre-fix implementation.

**Audio download bypasses authentication and API origin** — P1; Source-verified bug.

- Affected file: `src/main.tsx`; symbols: `downloadAudioTrack`; routes: `GET /api/projects/{id}/audio`.
- Root cause: A raw relative anchor is used instead of API_BASE and authorized download helpers. The signed-media allowlist also omits /audio.
- Evidence: Source at downloadAudioTrack; auth middleware only permits signed tokens on specified media routes. Local unauthenticated API audio tests pass and do not cover this.
- Reproduction: Use Audio .M4A on an account-enabled deployment with separate backend origin.
- User and technical impact: The UI announces download started although the protected request fails.
- Recommended fix: Fetch an authenticated blob or add a scoped audio-token route and build its URL through the API helper; announce success after response.
- Estimated effort: 0.5–1 day.
- Confidence: High; authenticated deployment not exercised.
- Acceptance criteria: Valid account downloads audio; expired session refreshes; another account cannot download it.

## BOL-08

**Fixed locally on 9 October 2026.** See [UI fix verification](../audit/ui-fixes.md). Original evidence below describes the pre-fix implementation.

**Responsive toolbars clip essential actions** — P1; Verified UI bug.

- Affected file: `src/styles.css`; symbols: `studio-navbar / timeline-top-bar`; routes: `Editor`.
- Root cause: Fixed-width toolbar contents exceed available width while ancestors hide overflow.
- Evidence: Eleven widths measured in evidence/responsive.json; screenshot editor-320.png shows clipped Export and timeline actions.
- Reproduction: Open six-word fixture at 320/375/390/428/600/900/1024 px.
- User and technical impact: Export is clipped at 320/375; timeline search/fullscreen and other controls leave the viewport at additional widths.
- Recommended fix: Reflow toolbars or provide a reachable overflow menu; preserve visible primary actions and keyboard focus.
- Estimated effort: 1–2 days.
- Confidence: High; browser measured.
- Acceptance criteria: All requested widths expose every action without hidden focus or page-level horizontal overflow; recheck populated and empty states.

## BOL-09

**Fixed locally on 9 October 2026.** See [UI fix verification](../audit/ui-fixes.md). Original evidence below describes the pre-fix implementation.

**Typing a question mark opens shortcuts** — P2; Verified UI bug.

- Affected file: `src/main.tsx`; symbols: `global keydown listener`; routes: `Editor`.
- Root cause: The ? shortcut is handled before the editable-target guard. Cmd+Z/B ordering has the same source-level concern.
- Evidence: Browser focused Project name, pressed ?, and Keyboard Shortcuts opened.
- Reproduction: Focus a name or caption text input and type ?.
- User and technical impact: Normal text entry is interrupted; native editing shortcuts can be intercepted.
- Recommended fix: Apply editable-target detection before global editing/help commands, allowing only explicitly intended shortcuts.
- Estimated effort: 0.5 day.
- Confidence: High for ?; other inputs/keys source-verified.
- Acceptance criteria: Typing punctuation and native undo work in input, textarea and contenteditable; help shortcut works outside them.

## BOL-10

**Fixed locally on 9 October 2026.** See [UI fix verification](../audit/ui-fixes.md). Original evidence below describes the pre-fix implementation.

**Timeline find-and-replace button opens nothing** — P2; Verified UI bug.

- Affected file: `src/main.tsx`; symbols: `setShowSearchBar`; routes: `Editor`.
- Root cause: Button toggles showSearchBar used only for active styling; it does not open the existing search-replace modal.
- Evidence: Browser click produced no search UI; source references consist of state, class and setter.
- Reproduction: Click timeline Search and replace.
- User and technical impact: A labelled action appears to work but does not enable the task.
- Recommended fix: Wire the button to the shared search-replace modal and remove unused state.
- Estimated effort: <0.5 day.
- Confidence: High; browser reproduced.
- Acceptance criteria: Button opens the same functional dialog as the command palette.

## BOL-11

**Fixed locally on 9 October 2026.** See [UI fix verification](../audit/ui-fixes.md). Original evidence below describes the pre-fix implementation.

**Safe-area command writes an unused setting** — P2; Source-verified bug.

- Affected file: `src/components/CommandPalette.tsx`; symbols: `toggle-safe-area command`; routes: `Editor / PATCH project`.
- Root cause: Command writes showSafeArea while preview uses safeAreaFor(settings.safeArea).
- Evidence: Command source lines 152–160 compared with main safeArea memo.
- Reproduction: Run Show Safe Area Guides in Cmd+K.
- User and technical impact: Command changes state without showing the advertised guides; tour overstates guaranteed protection.
- Recommended fix: Write an explicit safeArea enum and use accurate Reels/Shorts names; remove obsolete flag.
- Estimated effort: <0.5 day.
- Confidence: High; source-verified.
- Acceptance criteria: Palette and Text panel show identical selected platform and rendered zones.

## BOL-12

**Fixed locally (2026-10-09):** see [caption reliability verification](../audit/caption-reliability-fixes.md). Original evidence below describes the pre-fix behavior.

**Joined captions bypass the seven-word ceiling** — P2; Verified bug.

- Affected file: `src/lib/pages.ts`; symbols: `breakSegment / buildPages`; routes: `All caption render/export paths`.
- Root cause: If a no-break chain exceeds maxWords, dynamic programming leaves from[n]=0 and emits the whole chain.
- Evidence: Twelve joined words produced one twelve-word page in text-reproductions.json.
- Reproduction: Set lineBreak=false across twelve consecutive words and buildPages(words,7).
- User and technical impact: Long merged lines can overrun layout and contradict the documented maximum.
- Recommended fix: Specify whether user joins override the ceiling; either constrain merges or provide a deterministic legal fallback.
- Estimated effort: 0.5–1 day.
- Confidence: High; runtime reproduced.
- Acceptance criteria: Overlong joins never silently violate the agreed ceiling and preserve every word exactly once.

## BOL-13

**Fixed locally (2026-10-09):** see [caption reliability verification](../audit/caption-reliability-fixes.md). Original evidence below describes the pre-fix behavior.

**Editor can create settings the server rejects** — P2; Verified API mismatch.

- Affected file: `src/components/TextPanel.tsx`; symbols: `setCaptionSize / preview position drag`; routes: `PATCH project`.
- Root cause: Linked size ratio can produce heroFontSize>200; preview positioning permits values below backend position minimum10.
- Evidence: API probes return422 for position4 and heroFontSize300; source controls allow these values.
- Reproduction: Drag project captions near top edge or increase linked caption size at high hero ratio.
- User and technical impact: Autosave fails after a valid-looking gesture, leaving work unsaved.
- Recommended fix: Share bounds and clamp linked quantities as a pair; expose a valid drag range.
- Estimated effort: 0.5–1 day.
- Confidence: High; rejection reproduced.
- Acceptance criteria: Every value produced by UI controls round-trips through backend validation.

## BOL-14

**Fixed locally (2026-10-10):** see [vocal isolation verification](../audit/isolation-signal-fixes.md). Original evidence below describes the pre-fix behavior.

**Vocal isolation is unused by MLX and faster-whisper decoding** — P2; Source-verified bug.

- Affected file: `server/transcription.py`; symbols: `transcribe`; routes: `POST /transcribe`.
- Root cause: Separated samples replace audio in memory but file-based decoders receive the original audio_path.
- Evidence: Sherpa receives audio array; both other branches transcribe str(audio_path).
- Reproduction: Enable isolation with MLX/faster-whisper and inspect decoder input using a stub.
- User and technical impact: User pays separation time without recognition using the cleaned signal; boundary/emphasis analysis uses a different signal.
- Recommended fix: Pass the processed array where supported or write a scoped processed WAV, with explicit provenance and cleanup.
- Estimated effort: 1 day.
- Confidence: High; source data-flow verified.
- Acceptance criteria: All engines consume the chosen signal; failed separation reports fallback and never prevents ordinary transcription.

## BOL-15

**Fixed locally (2026-10-10):** see [media credential verification](../audit/media-link-fixes.md). Original evidence below describes the pre-fix behavior.

**Saved overlay URLs expire with their signatures** — P2; Source-verified risk.

- Affected file: `src/main.tsx`; symbols: `canvas element creation / openProject`; routes: `Asset media GET`.
- Root cause: Canvas elements persist source URLs rather than reconstructing them from asset IDs and fresh authorization.
- Evidence: Canvas src is assigned from mediaUrl and saved in project canvasElements; token TTL is two hours.
- Reproduction: Save an asset layer, reopen after its signed URL expires. Not elapsed-time tested.
- User and technical impact: Previously saved overlays can disappear while project media itself refreshes correctly.
- Recommended fix: Persist IDs and relative asset references; generate current URLs when loading/rendering.
- Estimated effort: 1–2 days.
- Confidence: Medium-high; expiry scenario unexecuted.
- Acceptance criteria: A project opened after token expiry/restart reloads all authorized overlays.

## BOL-16

**Mitigated locally (2026-10-10); scaling remains open:** see [job admission verification](../audit/job-admission-fixes.md). Original evidence below describes the audited implementation.

**Queue and storage do not survive scaled deployment safely** — P2; Architectural risk.

- Affected file: `server/app.py`; symbols: `EXECUTOR / LOCK / lifespan / write_project`; routes: `All jobs and project writes`.
- Root cause: ThreadPoolExecutor queue and RLock are process-local; JSON files lack multi-process transactions; restart marks jobs failed.
- Evidence: Source review; no restart/load test performed against user data.
- Reproduction: Run two worker processes or restart during a queued job in staging.
- User and technical impact: Lost jobs, stale writes and capacity contention between rendering and speech processing.
- Recommended fix: Keep one process as an explicit supported mode now; add bounded durable jobs, job leases and transactional project storage before scaling.
- Estimated effort: 1–3 weeks.
- Confidence: High for architectural properties.
- Acceptance criteria: Restart-safe jobs, bounded queue, tenant limits and duplicate-delivery-safe writes proven in staging.

## BOL-17

**Media admission lacks quotas and full asset constraints** — P2; Security/resource risk.

- Affected file: `server/app.py`; symbols: `upload_project / upload_project_asset / create_export`; routes: `POST uploads / exports`.
- Root cause: Upload loop byte cap follows multipart parsing; assets lack primary-media dimension/duration caps; job queue is unbounded.
- Evidence: Source inspection. No oversized or exhaustion attack performed.
- Reproduction: Use small boundary fixtures and mocked limits; separately test multipart admission at reverse proxy.
- User and technical impact: Authenticated or unauthenticated deployments may exhaust disk, memory or worker capacity.
- Recommended fix: Enforce request-body cap upstream, per-owner storage/concurrency budgets, bounded queue and consistent media limits.
- Estimated effort: 2–4 days.
- Confidence: High; resource impact not load-measured.
- Acceptance criteria: Over-budget requests fail before spooling/queuing, cleanup is verified and other users remain responsive.

## BOL-18

**Custom dialogs and drag controls lack consistent keyboard support** — P2; Accessibility finding.

- Affected file: `src/components/CommandPalette.tsx`; symbols: `CommandPalette / OnboardingTour / MediaPanel custom dialogs`; routes: `Editor`.
- Root cause: Some dialogs bypass shared Modal focus management; word insertion is removed from Tab order and drag operations lack equivalent controls.
- Evidence: Source review; common Modal is stronger than custom implementations. No assistive-technology certification.
- Reproduction: Tab/Shift+Tab through palette, tour and media dialogs; operate word insertion/movement without a pointer.
- User and technical impact: Focus can leave dialogs or reach background; editing requires a pointer.
- Recommended fix: Reuse Modal, label dialogs and controls, return focus, and supply keyboard move/insert commands.
- Estimated effort: 2–4 days.
- Confidence: High for missing implementation; full AT behavior unverified.
- Acceptance criteria: Keyboard-only completion of editing/media dialogs with contained focus and restored trigger; screen-reader smoke test.

## BOL-19

**Application suppresses browser zoom** — P2; Accessibility finding.

- Affected file: `src/main.tsx`; symbols: `global wheel / key handlers`; routes: `Editor`.
- Root cause: Ctrl-wheel and Ctrl +/-/0 are prevented globally.
- Evidence: Source-verified prevention logic; browser zoom was not force-changed during audit.
- Reproduction: Attempt browser zoom shortcuts while editing.
- User and technical impact: Low-vision users lose expected browser magnification; timeline zoom conflicts with browser conventions.
- Recommended fix: Scope timeline gestures to the timeline and leave browser zoom shortcuts intact.
- Estimated effort: 0.5 day.
- Confidence: High; source-verified.
- Acceptance criteria: 200% text resize and 400% reflow work; timeline zoom retains accessible alternatives.

## BOL-20

**Locked npm and installed PyJWT versions have advisories** — P2; Dependency finding.

- Affected file: `package-lock.json`; symbols: `Dependency graph`; routes: `Build/render/auth dependencies`.
- Root cause: npm scan reports source-map-js1.2.1 and fast-uri3.1.7; OSV selected-package scan flags PyJWT2.14.0.
- Evidence: evidence/npm-audit.json, python-advisories.json and dependency-security.md.
- Reproduction: Repeat advisory queries against the recorded graph; do not infer exploitability from severity alone.
- User and technical impact: Maintenance exposure; observed first-party paths do not establish public exploitability of these advisories.
- Recommended fix: Update through compatible patched versions, lock Python dependencies, rerun build/auth/render tests and scan deployment image.
- Estimated effort: 1–2 days.
- Confidence: High version match; application reachability limited.
- Acceptance criteria: No affected recorded versions remain; auth constraints and render/build behavior still pass.

## BOL-21

**Fixed locally (2026-10-09):** see [caption reliability verification](../audit/caption-reliability-fixes.md). Original evidence below describes the pre-fix behavior.

**Inline group editing rewrites timing and word metadata** — P2; Source-verified bug.

- Affected file: `src/components/CaptionsPanel.tsx`; symbols: `inline group editing / timestamp format`; routes: `Editor`.
- Root cause: Group text replacement redistributes timing and recreates word records; display rounds timing to tenths.
- Evidence: Source-reviewed edit callbacks and main group replacement path.
- Reproduction: Edit only group spelling on irregularly timed words with emphasis/glossary metadata; compare before/after.
- User and technical impact: Manual corrections may change synchronization and lose provenance or emphasis.
- Recommended fix: Preserve matched IDs and timings; make retiming explicit, distinguish estimated timings and keep raw precision separate from display.
- Estimated effort: 2–3 days.
- Confidence: High data-flow; interactive scenario not replayed.
- Acceptance criteria: Spelling-only edits preserve unaffected timing/metadata; insertions explain estimated boundaries.

## BOL-22

**Find count and replacement use different matching rules** — P2; Source-verified bug.

- Affected file: `src/components/StudioModals.tsx`; symbols: `search-replace / replaceAllOccurrences`; routes: `Editor`.
- Root cause: Dialog counts substring matches while helper replaces exact normalized words; blank replacement can create invalid empty text.
- Evidence: Compare StudioModals count with captions.ts replaceAllOccurrences.
- Reproduction: Find a substring inside a longer word, then replace; try empty replacement in disposable data.
- User and technical impact: Reported matches need not change; a blank replacement may make save fail.
- Recommended fix: Share matcher between count and execution; support explicit delete or reject empty replacement.
- Estimated effort: 0.5–1 day.
- Confidence: High; source-verified.
- Acceptance criteria: Count equals replacements; punctuation/case/empty replacement fixtures pass.

## BOL-23

**Fixed locally on 9 October 2026.** See [second fix batch](../audit/next-priority-fixes.md). The original evidence below describes the pre-fix implementation.

**PATCH accepts translation options but does not persist them** — P2; Verified API bug.

- Affected file: `server/app.py`; symbols: `ProjectPatch / patch_project`; routes: `PATCH project`.
- Root cause: Schema declares emoji and translate but patch handler applies neither.
- Evidence: Probe PATCH translate=true returns200 with translate absent. TranscribeRequest path does apply it.
- Reproduction: PATCH a project with translate=true or emoji=true and reread.
- User and technical impact: API clients receive success for ignored changes.
- Recommended fix: Persist declared fields or reject unsupported PATCH inputs; keep generation request semantics explicit.
- Estimated effort: <0.5 day.
- Confidence: High; runtime reproduced for translate.
- Acceptance criteria: Every declared mutable field round-trips or returns a documented rejection.

## BOL-24

**VTT and CSV escape syntax incompletely** — P2; Export/data finding.

- Affected file: `src/lib/captions.ts`; symbols: `subtitleText / csvTranscript`; routes: `Client text downloads`.
- Root cause: VTT injects raw caption text; CSV quoting does not neutralize spreadsheet formulas.
- Evidence: Probe produces raw <test>& in VTT and quoted =1+1 CSV cell. Spreadsheet execution not performed.
- Reproduction: Export captions containing markup delimiters or leading formula characters.
- User and technical impact: VTT players may interpret text as markup; spreadsheet consumers may evaluate user-authored cell text.
- Recommended fix: Escape VTT cue text; offer safe spreadsheet text escaping with documented round-trip behavior.
- Estimated effort: 0.5–1 day.
- Confidence: High output evidence; target-editor behavior not tested.
- Acceptance criteria: Literal angle brackets/ampersands display correctly; formula-like words open as text in supported spreadsheets.

## BOL-25

**Playback and workspace polling scale with whole transcripts** — P2; Performance issue.

- Affected file: `src/main.tsx`; symbols: `project list poll / playback render`; routes: `GET /projects and /projects/{id}`.
- Root cause: Full projects and words are polled; every caption row participates in playback-driven rendering; no transcript virtualization.
- Evidence: Source structure; bundle measured separately. No long-transcript latency benchmark.
- Reproduction: Profile long synthetic transcript and many disposable projects.
- User and technical impact: Payload, render work and memory grow with history and transcript size.
- Recommended fix: Use summary listing/pagination, targeted job polling and memoized/virtualized caption rows after profiling.
- Estimated effort: 3–5 days.
- Confidence: High design evidence; quantitative impact unmeasured.
- Acceptance criteria: Record bounded payload and responsive playback on agreed long-transcript fixture.

## BOL-26

**Model artifacts and accuracy claims are not reproducibly validated** — P2; AI quality risk.

- Affected file: `server/transcription.py`; symbols: `model loaders / English companion`; routes: `Transcription`.
- Root cause: Default model downloads lack pinned revisions; companion may run a second full pass; no consented held-out corpus is supplied.
- Evidence: Preparation scripts allow revisions but runtime defaults do not enforce them; benchmark excludes failures from score means.
- Reproduction: Record actual revisions, task settings, failures and correction/timing errors on a held-out corpus.
- User and technical impact: Quality changes cannot be attributed reliably; benchmark averages can hide failures.
- Recommended fix: Pin artifacts, persist engine/task/revision/preprocessing metadata, report failures and evaluate code-switching/timing separately.
- Estimated effort: 3–5 days infrastructure plus corpus work.
- Confidence: High evidence; no fresh accuracy metric claimed.
- Acceptance criteria: Reproducible run metadata and failure-inclusive evaluation with human references.

## BOL-27

**Drag history may capture the already-dragged state** — P2; Source-verified risk.

- Affected file: `src/main.tsx`; symbols: `markEdit / timeline drag callbacks`; routes: `Editor`.
- Root cause: Continuous drag updates pass history=false; final update records the state after intermediate mutations rather than the original drag snapshot.
- Evidence: Source callback ordering. Full pointer drag/undo reproduction not completed.
- Reproduction: Drag a word through multiple events, release, undo once; compare exact starting timing.
- User and technical impact: Undo can appear ineffective or restore only the last movement.
- Recommended fix: Capture one immutable pre-drag snapshot and commit a single history entry at pointerup.
- Estimated effort: 1 day.
- Confidence: Medium-high; requires interactive reproduction.
- Acceptance criteria: One drag equals one undo step and restores exact original state.

## BOL-28

**New overlays use undeclared tokens and CSS contains invalid declarations** — P3; Design-system debt.

- Affected file: `src/styles.css`; symbols: `shortcut / tour / export styles`; routes: `Editor overlays`.
- Root cause: Several new rules fall back to fixed dark colors via undefined --color-surface/--color-text; some background declarations have an extra parenthesis.
- Evidence: Complete CSS review; token references and declaration syntax checked.
- Reproduction: Inspect light-theme shortcuts/tour and CSS parsing diagnostics.
- User and technical impact: Theme inconsistency and ignored styling; stylesheet is difficult to maintain.
- Recommended fix: Use existing semantic tokens; remove invalid/dead declarations after screenshot comparison.
- Estimated effort: 1–2 days.
- Confidence: High source evidence.
- Acceptance criteria: Both themes use defined tokens, CSS parser reports no syntax issues, visual regressions reviewed.

## BOL-29

**Job diagnostics do not provide a complete trace or recovery policy** — P2; Observability risk.

- Affected file: `server/app.py`; symbols: `LOGGER / progress / export_job`; routes: `All jobs`.
- Root cause: Progress is persisted as messages, but there is no correlation trace, structured stage timing, queue metrics or alert pipeline.
- Evidence: Source review; export logs are local and errors are partly generic.
- Reproduction: Induce extraction, decode, storage and render failures in staging.
- User and technical impact: Support cannot reliably separate model startup, queue delay and processing failure.
- Recommended fix: Add job/generation IDs, stage durations/error categories, bounded logs, redaction and recovery playbooks.
- Estimated effort: 2–4 days.
- Confidence: High; operational completeness not production-tested.
- Acceptance criteria: Each failed job identifies stage/category/retry action without logging private transcript or tokens.

## BOL-30

**Product guidance overstates features and historical guarantees** — P3; Documentation drift.

- Affected file: `CHANGELOG.md`; symbols: `README / DESIGN / RESEARCH / onboarding copy`; routes: `Documentation and onboarding`.
- Root cause: Historical claims include15-minute tokens, complete reduced-motion treatment, absent projects entry, and guaranteed safe-area protection; current code differs.
- Evidence: Current TTL2h, projects restored, partial motion overrides and visual-only safe areas.
- Reproduction: Compare current UI/config to those passages.
- User and technical impact: Future development can reintroduce mistakes by treating historical descriptions as current contracts.
- Recommended fix: Keep changelog historical but label current context and capability limitations in project brain; qualify local/cloud storage wording.
- Estimated effort: 0.5–1 day.
- Confidence: High; source/document comparison.
- Acceptance criteria: Current operational docs agree with code and separate prior observations from current evidence.


Source report: [audit chapter](../audit/prioritized-findings.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
