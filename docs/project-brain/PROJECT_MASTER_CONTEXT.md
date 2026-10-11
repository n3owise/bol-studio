# Bol Studio — master project context

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

Bol Studio 0.5.0 is a React/Vite video-and-audio caption editor with a Python FastAPI worker. It targets Hindi/English code-mixed captions with editable word timing, emphasis,24 animated templates, media layers and downloadable subtitles/MP4. It is not a general LLM script generator or a separate multilingual text-translation service.

The actual pipeline is multipart upload → FFprobe validation/remux → language/script choice → in-memory worker →16k mono analysis audio → optional Demucs → Sherpa/MLX/faster-whisper → normalization/romanization/English verification/glossary/timing/emphasis/emoji → project JSON → polling/editor → shared page/Remotion rendering → text downloads or Node/FFmpeg MP4. English translation changes the audio decoder task and replaces words. Default model selection currently has platform and translation-capability defects.

Projects are UUID directories with atomic JSON metadata and media files. Supabase optionally handles accounts; JWT verification scopes project ownership. Without configured accounts, workspace IDs are convenience separation. There is no project SQL database or durable job broker. One process owns an RLock and shared ThreadPoolExecutor; restart marks unfinished jobs failed. Regeneration replaces words; undo is40 local snapshots, not durable revision history.

Frontend control lives mainly in src/main.tsx. Panels delegate changes to App; api.ts owns requests/media authorization; captions.ts/pages.ts/types.ts define shared editing/data contracts. CaptionTrack/Page/Word implement preview/headless captions. Scene media rendering is separate and less consistent. Preserve shared defaults/template/font catalogs, remux-before-playback, snapshot exports, asymmetric auth checks and atomic JSON writes.

The audit reviewed78 text files/37,146 lines and explicitly scoped17 baseline files for generated/binary/environment/dependency treatment. Python 87 and Node 99 tests passed; one import-side-effect test was deselected; typecheck and isolated build passed. A synthetic4s upload/play/save/burned720p30fps export succeeded. Eleven responsive widths were measured. No fresh expensive speech inference or production data access occurred.

Highest priorities: renderer asset containment; cancel/retry generation fencing; Linux native/translation engine selection; Turbo translation mismatch; revision-aware autosave; media scene/export parity; authenticated audio download; clipped mobile/tablet toolbars. [KNOWN_BUGS](KNOWN_BUGS.md) has30 prioritized records. [OPEN_QUESTIONS](OPEN_QUESTIONS.md) marks remaining uncertainty. The detailed [master audit](../audit/MASTER_AUDIT_REPORT.md) and [roadmap](../audit/improvement-roadmap.md) provide evidence and staged acceptance.

Read next: [frontend](FRONTEND_ARCHITECTURE.md), [backend](BACKEND_ARCHITECTURE.md), [AI pipeline](AI_PIPELINE_ARCHITECTURE.md), [API](API_REGISTRY.md), [data lifecycle](DATA_FLOW.md), [security](SECURITY_CONSIDERATIONS.md), [tests](TESTING_STRATEGY.md). Do not promote historical RESEARCH/CHANGELOG performance or model claims into current guarantees.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
