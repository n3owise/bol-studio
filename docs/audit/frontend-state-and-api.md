# Frontend state and API

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The server Project is mirrored in React state and `projectRef`; separate settings/canvas state and refs participate in edits. History holds up to 40 in-memory snapshots and is lost on reload. `markEdit` coordinates dirty generations and history. `flushSave` serializes requests through a promise chain with a 650ms debounce, sends words/settings/name/videoEnabled/canvasElements and updates saved revision. It omits revision in its request (BOL-05). Pending changes are flushed before changing/deleting the current project, and beforeunload warns about unsaved work.

`src/lib/api.ts` owns API origin, workspace identity, fetch/XHR headers and scoped media tokens. Production defaults to the Hugging Face worker origin; development normally uses the Vite proxy. Supabase access tokens go in Authorization, shared API key in X-API-Key, and local workspace identity in X-Bol-Owner. API retry logic can refresh an expired session; media URLs use project-scoped signatures. A locally generated workspace ID is convenience separation, not authentication.

Uploads use XHR for progress and cancellation; subsequent processing uses polling. Workspace/health refresh runs roughly every7s and active jobs roughly every1.4s. The project collection contains complete transcripts rather than summaries. A processing result can replace selected project state; autosave serialization only protects one client. Async asset fetches/uploads do not consistently cancel or check project generation, so switching projects during completion deserves a regression test.

Exceptions from request helpers generally reach notifications. Save failure remains dirty, with retry through later editing/manual save, rather than silently claiming success. `downloadAudioTrack` bypasses this request machinery (BOL-07). Canvas URL persistence and duplicate state need special care (BOL-15).
