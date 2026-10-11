# Bol Studio — master audit report

> Current implementation and verification: [final local re-audit](FINAL_REAUDIT.md), [current dispositions](findings.json), and [current source inventory](current-inventory.json). Original audit prose/evidence below remains historical.


Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed during the original audit. Subsequent implementation and verification: [first fix batch](priority-fixes.md), [second fix batch](next-priority-fixes.md), [UI fixes](ui-fixes.md).

Start here: [prioritized findings](prioritized-findings.md), [coverage ledger](line-by-line-review-ledger.md), [project brain](../project-brain/PROJECT_MASTER_CONTEXT.md), [roadmap](improvement-roadmap.md).

## 1. Executive summary

The core local caption-editing and basic MP4 pipeline works on a synthetic fixture, but important boundary failures remain.30 findings include8 P1 priorities. The strongest reproduced defects are stale completion after cancel/retry, stale saves without revision, layout overflow and inert controls. Export asset containment and translation capability require attention before broader deployment. No production source fixes were made.

Details: [Executive summary](prioritized-findings.md).

## 2. Complete product understanding

Bol Studio 0.5.0 is a Hindi/English caption studio: upload media, generate/edit timed words, style animated captions, manage simple media layers, and export text or MP4. Script means Roman/native writing system. General target-language MT, LLM script generation, diarization and durable collaborative editing were not found.

Details: [Complete product understanding](end-to-end-pipeline.md).

## 3. Technology stack

React 19, TypeScript 5.9, installed Vite 7.3.6, Remotion 4.0.524, Node/tsx and native canvas; Python FastAPI/Pydantic, FFmpeg/FFprobe, Sherpa/MLX/faster-whisper, optional torchaudio Demucs and sentence-transformers. Supabase handles optional auth. Vercel hosts the UI; a Hugging Face worker is the default production API origin. Local installed versions do not establish production versions.

Details: [Technology stack](dependency-security.md).

## 4. Repository architecture

src contains the editor/shared helpers/Remotion; server contains API/auth/inference/rendering; scripts provides local startup, model preparation, fixture and benchmark utilities. Root app.py is an alternate Gradio deployment wrapper. tests contains Python and Node suites. JSON files are the project store; no migrations/database package was found.

Details: [Repository architecture](source-file-inventory.md).

## 5. Source code review coverage

95 baseline files have dispositions:78 full-read text files covering37,146 lines,17 exclusions/limited treatments,0 pending. Source ranges and SHA-256 fingerprints are recorded.100% applies only to the declared full-read text set, not all assets/dependencies/runtime behavior. Generated SVG geometry, binary assets, environment values and lockfile line review are explicitly excluded.

Details: [Source code review coverage](line-by-line-review-ledger.md).

## 6. Frontend architecture

A single App coordinates panels/modals, project/ref state, playback, history, autosave and scene state. Shared Remotion caption components and pages.ts are strengths; the large controller, duplicated state and custom dialogs are maintenance risks. No route framework or global error boundary exists.

Details: [Frontend architecture](frontend-architecture.md).

## 7. Backend architecture

FastAPI shares auth/owner middleware across entrypoints. Pydantic validates words/settings but canvas dictionaries are weakly constrained. Filesystem/process/model work surrounds an in-process RLock and shared thread pool.

Details: [Backend architecture](backend-architecture.md).

## 8. Database architecture

No application database exists. Each UUID directory stores project.json and source/preview/assets/exports. Atomic replace protects JSON from torn writes; process-local locks do not provide multi-process transactions. Supabase account storage is separate from project persistence.

Details: [Database architecture](database-analysis.md).

## 9. API architecture

23 first-party route declarations cover health/limits, project CRUD, transcription/cancel, media tokens/media/audio, exports and assets. Most routes share security middleware. There is no general rate limiter or idempotency contract. Audio download and ignored PATCH fields are concrete mismatches.

Details: [API architecture](api-endpoint-registry.md).

## 10. Video ingestion pipeline

