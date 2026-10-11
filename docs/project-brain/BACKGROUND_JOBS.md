# Background Jobs

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

Transcription and exports share `EXECUTOR`; aliases do not create separate pools. Submission stores queued status in JSON and submits an in-memory callable. Queue depth is unbounded and there is no broker, lease, priority, dead-letter queue or automatic backoff. The persisted status is not sufficient to reconstruct the queued callable after restart.

Startup converts unfinished transcription/export states into errors for manual retry. A worker loads project state, prepares analysis media, invokes inference and updates progress/results. Export captures a snapshot so later edits do not alter that render. Python starts a Node renderer subprocess; the renderer streams caption frames and FFmpeg writes the final MP4. Watchdog/error paths mark failure, but process-group cleanup and interrupted partial export retention need tests.

Cancellation checks occur between stages and during chunk/segment loops; a synchronous model invocation or Demucs window cannot necessarily be interrupted immediately. The cancel endpoint immediately returns the project to ready, while a worker may still be running. BOL-02 demonstrates that retry clears the shared flag and permits stale completion. Job identity and final-write fencing are required before reliable cancellation can be claimed.

At scale, bound admission before adding workers. Speech and headless rendering contend for CPU/memory. Measure each pool’s demand, then isolate resource classes and implement durable job recovery rather than merely increasing BOL_MAX_WORKERS.


Source report: [audit chapter](../audit/background-jobs.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
