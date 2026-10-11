# Translation capability and alignment

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The actual implemented translation option asks Whisper to decode source audio directly into English (`task=translate`). It is not a second text-to-text MT stage, not a Hugging Face Inference API request and not arbitrary target-language translation. There is no target-language catalog beyond this English action, no bilingual parallel transcript and no source-target alignment table.

The code forces native display for translation and replaces existing words with translated decoder output. Prior manual spelling corrections are not fed into the audio model; glossary handling happens on the new result. Decoder word timestamps refer to its generated output. Their semantic alignment and omission rate need human validation; receiving timestamp numbers is insufficient evidence of translation accuracy.

The default fallback is Whisper Turbo. OpenAI documents that Turbo is not trained for translation and recommends translation-capable multilingual models instead. This is independently supported by the reproduced decode plan, without executing costly inference. [Whisper model/task guidance](https://github.com/openai/whisper#command-line-usage).

Acceptance should include consented Hindi, English and mixed clips; names/numbers/negations; no-speech and music cases; content preservation and word-boundary review; clear failure when engine/task unavailable; and preserving the previous edited transcript until the user accepts replacement. No translation quality score or supported-language breadth is asserted here.
