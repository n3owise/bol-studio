# Temporary cleanup and export investigation — 2026-10-14

The user reports live caption generation and exports succeed; export latency is
still a concern. This is not a measured export-time acceptance.

## Cleanup

Six focused tests verify finite leases, owner/session authorization, active-job
preservation, removal of source/export/intermediate files, and cleanup after an
expired export finishes. Normal close grace is 15 seconds, sweep interval 10
seconds, abrupt-close fallback lease 30 minutes. Older projects without an
explicit temporary lease are preserved rather than silently deleted.

A disposable hosted upload was playable before closing its editor tab. Its media
remained accessible after the close grace, including a cache-bypassing request.
The direct HF close request needs a cross-origin preflight during page teardown.
The close notification now uses the same-origin Vercel worker rewrite for the
standard production HF backend. Large uploads remain direct. Hosted recheck is
required after deploying this correction.

## Export findings

Green-screen captions without placed layers use Remotion renderMedia and H.264
libx264, CRF 18, veryfast preset. Layered scenes retain the compositor. The HF
runtime is ZeroGPU, but app.py's decorated GPU callback is only a startup check;
transcription and headless Chromium/libx264 exports currently run on CPU.

Browser RAM does not accelerate remote exports. Server RAM is useful only when
memory is limiting; it does not replace CPU throughput. The file-backed Remotion
shared buffers deliberately avoid orphaned POSIX shared memory after termination.
Do not move them to a small /dev/shm volume without measuring its capacity.

Local fresh-process template bundling measured 2.08 seconds; same-process reuse
was effectively zero. Each export launches a new process, so bundling repeats.
This is a small setup optimization, not an explanation for multi-minute 4K60
rendering. Existing two-second 4K60 comparisons show four-page concurrency was
faster than two locally; hosted throughput and memory must be benchmarked before
raising worker concurrency. No GPU-acceleration or export speedup is claimed.
