# Data lifecycle map

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

| Data | Origin and validation | Transformation | Storage/transmission | Consumers and deletion |
|---|---|---|---|---|
|Account credential|AuthScreen→Supabase SDK|Supabase signs session JWT|Browser session; JWT header to API|auth.py verifies; sign-out clears session; passwords not sent to app backend|
|Owner|Verified JWT sub, or local workspace ID|Shared middleware scopes projects|Project JSON owner|All project routes; legacy backfill offline|
|Uploaded media|Multipart→size count→FFprobe|Remux or derived browser preview|source.bin/preview in UUID dir|Player, extraction, FFmpeg export; project delete removes directory|
|Analysis audio|First audio stream|16k mono PCM, optional separation|audio.wav / temporary separation files|ASR/timing/emphasis; removed after job, regenerated when needed|
|Model artifacts|Configured HF/bundle source|Download/cache/engine construction|Local worker cache, process globals|ASR/emoji/Demucs; not removed on project deletion|
|Words|Recognizer output|Normalize, romanize, English correction, glossary, timing, emphasis, emoji|Project JSON→API→React; PATCH back|Grouping/editor/render/text export; generation replaces list|
|Settings|Shared defaults or user controls|Template/font validation and bounds|JSON/API/local editor state|Preview/export; reset/history only local|
|Canvas assets|Asset upload and frontend scene placement|Thumbnail/chromakey/scale/position|Asset files and mediaAssets/canvasElements JSON|Canvas preview and image-only export; asset/project deletion|
|Job state|Request→executor|Queued/processing/progress/ready/error|Project JSON plus in-memory callable|Polling and notifications; restart invalidates unfinished work|
|Export snapshot|Deep copy of current project|Remotion+Canvas+FFmpeg|Snapshot JSON, log, MP4 under project|Authorized download; retained until project deletion|
|Media token|Server HMAC over owner/project/expiry|URL encoding, client caching|URL query, possible browser/proxy logs|Selected GET routes; expires2h or signing-key change|

Main mutation boundaries: backend RLock+atomic JSON protects only one process; frontend save chain protects only one tab; project revision is optional and omitted by editor. Persisted signed overlay URLs are an authorization-lifetime mismatch. Raw/translated transcript versions are not separate entities. There is no database index, MT-service payload, LLM script object or durable queue message in the current implementation.
