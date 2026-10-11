# Api Registry

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

The following registry enumerates every first-party FastAPI route declaration in server/app.py. Root Gradio/static framework routes are framework-owned and were not treated as project APIs. Each project route inherits middleware ownership checks; malformed IDs404, foreign owned projects404, missing/invalid configured auth401. Health remains public. Optional shared API-key checks apply independently of user JWT verification. Signed-media tokens only authorize selected GET media paths, not enumeration/mutation or /audio.

There is no general rate limiter, request idempotency key, durable request retry policy or cross-file database transaction. Common errors use FastAPI detail responses; auth adds a machine-readable code. Synchronous handlers run through FastAPI’s thread handling; uploads offload inspection/remux. Request timeouts in the browser/helper and subprocess limits are separate from a job SLA. Frontend fetch/XHR helpers handle headers/session refresh; caller-level notifications handle failures. Media elements cannot attach Authorization headers.

| Method/path | Handler:line | Request | Response | Effects/risks |
|---|---|---|---|---|
|`GET /api/limits`|`limits:909`|None; current identity|200 limits and owned storage usage|Filesystem scan; no reservation/quota enforcement|
|`GET /api/health`|`health:936`|None|200 configuration/model availability|Public liveness; not decode readiness|
|`GET /api/projects`|`projects:943`|Current identity|200 Project[]|Reads all owned project JSON; no pagination|
|`POST /api/projects`|`upload_project:958`|Multipart file; roman/native; hi/en/auto; autostart bool|201 Project;413 bytes;422 invalid media|Writes source+JSON, remux, optional queue; failure removes new directory|
|`GET /api/projects/{project_id}`|`get_project:1011`|UUID|200 Project;404|Reads project JSON|
|`PATCH /api/projects/{project_id}`|`patch_project:1016`|ProjectPatch: optional revision, words, settings, name, videoEnabled, glossary, isolateVocals, canvasElements, emoji, translate|200 Project;409 stale/busy;422 validation|Atomic metadata update; emoji/translate ignored; canvas weakly validated|
|`DELETE /api/projects/{project_id}`|`delete_project:1059`|UUID|204;409 worker busy|Deletes full project directory; queued work checks missing data|
|`POST /api/projects/{project_id}/transcribe`|`retry_transcription:1108`|TranscribeRequest optional language/script/glossary/isolation/emoji/translate/autoHighlight|200 queued Project;409 busy|Updates options and submits in-memory job; clears cancellation flag|
|`POST /api/projects/{project_id}/cancel`|`cancel_transcription:1126`|UUID|200 Project|Sets shared cancellation flag and immediate ready status; does not wait for worker|
|`POST /api/projects/{project_id}/media-token`|`media_token:1137`|Authenticated project owner|200 token and expiresIn|HMAC signature for project media GET;2h|
|`GET /api/projects/{project_id}/media`|`media:1152`|UUID; Range supported|200/206 media;404|Serves playable source/derived preview|
|`GET /api/projects/{project_id}/audio`|`audio_track:1162`|UUID; normal auth required|200 audio/mp4|May produce cached AAC extraction; concurrent temp-output risk|
|`POST /api/projects/{project_id}/exports`|`create_export:1183`|ExportRequest mode burned/green,720/1080/2160,24/25/30/50/60fps|202 job;409 busy/not ready;422 empty/cap/green accent|Snapshot and enqueue; no idempotency key; one active export/project|
|`GET /api/projects/{project_id}/exports/{export_id}/download`|`download_export:1212`|Project and persisted export ID|200 video/mp4;404 missing;409 pending|Only persisted ready export path served|
|`GET /api/projects/{project_id}/media-thumbnail`|`project_media_thumbnail:1274`|UUID|200 image/jpeg|Generates/caches thumbnail as needed|
|`GET /api/projects/{project_id}/assets`|`list_project_assets:1287`|UUID|200 MediaAsset[]|Synthesizes primary plus mediaAssets entries|
|`POST /api/projects/{project_id}/assets`|`upload_project_asset:1316`|Multipart file|201 MediaAsset;413/422 validation|Stores file, probes and generates thumbnail; weaker limits than primary|
|`GET /api/projects/{project_id}/assets/{asset_id}/file`|`get_asset_file:1379`|Asset ID in current project|200 file;404|Manifest-based normal asset serving|
|`GET /api/projects/{project_id}/assets/{asset_id}/thumbnail`|`get_asset_thumbnail:1408`|Asset ID|200 image/jpeg;404|Cached asset thumbnail|
|`GET /api/projects/{project_id}/assets/{asset_id}/download`|`download_asset_file:1420`|Asset ID|200 attachment;404|Manifest-selected downloadable file|
|`PATCH /api/projects/{project_id}/assets/{asset_id}`|`patch_asset:1449`|Optional name and greenScreen|200 Project;404|Changes primary/project or asset metadata; greenScreen dictionary|
|`POST /api/projects/{project_id}/assets/{asset_id}/duplicate`|`duplicate_asset:1474`|Asset ID|200 duplicate asset;404|Copies file/thumbnail and appends metadata|
|`DELETE /api/projects/{project_id}/assets/{asset_id}`|`delete_asset:1548`|Asset ID|200;404;409 primary|Deletes asset file/thumbnail and removes metadata|

## Schema boundaries

Word forbids unknown fields and validates bounded strings, timing and metadata; validate_word_intervals enforces unique IDs, positive ordered spans and duration bounds. Settings accepts only known templates/fonts and bounded colors/numbers; wordsPerLine above7 is clamped for legacy compatibility. ProjectPatch revision is optional. Canvas elements are arbitrary dictionaries and green-screen asset config is not a fully shared scene schema. This is the main validation gap at export boundaries.

UI callers: main.tsx owns project CRUD/generation/export polling; api.ts wraps requests, uploads, media URLs and asset operations; MediaPanel invokes assets; SettingsPanel invokes deletion/limits callbacks; StudioModals invokes export and text-download callbacks. See frontend-state-and-api.md for loading/retry/cancellation behavior and [second fix batch](../audit/next-priority-fixes.md) for authenticated audio blob downloads and persisted emoji/translate PATCH options. Detailed Python signatures and call expressions are in evidence/python-symbols.json.


Source report: [audit chapter](../audit/api-endpoint-registry.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
