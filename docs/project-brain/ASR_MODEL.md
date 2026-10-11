# Asr Model

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

`model_config` honors BOL_ENGINE/BOL_MODEL and legacy environment aliases, otherwise prefers prepared Sherpa Hinglish assets, then Apple Silicon MLX, otherwise faster-whisper. Sherpa uses an int8 Whisper-derived Hindi-to-Roman-Hinglish fine-tune loaded through sherpa-onnx. Despite the repository’s “indicconformer” name, the selected Hinglish variants are not evidence of an IndicConformer recognizer.

Sherpa runs overlapping24-second windows with2.5-second overlap, token timestamps/durations grouped into words and duplicate overlap removal. Greedy decoding/language/task settings are specialized for Hinglish. MLX and faster-whisper request word timestamps, deterministic temperature, no previous-text conditioning, a code-mixed prompt and a no-speech threshold; faster also enables VAD. Runtime inference is local to the Python worker, which may be a hosted server rather than the user’s computer.

`decode_plan` forces native display for translation. As of 9 October 2026, non-Roman Sherpa requests use MLX only on Apple Silicon with the module installed; otherwise they use faster-whisper. Translation selects a known multilingual checkpoint instead of Turbo. Admission checks the requested engine/platform and local Sherpa files before queuing, without downloading remote weights. See [second fix batch](../audit/next-priority-fixes.md). English companion decoding is optional by installed capability but can run another full model pass and download an uncached checkpoint; comments saying cached do not enforce offline readiness.

Lazy model/global caches are process-local. Concurrent cold-start initialization and total model memory have not been measured. No fresh noisy/multilingual/overlapping-speaker inference was run, so this audit supplies no WER, accuracy percentage or timing precision claim. The model-selection and result-processing branches were reviewed and safely stub-tested.


Source report: [audit chapter](../audit/speech-recognition-audit.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
