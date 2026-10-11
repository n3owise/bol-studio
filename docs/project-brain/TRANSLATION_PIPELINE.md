# Translation Pipeline

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

The actual implemented translation option asks Whisper to decode source audio directly into English (`task=translate`). It is not a second text-to-text MT stage, not a Hugging Face Inference API request and not arbitrary target-language translation. There is no target-language catalog beyond this English action, no bilingual parallel transcript and no source-target alignment table.

The code forces native display for translation and replaces existing words with translated decoder output. Prior manual spelling corrections are not fed into the audio model; glossary handling happens on the new result. Decoder word timestamps refer to its generated output. Their semantic alignment and omission rate need human validation; receiving timestamp numbers is insufficient evidence of translation accuracy.

As of 9 October 2026, English translation defaults to large-v3 on faster-whisper or mlx-community/whisper-large-v3-mlx on MLX. Already configured, known multilingual checkpoints remain selected. BOL_TRANSLATION_MODEL can choose a supported multilingual model; Turbo, English-only, distilled and unknown overrides are rejected. Native transcription can continue using Turbo. Queue admission rejects unavailable engines before changing the persisted project. This fixes model/task dispatch; live Hindi-to-English content and alignment remain unvalidated. See [second fix batch](../audit/next-priority-fixes.md). OpenAI documents that Turbo is not trained for translation. [Whisper model/task guidance](https://github.com/openai/whisper#command-line-usage).

Acceptance should include consented Hindi, English and mixed clips; names/numbers/negations; no-speech and music cases; content preservation and word-boundary review; clear failure when engine/task unavailable; and preserving the previous edited transcript until the user accepts replacement. No translation quality score or supported-language breadth is asserted here.


Source report: [audit chapter](../audit/translation-quality-and-alignment.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
