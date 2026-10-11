# Job admission and single-process storage — BOL-16 mitigation

Implemented locally on 2026-10-10. BOL-16 remains open for durable automatic recovery and scaling; this batch does not claim a multi-worker architecture.

The supported JSON-storage mode now holds an exclusive OS file lock for the data directory through startup recovery and graceful worker shutdown. A second process fails startup before it can mark another process's active jobs interrupted or overwrite its files. Process death releases the OS lock automatically. This mode targets macOS/Linux and a local filesystem.

Compute admission is bounded before job state is persisted. Defaults are eight queued jobs in addition to configured running workers, and three admitted jobs per workspace. Full server capacity returns 503; workspace excess returns 429, with Retry-After: 30. Validation failures release reservations. Completion, worker failure and cancelled futures release them exactly once. Autostart uploads reserve capacity while being prepared; rejected uploads clean their partial directory. Upload-only requests do not consume compute capacity. Shutdown prevents new admissions and waits for running writers while holding the data lock.

The existing restart behavior remains deliberately retryable: interrupted jobs become errors with instructions to retry rather than spinning forever. Recovery now advances transcription generations so old workers cannot publish results. Completed exports remain unchanged. It does not replay queued jobs automatically, and exports still use the existing per-project error/retry workflow.

Verification: the safe full Python suite passed 145 tests, with the existing external boot/deployment test deselected. Three subsequently added process-exit/cancelled-future/owner-admission cases passed in the focused 16-test run. Evidence files are job-admission-python.txt and job-admission-targeted.txt. Tests exercise capacity and workspace limits, rejected requests leaving project state unchanged, upload cleanup, validation/worker failure release, cancelled queued future release, actual second-process rejection, an actual process exit followed by application startup recovery, and stale transcription generation fencing. Existing dependency deprecation warnings remain.

No frontend source changed, so the previous frontend build/test verification remains applicable. No live ASR, production restart, deployment or user project mutation was performed. Localhost remains running with backend source reload.

Remaining BOL-16 work: transactional project persistence, durable job records and export snapshots, lease-based execution, duplicate-delivery handling, and staging validation before multiple processes/hosts. The current in-memory queue is bounded but not durable. Graceful shutdown may wait for a long-running decoder/export; hard termination relies on the explicit retry recovery described above.
