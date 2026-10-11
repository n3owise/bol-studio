# Model reproducibility and evaluation — 10 October 2026

BOL-26's revision/provenance handling is fixed locally. BOL-04's model selection is corrected, but real translation and alignment quality acceptance remains open. No new real recognition evaluation was performed because this workspace has no supplied held-out corpus with reviewed English translation references and timing annotations. Synthetic decoder checks establish plumbing, not accuracy. This report does not certify either local model as more accurate.

## What changed

Default repository revisions live in `server/model-revisions.json`. The model preparation commands default to immutable commit SHAs; branch names such as `main` are rejected. MLX inference resolves that pinned snapshot; faster-whisper receives the pinned revision. Custom models require a local directory or an immutable revision. `BOL_MODEL_REVISIONS` is a JSON map from repository id to SHA; `BOL_MODEL_REVISION` applies to the explicitly selected `BOL_MODEL`/`WHISPER_MODEL`. A primary override does not apply accidentally to a different companion checkpoint.

Preparation records SHA-256 and size for model files. Existing local Swift/Apex files were read and fingerprinted in `evidence/local-model-provenance.json`; their upstream revision remains unknown because no verified preparation manifest existed. A manifest's source claim is reused only when current files match its recorded hashes. Cached fingerprints refresh when file size or modification time changes. The backend preserves returned `modelProvenance` in the project result. Recognition output identifies the chosen primary model and separately records `companionModelProvenance` when an English companion pass ran, including its actual engine, checkpoint and immutable revision or local-file hashes. Empty companion output still records the attempted successful pass; no optional pass is invented when the companion engine is absent.

The comparison tool resolves pinned remote checkpoints, outputs a JSON evidence file, shows scored-reference coverage, and excludes a model with any missing/failed scored clip from ranking. Failed decoding returns a nonzero exit code. Failed extraction is recorded for every selected model. The benchmark compares differing whole-pipeline/raw decoder paths, so differences must not be attributed solely to architecture or fine-tuning. It is a transcription WER benchmark; it does not measure translation or timing alignment. Lenient spelling scores are heuristic and must be considered alongside strict scores.

## Revision sources

Revisions were read from authoritative public Hugging Face model metadata APIs without downloading weights:

- [MLX Whisper Turbo metadata](https://huggingface.co/api/models/mlx-community/whisper-large-v3-turbo)
- [MLX multilingual Large-v3 metadata](https://huggingface.co/api/models/mlx-community/whisper-large-v3-mlx)
- [faster-whisper Large-v3 metadata](https://huggingface.co/api/models/Systran/faster-whisper-large-v3)
- [faster-whisper Turbo metadata](https://huggingface.co/api/models/mobiuslabsgmbh/faster-whisper-large-v3-turbo)
- [Hinglish specialist metadata](https://huggingface.co/api/models/parismitaglobalsolutions/indicconformer-sherpa-onnx)
- [External Hinglish preview metadata](https://huggingface.co/api/models/Trelis/whisper-hinglish-preview)

The [upstream faster-whisper loader](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/master/faster_whisper/transcribe.py) supports a revision parameter; its [repository alias map](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/master/faster_whisper/utils.py) confirms the Turbo repository. These were source-checked; faster-whisper inference was not available on this host.

The nonexistent/unauthorized `Systran/faster-whisper-large-v3-turbo` API returned 401; the actual faster-whisper Turbo repository is pinned separately. API success verifies repository commit metadata, not recognition quality or existing untracked local files.

## Reproduce verification

```sh
.venv/bin/python -m pytest tests/test_model_provenance.py -q
.venv/bin/python scripts/prepare-hinglish-model.py --variant swift --offline
.venv/bin/python scripts/prepare-hinglish-model.py --variant apex --offline
```

Once a consenting held-out reference corpus is available, supply audio/video files with matching reviewed `.txt` reference files, select already prepared local models, and run:

```sh
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python scripts/compare-models.py /path/to/held-out-clips --only A,B --out /tmp/bol-held-out-comparison.html
```

A successful exit alone does not prove quality. Review complete coverage and both WER scores, then manually examine names, English switches, silence, music, dialects, and model disagreements. For translation acceptance, provide reviewed English translation references and annotate sentence boundaries/word anchors at multiple timestamps. The current comparison tool does not score that task. Corpus consent, reference authorship, split independence, model hashes, host/device, engine/library versions, task settings, runtime and all failures must accompany an eventual evaluation. Do not silently omit failures or unscored clips.
