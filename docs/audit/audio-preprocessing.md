# Audio preprocessing

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

`read_audio` converts analysis samples to floating point; waveform is computed for editor display. A low global RMS threshold returns empty words for silence before model loading. The existing silence test passes without downloading a model. This is an energy gate, not a trained speech detector or proof against all hallucinations.

Optional `denoise.isolate_vocals_from_source` extracts source-rate stereo and uses torchaudio Hybrid Demucs at44.1kHz in10-second windows. Failure degrades to original audio. Separation is opt-in and can be expensive; no separation was run during this audit. The installed torchaudio import succeeded even though torch and torchaudio version numbers differ; no incompatibility is asserted from version numbers alone.

Separated samples are consumed by Sherpa and by subsequent energy/emphasis passes, but MLX/faster branches still read the original WAV path (BOL-14). `mkstemp` descriptors in separation/benchmark helpers should be explicitly closed; unlinking a file is not closing its descriptor. Cancellation is checked around this stage, not at each model operation.

The so-called VAD boundary refinement uses short-window acoustic energy to trim silence with pre/post-roll and minimum durations. It does not identify speakers or perform phonetic forced alignment. No diarization, dereverberation model, loudness-normalization product feature or speech-specific denoiser beyond Demucs is implemented.
