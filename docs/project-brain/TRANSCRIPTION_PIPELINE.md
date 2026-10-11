# Transcription Pipeline

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

There is no generative script-writing LLM. “Script” is the representation of recognized speech: roman or native. Transcription segments become a canonical Word list with stable IDs for that run, displayed text, original text, start/end, confidence/emphasis and optional glossary/emoji/layout fields.

`normalize_words` handles recognizer output and clamps/normalizes timings. Hindi dictionary replacements plus uroman provide Roman display fallback; already-Latin text survives. `merge_code_mixed_english` considers aligned English companion candidates while protecting recognized Hindi vocabulary. These are heuristics, not a contextual general-purpose translation engine. False-positive/negative replacements require a code-switching corpus.

`apply_glossary` matches creator-supplied terms, including fuzzy multi-token spans, then merges matching words while keeping the total interval and source phrase. A fuzzy threshold can overmatch similar names; the UI should make glossary-derived changes reviewable. Boundary refinement and acoustic prominence follow. Optional English emoji suggestions use keyword matching and a sentence encoder; display chooses at most one eligible non-hero emoji per page.

Regeneration overwrites the Word list. It does not retain a versioned original transcript alongside an English translation or provide alignment between source and target words. Manual edits to a group can redistribute timing and reset metadata (BOL-21). Distinguish displayed text, source recognition and estimated timing in future schema changes.


Source report: [audit chapter](../audit/transcript-script-generation.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.

2026-10-10 update: successful vocal isolation supplies all speech engines and companion passes through cleaned samples or a scoped float32 WAV; temporary files are cleaned on all exits. Original audio is retained when separation fails, with recorded signal provenance. See [verification](../audit/isolation-signal-fixes.md).
