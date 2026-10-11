# Second priority fix batch — 9 October 2026

This batch changes BOL-03, BOL-04, BOL-07 and the related PATCH contract BOL-23. Existing workspace changes and the first batch are preserved. BOL-03, BOL-07 and BOL-23 are fixed locally. BOL-04's incorrect configuration is fixed; live bilingual content and timing evaluation remains open.

## Platform-aware speech routing — BOL-03

Sherpa still serves Roman Hinglish. Native Hindi requests use MLX only on Darwin/arm64 with the MLX module installed; otherwise they use faster-whisper. The same rule applies when translation moves off Sherpa. Explicit MLX configuration on unsupported platforms and missing engine modules are rejected before a job is queued. Missing local Sherpa artifacts are also rejected. Failed retry admission leaves the persisted project and job queue unchanged; failed autostart uploads clean their temporary files. Upload-only mode remains available without a speech engine.

These checks do not import large engines or download remote weights. They establish local engine/platform capability, not network reachability, remote checkpoint download success, or full dependency binary compatibility. This machine's portable engine is not installed, so Linux coverage simulates its installed/missing states rather than executing Linux inference.

## Translation checkpoint selection — BOL-04

Translation keeps a known multilingual checkpoint if one is already configured. Otherwise it uses `large-v3` for faster-whisper or `mlx-community/whisper-large-v3-mlx` for MLX. Turbo, English-only, distilled and unknown models are not used for translation. `BOL_TRANSLATION_MODEL` explicitly selects one of the supported multilingual aliases; an unsupported override is rejected. `BOL_FALLBACK_MODEL` can configure Sherpa's native-script fallback. Ordinary transcription can continue to use Turbo.

Supported translation aliases for faster-whisper are `tiny`, `base`, `small`, `medium`, `large`, and `large-v1/v2/v3`, plus their Systran/guillaumekln faster-whisper repository names. MLX accepts corresponding `mlx-community/whisper-<size>-mlx` names, with `large-v1/v2/v3` variants. Unrecognized/custom checkpoints require a separately verified capability contract; their suitability is not inferred from accepting a task argument.

This follows [OpenAI Whisper task guidance](https://github.com/openai/whisper#command-line-usage): Turbo is not trained for translation. The MLX default is the published [MLX community large-v3 conversion](https://huggingface.co/mlx-community/whisper-large-v3-mlx). The larger checkpoint may require a first-use download. Decoder tests verify that both engines receive `task=translate`, the source-language option, no transcription prompt, and a non-Turbo model. They use controlled output, so they establish wiring, not translation quality. Real consented Hindi/mixed-speech fixtures and human references remain necessary before BOL-04's bilingual acceptance criteria can be closed.

## Authenticated audio downloads — BOL-07

Audio downloads use the configured API origin and shared authenticated fetch behavior. API-key, workspace and bearer headers are included. An expired token gets one session refresh and one retry with fresh headers. A repeated expiration stops and signs out; another account receives the server's normal refusal. Failed responses cannot become downloaded error blobs or success notifications. The editor creates the local download only after receiving the file and releases its blob URL.

The real-media check also exposed an audio-only upload returning source WAV bytes with an M4A filename. The endpoint now returns an existing generated AAC preview or encodes/caches AAC in an M4A container. Concurrent requests share a per-project encoding lock. Failed encoding removes partial output and can retry. Authenticated synthetic audio was downloaded and confirmed by FFprobe to contain AAC; a repeated download returns the cached result.

## Mutable generation options — BOL-23

PATCH now persists both declared `emoji` and `translate` flags, including explicit `false`. This stores options for a future run; it does not rewrite the current transcript merely by saving a flag. Transcription admission uses the stored translation setting when no override is provided.

## Verification and remaining limits

- 107 Node tests pass, including protected-origin/header behavior, token refresh, retry bounds, and permission errors.
- 115 backend tests pass. They cover routing on five platform/capability combinations, translation model selection and actual decoder arguments, rejected jobs without mutation, upload cleanup, option round-trips, account isolation, real AAC downloads, caching and failed/concurrent encoding.
- TypeScript checking and an isolated production build pass.
- The existing deployment-entrypoint gate test remains excluded from this safe local run, as in the original audit.
- No live ASR, translation quality benchmark, remote model download, or hosted Supabase login was performed. Session behavior uses controlled client responses and backend tokens signed by an isolated test key.
- Browser-click interaction for the Audio .M4A button has not been exercised in this batch.

Evidence: `evidence/next-priority-*.txt`. The original audit remains a historical baseline; its inventory fingerprints have not been relabelled as current source hashes. BOL-06 (scene/export parity), BOL-08 (responsive actions), and the other findings remain open.
