# Remaining-audit acceptance pass — 11 October 2026

This pass completes additional local implementation and acceptance work. It does not close the external/model/device checks listed below.

## Changes and independently checked evidence

- **BOL-15 authentication:** fixed cold-start JWKS outages bypassing retry cooldown and malformed token key IDs causing exceptions. Ten new tests use real signed JWTs and a controlled HTTP transport to exercise rotation, retired keys, concurrent outages, cooldown recovery, expiry and claim validation. [Report](AUTH_OPERATIONS_ACCEPTANCE.md).
- **BOL-16/29 recovery:** added executable offline create/verify/restore tooling with a consistent SQLite snapshot, media checksums, exclusive store locking and atomic publication to a new destination. An independent reviewer reproduced an unreadable-directory omission; traversal now propagates the error and publishes nothing. Malformed manifest types also fail cleanly. Actual restored running work was replayed successfully. [Procedure and evidence](BACKUP_RECOVERY.md).
- **BOL-29 operations:** added a read-only command that reports service/tool/journal/queue checks and optional backup integrity/freshness as JSON with meaningful exit codes. It passed against the running localhost backend. The initial check correctly failed while the server was stopped; the local test servers were then restarted. [Checker](OPERATIONS_CHECKS.md), [live result](evidence/acceptance-running-operations.json).
- **BOL-06/17 media:** seven additional actual codec/alpha cases passed, including MP4, two WebM variants, AVI, MKV, MOV and explicit unsupported alpha rejection. Original download preservation and preview normalization were exercised. [Matrix](MEDIA_ACCEPTANCE.md).
- **BOL-24 text exports:** Python's CSV consumer and FFprobe parsed emitted CSV/VTT/SRT, preserving tested fields and cue timing. This extends string tests to independent consumers; it does not establish every spreadsheet/player import.
- **BOL-28 contrast:** shortcuts section headings now use theme-aware readable green. Browser-computed light-theme heading contrast is **4.76:1** against its card background. [Measurement](evidence/acceptance-contrast.json), [screenshot](evidence/acceptance-shortcuts.png).

## Verification

- Combined backend regression: **265 passed**. Evidence: [backend](evidence/acceptance-backend.txt). One external Gradio/ZeroGPU entrypoint test is deliberately excluded, with two existing dependency deprecation warnings.
- Frontend/renderer tests: **143 passed**, zero failures/skips. [Output](evidence/acceptance-node.txt).
- Type checking and isolated production build passed. [Type check](evidence/acceptance-typecheck.txt), [build](evidence/acceptance-build.txt).
- Final focused backup/operations run: **32 passed** (19 backup + 13 operations). [Output](evidence/acceptance-backup-final.txt).
- No production deployment, external alert delivery, existing-data restore or private-recording evaluation was performed. The local website uses temporary test data and local-only authentication configuration.

## What is still needed

| Remaining acceptance | Why it remains open |
|---|---|
| Recognition, translation, timing and isolation quality (04/14/26) | No consenting held-out recording folder with reviewed transcription/translation/timing references was supplied. Existing local weights alone cannot establish accuracy. |
| Hosted auth and deployment (15/16/29) | No designated staging URL and test-account workflow supplied. Local signing-key tests do not prove hosted refresh, Linux/GPU boot, TLS/proxy behavior, persistent volume or disaster recovery. |
| Production operations (29) | Checker/tooling is available; alert destination, scheduler, log retention and off-site backup policy are not configured. |
| Scaling (16) | One process per data directory remains the supported architecture. Horizontal scaling requires a transactional store/distributed coordination design and deployment target. |
| Accessibility and zoom (08/18/19/28) | Keyboard/short-window tests and targeted contrast improvements passed previously and here. Actual 200%/400% native-browser magnification was attempted but native capture failed; screen-reader and broader device/contrast checks remain unverified. |
| Broader media/imports (06/17/24) | More codecs now pass; HDR/VFR long-duration sync, all browser/player combinations and named spreadsheet imports remain unverified. Sampled resource watchdogs are not hard OS memory/disk quotas. |
| Whole-app performance (25) | Cached lookup microbenchmarks and bounded DOM checks passed. No complete long-session browser/device CPU, memory and frame-time profile is claimed. |

These are not silently marked as fixes or passes. See [the complete 30-finding crosswalk](FINAL_REAUDIT.md) for earlier local repairs.