Multipart upload writes source.bin, validates streams/limits with FFprobe and remuxes supported media before returning. Editor defers recognition until language selection.1GiB and20minute limits exist, but parser spooling, quotas and secondary-asset constraints remain gaps.

Details: [Video ingestion pipeline](video-ingestion-pipeline.md).

## 11. Audio extraction pipeline

FFmpeg maps first audio to16kHz mono PCM16 analysis WAV; source media remains for final export. Preview AAC/video transcodes are separate. Synthetic H.264/AAC ingestion/playback and stereo analysis/preview contracts were tested.

Details: [Audio extraction pipeline](audio-extraction-analysis.md).

## 12. Audio preprocessing pipeline

Silence uses an RMS gate. Optional source-rate Demucs isolates vocals, followed by energy-based boundary refinement and acoustic prominence. MLX/faster decode the original file despite separated in-memory samples, so isolation is not consistently applied.

Details: [Audio preprocessing pipeline](audio-preprocessing.md).

## 13. Speech recognition model architecture

Prepared Sherpa Hinglish is preferred; fallback depends on platform except decode_plan incorrectly forces MLX for non-Roman Sherpa requests. Models run in the worker, with optional English companion decoding and lazy process-local caches. No new quality corpus was evaluated.

Details: [Speech recognition model architecture](speech-recognition-audit.md).

## 14. Transcription and script processing

Normalization, dictionary/uroman Romanization, aligned English correction, fuzzy glossary merges and optional emoji modify word results. There is no generative script-writing model. Original per-word text does not preserve earlier transcript versions after regeneration.

Details: [Transcription and script processing](transcript-script-generation.md).

## 15. Subtitle segmentation and timing

Shared dynamic-programming grouping considers pauses, phrase boundaries and explicit joins.12 joined words bypassed the7-word ceiling. Word timing schema validity is distinct from perceptual alignment; group edits can retime words.

Details: [Subtitle segmentation and timing](subtitle-timing-segmentation.md).

## 16. Hugging Face translation integration

Hugging Face supplies model artifacts/hosting. Translation is Whisper audio-to-English decoding, not a separate hosted text API. Default Turbo selection conflicts with upstream task guidance and native Sherpa fallback conflicts with Linux support.

Details: [Hugging Face translation integration](translation-quality-and-alignment.md).

## 17. End-to-end processing pipeline

A4-second synthetic clip uploaded, opened, played, autosaved and exported with seeded captions. FFprobe confirmed720×1280 H.264/AAC at30fps and4s; a rendered frame was visually inspected. This validates media/edit/export plumbing, not ASR or translation quality.

Details: [End-to-end processing pipeline](end-to-end-pipeline.md).

## 18. Data integrity and accuracy

Job identity, expected revision and canonical word/scene contracts are the highest-leverage boundaries. Current cancellation and autosave allow stale writes. Provenance, result versioning, post-transform validation and confidence semantics need strengthening.

Details: [Data integrity and accuracy](ai-data-integrity.md).

## 19. Frontend UI audit

Desktop composition is coherent; narrow and intermediate layouts hide tool actions. Some newer overlays bypass tokens. Fix toolbar reflow and incorrect affordances while preserving the existing design identity.

Details: [Frontend UI audit](ui-design-audit.md).

## 20. UX principles audit

Several controls claim success or capabilities beyond what occurs: inert timeline search, unused safe-area command, immediate cancellation-ready state and unsupported export layers. Improve accurate feedback, predictability and recovery before expanding feature count.

Details: [UX principles audit](ux-principles-audit.md).

## 21. Subtitle editor audit

Word/group editing, highlights, split/join,40-step undo and autosave exist. Timing/metadata preservation, drag undo, project-switch local state and keyboard reachability need targeted acceptance tests.

Details: [Subtitle editor audit](subtitle-editor-audit.md).

## 22. Accessibility audit

Question-mark typing interference is reproduced; zoom suppression and inconsistent custom dialog/drag keyboard behavior are source-established. WCAG 2.2AA conformance is not certified. No real screen-reader or complete contrast test was performed.

