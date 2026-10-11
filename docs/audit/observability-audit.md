# Observability and errors

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The project stores status, numeric progress and human-readable messages; export jobs have IDs and local render logs. Python logging reports worker exceptions; API health/limits expose configuration and storage information. These are useful basics, but no full trace connects upload, queue delay, audio preparation, model version and output render.

There are no checked-in dashboards, alert rules, distributed tracing, per-stage duration histograms, queue-depth metrics or durable retry counters. Generic errors preserve some privacy but can hide actionable causes. ValueError text is sometimes passed to clients and should be reviewed for path/details leakage. Model/download logs and signed URL query parameters should be redacted.

Add request ID, project ID, job generation, stage, duration, error category and retryability to structured events. Record artifact revision and resolved engine but not raw transcripts or tokens. Keep bounded export logs and link the support-facing job ID from the UI. Separate liveness, API readiness, model availability and successful decode health. A health200 is not a translation test.

Acceptance: each induced safe failure tells the user what can be retried and lets support find the stage; stale/cancelled jobs cannot emit misleading success; queue wait can be distinguished from inference time. These are proposed improvements, not existing integrations.
