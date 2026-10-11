# Performance and resource analysis

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Measured: the safe Python suite completed87 tests with 1 deselected in73.2s; Node completed99 tests in about 4.97s; isolated Vite build completed in1.70s; TypeScript noEmit passed. These are local validation timings, not production SLAs. The short synthetic export succeeded; no end-to-end wall-clock render benchmark was instrumented.

Potential frontend bottlenecks are whole-transcript re-renders, complete project-list polling, eager editor/template dependencies and persistent media caches. Backend listing/storage usage scans filesystem directories; progress writes serialize project JSON. In-memory queues do not bound arrival rate. Speech and rendering share worker capacity and compete for CPU/RAM.

AI cold starts can include artifact downloads and model construction; the English companion can double major decoding work. Demucs adds44.1kHz stereo model work before speech. Export may rebuild the Remotion bundle in each Node subprocess despite a per-process promise cache. Increasing concurrency without measuring peak RSS risks reducing throughput.

Recommended measurement plan: record queue wait, preparation, model load, ASR, companion, postprocessing, bundle, frame render and encode durations with job IDs; record input/output size and peak RSS; benchmark10s/1min/20min media at each allowed output shape under1 and2 workers. Do not parallelize stages that consume previous outputs. Consider persistent render workers and task-specific resource pools only after measured baselines.
