# Backend architecture

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

`server/app.py` is the FastAPI API, media orchestration and persistence module. `install_middleware` installs the shared gate used by the standalone app and root Gradio entrypoint. The boundary validates optional API key, Supabase identity or signed media token, and project ownership before route logic. CORS allows configured origins and strips foreign inner-layer CORS headers. Proxy behavior outside the app is not guaranteed by this code.

Pydantic validates Word, Settings, ProjectPatch, transcription/export and asset patch requests. Word intervals are separately checked for finite ordering, uniqueness and project bounds. Validation is less complete for `canvasElements`, which remains list[dict]. Project IDs are parsed before filesystem lookup. FFmpeg is invoked with argument lists rather than a shell.

Project metadata is loaded/changed/written under one RLock; atomic temporary-file replacement with fsync reduces torn JSON writes. Files and external processing are not part of a database transaction. Upload preparation happens before returning playable media; speech and exports use one shared ThreadPoolExecutor. The default is2 workers on machines with at least4 CPUs, otherwise1, overridable with BOL_MAX_WORKERS.

Health reports configuration/availability, not successful execution of every model path. Deployments include Docker direct Uvicorn and a Gradio wrapper whose import has setup/download side effects. Only one process over one persistent data directory is a defensible current operating assumption. Jobs, authentication signing key and local caches need deliberate treatment before horizontal scaling.