Details: [Accessibility audit](accessibility-report.md).

## 23. Responsive design audit

All9 requested widths plus600 and900 were measured at900px height. Essential tool overflow occurs at320,375,390,428,600,900,1024.768,1280,1440,1920 fit measured toolbar state, not necessarily all workflows.

Details: [Responsive design audit](responsive-report.md).

## 24. Functional bugs

Registry records30 items with category, evidence, reproduction, impact, fixes, effort, confidence and acceptance. Confirmed tests expose cancel/retry, stale save, bounds, ignored PATCH and joined-page failures; browser checks expose keyboard/search/reflow failures.

Details: [Functional bugs](prioritized-findings.md).

## 25. Performance bottlenecks

Build JS totals954.84kB before compression; whole-project polling and playback-driven lists scale poorly by design. Shared CPU queue, companion inference and per-export bundling are likely expensive. No production throughput, heap or inference performance claims are made.

Details: [Performance bottlenecks](performance-analysis.md).

## 26. Security and privacy

Fix export path containment. Preserve existing UUID/owner/JWT/algorithm/media-scope checks. Auth-disabled workspace IDs and bundled API keys are not tenant security. Add quotas/retention and redact signed URLs. Advisory matches are version-aware with reachability caveats.

Details: [Security and privacy](security-and-privacy.md).

## 27. Testing coverage

Python 87pass/1deselected, Node 99pass, TypeScript and isolated build pass. Source-string UI tests missed behavior failures. Safe synthetic export passed. Expensive inference, production auth, full overlay parity and failure recovery were not exercised.

Details: [Testing coverage](testing-and-bugs.md).

## 28. Observability

Persisted job status/messages and local logs exist; no complete structured trace, stage timings, queue metrics, dashboards or alerting were found. Generation IDs and privacy-safe error categories should accompany reliability work.

Details: [Observability](observability-audit.md).

## 29. Design system

Light/dark semantic tokens, green accent, DM Sans/Space Grotesk/Hindi fonts and reusable components exist. Legacy CSS and undefined-token fallbacks create drift; design documentation is not proof of actual conformance.

Details: [Design system](design-system-analysis.md).

## 30. Architectural weaknesses

One large state controller, weak scene schema, process-local job/storage coordination, broad dependency ranges and import-time setup constrain reliability. Improve explicit boundaries incrementally; a rewrite is not required to fix the documented failures.

Details: [Architectural weaknesses](code-dependency-map.md).

## 31. Missing functionality

No general target-language translation, LLM script generation, diarization, separate forced alignment, durable queue, relational project database, billing or versioned bilingual transcript is implemented. These absences are scope facts, not automatically approved features.

Details: [Missing functionality](../project-brain/FEATURE_REGISTRY.md).

## 32. Top20 most important findings

The order below balances security, data integrity, broken workflows and reachability. Application priority is separate from CVSS. Remaining BOL-21–30 findings and lower-confidence observations are still in scope.

Details: [Top20 most important findings](prioritized-findings.md).

