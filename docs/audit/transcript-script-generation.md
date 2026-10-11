# Transcript and script processing

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

There is no generative script-writing LLM. “Script” is the representation of recognized speech: roman or native. Transcription segments become a canonical Word list with stable IDs for that run, displayed text, original text, start/end, confidence/emphasis and optional glossary/emoji/layout fields.

`normalize_words` handles recognizer output and clamps/normalizes timings. Hindi dictionary replacements plus uroman provide Roman display fallback; already-Latin text survives. `merge_code_mixed_english` considers aligned English companion candidates while protecting recognized Hindi vocabulary. These are heuristics, not a contextual general-purpose translation engine. False-positive/negative replacements require a code-switching corpus.

`apply_glossary` matches creator-supplied terms, including fuzzy multi-token spans, then merges matching words while keeping the total interval and source phrase. A fuzzy threshold can overmatch similar names; the UI should make glossary-derived changes reviewable. Boundary refinement and acoustic prominence follow. Optional English emoji suggestions use keyword matching and a sentence encoder; display chooses at most one eligible non-hero emoji per page.

Regeneration overwrites the Word list. It does not retain a versioned original transcript alongside an English translation or provide alignment between source and target words. Manual edits to a group can redistribute timing and reset metadata (BOL-21). Distinguish displayed text, source recognition and estimated timing in future schema changes.
