# Feature registry

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

| Feature | Implementation/status | Main source |
|---|---|---|
|Video/audio upload|Implemented; basic synthetic path tested|api.ts; upload_project|
|Hinglish Roman ASR|Implemented worker path; no fresh quality evaluation|transcription.py Sherpa|
|Native Hindi/English|Implemented option; Linux Sherpa fallback bug|decode_plan|
|English translation|Audio translation task; Turbo mismatch|decode_plan/transcribe|
|General multilingual target translation|Absent|No MT target catalog/provider pipeline|
|Generative script writing|Absent|Script means writing system|
|Vocal isolation|Optional Demucs; non-Sherpa input bug|denoise.py/transcribe|
|Glossary|Fuzzy creator-term correction|glossary.py|
|Emoji|Optional English semantic/keyword suggestion|emoji.py/pages.ts|
|Timed caption editing|Word/group edits, splits/joins, highlights, undo|CaptionsPanel/main/captions.ts|
|Templates/typography|24 templates/shared catalogs|treatments.ts/TextPanel/StylePanel|
|Safe areas|Reels/Shorts overlays and warnings; palette bug|safe-area.ts|
|Media overlays/chromakey|Preview richer than export|MediaPanel/main/render.ts|
|Accounts|Optional Supabase auth and scoped ownership|auth.ts/auth.py|
|Projects|Disk JSON persistence, search/sort/delete|server/app.py/StudioModals|
|Autosave|Local serialization; missing revision in requests|flushSave|
|SRT/VTT/TXT/CSV/JSON|Client downloads; escaping/provenance limitations|captions.ts|
|Burned/green MP4|Worker render; basic burned path verified|render.ts|
|Audio download|Backend works; UI authorization/origin bug|downloadAudioTrack|
|Durable queue / relational project DB|Absent|ThreadPoolExecutor / JSON|
|Diarization / general forced aligner|Absent|Energy refinement is not either|
|Billing / team collaboration|Absent|No product flow found|

Treat absent features as scope facts, not automatically as bugs or approved roadmap requirements.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