| Rank | ID | Priority | Action |
|---|---|---|---|
|1|[BOL-01](prioritized-findings.md#bol-01)|P1|Export asset paths escape their project|
|2|[BOL-02](prioritized-findings.md#bol-02)|P1|Cancelled workers can overwrite a retried job|
|3|[BOL-03](prioritized-findings.md#bol-03)|P1|Native Hindi routes to Apple-only MLX on Linux|
|4|[BOL-04](prioritized-findings.md#bol-04)|P1|Translation selects a model not trained for translation|
|5|[BOL-05](prioritized-findings.md#bol-05)|P1|Autosave omits optimistic-concurrency revision|
|6|[BOL-06](prioritized-findings.md#bol-06)|P1|Placed video and primary media changes do not match export|
|7|[BOL-07](prioritized-findings.md#bol-07)|P1|Audio download bypasses authentication and API origin|
|8|[BOL-08](prioritized-findings.md#bol-08)|P1|Responsive toolbars clip essential actions|
|9|[BOL-09](prioritized-findings.md#bol-09)|P2|Typing a question mark opens shortcuts|
|10|[BOL-10](prioritized-findings.md#bol-10)|P2|Timeline find-and-replace button opens nothing|
|11|[BOL-11](prioritized-findings.md#bol-11)|P2|Safe-area command writes an unused setting|
|12|[BOL-12](prioritized-findings.md#bol-12)|P2|Joined captions bypass the seven-word ceiling|
|13|[BOL-13](prioritized-findings.md#bol-13)|P2|Editor can create settings the server rejects|
|14|[BOL-14](prioritized-findings.md#bol-14)|P2|Vocal isolation is unused by MLX and faster-whisper decoding|
|15|[BOL-15](prioritized-findings.md#bol-15)|P2|Saved overlay URLs expire with their signatures|
|16|[BOL-16](prioritized-findings.md#bol-16)|P2|Queue and storage do not survive scaled deployment safely|
|17|[BOL-17](prioritized-findings.md#bol-17)|P2|Media admission lacks quotas and full asset constraints|
|18|[BOL-18](prioritized-findings.md#bol-18)|P2|Custom dialogs and drag controls lack consistent keyboard support|
|19|[BOL-19](prioritized-findings.md#bol-19)|P2|Application suppresses browser zoom|
|20|[BOL-20](prioritized-findings.md#bol-20)|P2|Locked npm and installed PyJWT versions have advisories|

## 33. Quick wins

Wire timeline search, correct safe-area enum, scope keyboard shortcuts, share numeric bounds, persist/reject declared PATCH fields, escape subtitle/CSV text and correct copy. Dependency updates require regressions; no automatic fix was run.

Details: [Quick wins](improvement-roadmap.md).

## 34. Long-term improvements

Durable generation-fenced jobs, transactional project metadata, persistent object storage, quotas, versioned transcripts and reproducible model evaluation address the major growth limits. Resource pools and virtualization should follow profiling.

Details: [Long-term improvements](improvement-roadmap.md).

## 35. Recommended technical roadmap

Stage 1 reliability/security → Stage 2 interaction/accessibility → Stage 3 AI capability/provenance → Stage 4 durable architecture/performance → Stage 5 evidence-backed evolution. Each issue has acceptance criteria; verify outcomes rather than source presence.

Details: [Recommended technical roadmap](improvement-roadmap.md).

## 36. Recommended UI/UX roadmap

Make essential actions fit small/intermediate containers; restore normal text entry/zoom; unify dialog focus and keyboard editing; preserve precise timing on text edits; make generation/export limitations explicit. Recheck both themes and all specified widths.

Details: [Recommended UI/UX roadmap](improvement-roadmap.md).

## 37. Unverified areas

Live production/Supabase settings, full cross-account exploit, fresh ASR/translation quality, noisy/overlapping speakers, every template/layer, green/4K/long exports, restart/disk-full recovery, second browser engine and full assistive-technology conformance remain unverified. No paid inference or production data access was performed.

Details: [Unverified areas](../project-brain/OPEN_QUESTIONS.md).

## 38. Final assessment

The audit’s source review and documentation phase is complete with explicit exclusions and test limits. The application is a functioning local caption studio with meaningful protections and tests, but it should not be treated as proven reliable multi-tenant production infrastructure until the P1 boundary defects and corresponding acceptance checks are resolved. Source changes remain for a separately authorized implementation task.

Details: [Final assessment](prioritized-findings.md).

Subsequent BOL-06 fix and verification: [media-parity-fixes.md](media-parity-fixes.md).

Subsequent BOL-12, BOL-13 and BOL-21 fixes: [caption-reliability-fixes.md](caption-reliability-fixes.md).

Subsequent BOL-14 fix and verification: [isolation-signal-fixes.md](isolation-signal-fixes.md).

Subsequent BOL-15 fix and verification: [media-link-fixes.md](media-link-fixes.md).

Subsequent BOL-16 single-process mitigation: [job-admission-fixes.md](job-admission-fixes.md). Durable scaling remains open.
