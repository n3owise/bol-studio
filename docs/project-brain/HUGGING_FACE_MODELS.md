# Hugging Face Models

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

Hugging Face is primarily a model-artifact source and deployment host here, not a remote text-translation API. `prepare-hinglish-model.py` fetches encoder.int8.onnx, decoder.int8.onnx and tokens.txt for selected variants under `parismitaglobalsolutions/indicconformer-sherpa-onnx`. `prepare-model.py` prepares a multilingual MLX checkpoint. Scripts support revision/offline checks, while runtime defaults do not consistently pin immutable revisions.

The main multilingual default is `mlx-community/whisper-large-v3-turbo`; portable faster-whisper defaults include large-v3-turbo. English verification uses BOL_ENGLISH_VERIFY_MODEL when set. Emoji suggestion uses `sentence-transformers/all-MiniLM-L6-v2`. Demucs weights are handled by torchaudio’s pretrained bundle. No first-party trust_remote_code=True path was found; this does not replace a supply-chain review of downloaded model artifacts.

Public model-card metadata was checked at the model repository, but its benchmark figures are not measurements of this application. Model/repository license terms, original checkpoint provenance and deployment redistribution should be reviewed for the exact pinned artifacts before distribution; this report is not a legal conclusion.

The live production Space was not queried for user data. Environment secret values were withheld. Source review establishes local worker execution and model-download calls, not a guarantee that every deployment is configured offline. Record checkpoints, library versions and task capability per completed job. See dependency-security.md and translation-quality-and-alignment.md.


Source report: [audit chapter](../audit/hugging-face-integration.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
