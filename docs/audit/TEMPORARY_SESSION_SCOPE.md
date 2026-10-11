# Temporary editing scope — 2026-10-11

The user deferred saved projects and requested editing only while the website is open.

- No project library entry in the navbar or command palette; no project discovery polling.
- Project identity and the temporary upload registry live in page memory, not localStorage. Closing or refreshing starts a fresh editor. Theme and onboarding preferences remain independent.
- Caption edits still synchronize with temporary backend processing state for transcription and export. The status says Temporary session, not Saved locally/cloud.
- New frontend uploads carry an explicit temporary session marker. A heartbeat renews a 30-minute lease. Page close shortens the lease to 15 seconds; cleanup runs every 10 seconds and waits for running transcription/export. An abrupt close uses lease expiry. A stopped backend cleans expired temporary files after restarting.
- Existing projects without the marker are preserved. Cleanup never converts or deletes historical saved work.
- The lease implementation is isolated in server/temporary_sessions.py. Permanent project discovery/storage is deferred, not certified complete by prior audit reports.

Validation: 269 backend tests passed (one external boot test excluded as before), four new temporary-session tests included; 12 focused editor/revision tests passed; type check and isolated production build passed. Browser-close acceptance still requires a manual check in the user's browser.
