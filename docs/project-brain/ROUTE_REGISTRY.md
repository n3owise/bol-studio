# Routes and entry points

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

The browser loads a single SPA at `/`; there are no declared page routes or URL-addressable project routes in a client router. Modal names and activeNavPanel choose internal views. Deep-link restoration of an exact project/editor state is not an established feature.

Frontend entry: index.html → src/main.tsx. Backend entry: Uvicorn server.app:app. Alternate hosted wrapper: root app.py → Gradio plus shared API routes/middleware; import prepares runtime/model artifacts. Local dev: scripts/dev.mjs starts both processes. Deployment: Dockerfile direct FastAPI, plus Vercel frontend/rewrite configuration. These are alternative entrypoints whose equivalence needs testing.

Project API lives below /api/projects; health and limits are /api/health and /api/limits. The complete23-route declaration registry, methods, schemas, errors and side effects is [API_REGISTRY](API_REGISTRY.md). Framework-generated OpenAPI/docs and Gradio/static routes are not counted as first-party project handlers. Protected media routes accept project-scoped tokens only on their allowlist; /audio currently needs the normal auth path.

Auth UI states include sign-in, sign-up, password-reset request and recovery/new-password. Supabase session events select these states; actual email delivery and production redirect configuration were not tested.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
