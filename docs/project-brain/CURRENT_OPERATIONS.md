# Current operational corrections — 10 October 2026

This chapter supersedes implementation statements in the 8–9 October audit snapshots. Those snapshots retain their original evidence and line numbers; they do not describe the final patched implementation. Consult the final re-audit for acceptance status and executed checks. Source inspection, local tests, live authentication, model quality and production scaling are separate kinds of evidence.

## Storage, admission and jobs

The supported project store is one application process over one persistent `DATA_DIR`. An exclusive store lock prevents another process writing the same directory. Project documents remain atomic JSON files; the job payload journal is SQLite, rather than a migration of project metadata to SQL. Durable task payloads and replay are implemented in `server/jobs.py`; startup integration and replay tests passed in the final local verification. This does not authorize multiple application workers or horizontal scaling. Account identity comes from verified authentication when configured. Without authentication, workspace identifiers remain client-controlled local separation.

Admission is bounded before multipart parsing. Upload requests first pass authentication and ownership checks, then a bounded temporary body buffer; declared oversized bodies are refused before reading. Streamed bodies are capped as they arrive. The file cap remains 1 GiB, with 1 MiB of multipart envelope allowance. This application-level cap also applies to the Gradio entrypoint through shared middleware; reverse proxy limits should be configured separately for production. Multipart parsing and final file writing can create additional bounded temporary copies.

Account limits are `BOL_MAX_OWNER_STORAGE_BYTES` (default 10 GiB), `BOL_MAX_OWNER_PROJECTS` (100), `BOL_MAX_OWNER_UPLOADS` (2), `BOL_MAX_TOTAL_UPLOADS` (4), and `BOL_MAX_PROJECT_ASSETS` (500). A global upload cap bounds body buffering across owners; full capacity returns 503 with Retry-After. `BOL_MIN_DISK_FREE_BYTES` reserves 64 MiB of free-space headroom by default before pending allocations. Pending admissions reserve space under the application lock. Active exports reserve `BOL_MAX_EXPORT_BYTES` (default 1 GiB) and constrain subsequent uploads. Reservations include existing source/derived files and can conservatively reject work close to the account limit. Upload, asset, duplication and derived-media failure paths remove incomplete output. The account quota is not an operating-system filesystem quota or a guarantee against unrelated processes filling the disk.

Primary and asset media use readable duration limits of 20 minutes, positive dimensions and an 8192-pixel dimension ceiling. Uploaded images must decode as supported image codecs. Canvas schemas validate finite bounded geometry, supported media types, asset membership, unique layer IDs, timeline bounds and green-screen settings. Limits are returned by `/api/limits`; browser file selectors still show the fixed 1 GiB file cap, while account admission errors come from the server.

Encoder quota monitoring checks every 250 ms and rejects/removes over-budget output. Renderer logs are monitored at 8 MiB. These sampled watchdogs permit brief growth beyond a threshold before termination; do not describe them as byte-perfect filesystem enforcement. Audio downloads use bounded AAC conversion and per-project serialization. Job diagnostics store stage/category/retry information without transcript or credential content. Queue admission and tenant job limits are separate from storage/upload limits.

## Current API additions

- `GET /api/projects?summary=true` omits transcript words and adds `wordCount`; default listing retains the full legacy response.
- `GET /api/projects/{id}?summary=true` omits words, waveform and canvas elements, adds `wordCount`, and retains status, progress, settings and other metadata. Default project GET returns the full document.
- `GET /api/projects/{id}/exports` returns the export-job array without project transcript or scene data. Ownership checks still apply, and media tokens do not authorize enumeration.
- `PATCH /api/projects/{id}` accepts and persists emoji/translation flags, selected primary media and validated canvas elements. Revision-aware browser saves detect concurrent editing; conflict recovery preserves an unsaved backup.

Summary endpoints bound transcript transfer rather than introducing database pagination. Listings still scan/read JSON documents and retain non-transcript metadata. See [API registry](API_REGISTRY.md) for historical routes; handler line numbers in that snapshot are historical.

## Media, caption and frontend corrections

Saved media identity resolves to current authorized URLs. Old persisted signed URLs are not the lasting scene contract. Primary media selection, overlay video frame time, rotation, visibility, layering and keying are persisted/rendered through the media scene contract. See [media parity](../audit/media-parity-fixes.md) and [media links](../audit/media-link-fixes.md). Fresh hosted token rotation remains a separate live-account check.

Generation writes are fenced by transcription generation, and per-project worker serialization prevents a retry preparing shared analysis files while the older worker still uses them. Vocal isolation produces the file consumed by all decoders and companion passes; clean-up and fallback behavior are covered separately from actual recognition quality. Native/translation engine selection and supported translation model configuration are fixed, but real speech quality requires evaluation clips and downloaded model execution. See [priority fixes](../audit/priority-fixes.md), [engine/translation fixes](../audit/next-priority-fixes.md), and [isolation](../audit/isolation-signal-fixes.md).

Caption groups obey the seven-word ceiling. Text-only corrections preserve timing and metadata; explicit changes in word count/timing follow their own edit semantics. Caption sizes/positions follow shared bounds. See [caption reliability](../audit/caption-reliability-fixes.md).

Find and Replace counts and executes through one whole-word matcher, ignoring trailing punctuation on stored words; empty replacement is disabled. VTT escapes cue markup delimiters/newlines. CSV formula-like text/original fields receive an apostrophe prefix, deliberately changing those fields; JSON is the exact text interchange format. Actual target spreadsheet/player acceptance is distinct from output-string regression tests.

Frontend changes cap visible caption cards at 100 and timeline groups at 200, and sample playback updates at the caption frame rate. Summary/progress/export-only polling reduces transcript traffic. This is bounded rendering and targeted transfer, not a complete long-session profiler or a guarantee of constant-time whole-app work. Keyboard focus containment/restore, editing equivalents and rapid Undo/Redo passed local browser checks. Genuine 200%/400% magnification and screen-reader testing remain pending; source/unit tests do not establish accessibility certification.

Safe Area guides are approximate visual references and do not constrain caption placement. Media tokens last two hours. Reduced-motion handling must be checked for each interaction. Historical changelog/design performance observations are not current operational guarantees.

Unsupported video codecs receive a bounded H.264/AAC browser preview when conversion is safe. Downloads and exports retain the original source; duplicates receive their own preview. Static PNG, JPEG and WebP images are supported. Animated images and video alpha that normalization would discard are rejected with an explanation. See the [final re-audit](../audit/FINAL_REAUDIT.md) for all 30 finding dispositions and final check evidence.

## Offline recovery and operational acceptance

`python -m server.backup` creates and verifies a consistent offline snapshot and restores only to a new destination. Stop the server before creating a snapshot; the store lock enforces this. `scripts/check-operations.py` checks an explicit service origin and optionally verifies backup integrity/freshness, returning JSON and a nonzero exit on failure. See [backup procedure](../audit/BACKUP_RECOVERY.md), [operations checks](../audit/OPERATIONS_CHECKS.md) and [acceptance status](../audit/ACCEPTANCE_FOLLOWUP.md). These tools do not configure off-site storage, a scheduler, alerts or production retention.
