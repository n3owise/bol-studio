# Subtitle Generation

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

Canonical word intervals feed `src/lib/pages.ts`. It partitions at speech gaps and explicit line decisions, then a dynamic program balances phrase boundaries, pauses, word count and punctuation costs. Page hold/lead are bounded by the next page; the renderer uses frame time to choose the active page/word. `groupWords` exposes the same grouping to editing and text downloads.

Settings normally clamp to a seven-word ceiling. Explicit lineBreak=false joins prohibit candidate cuts; a chain longer than the ceiling leaves an unreachable DP state and emits the whole chain (BOL-12, reproduced). Hero selection uses manual spotlight first, then scored prominence/template rules when autoHighlight is enabled. Kinetic/single-word rendering deserves a separate toggle regression check because template rendering has additional hero logic.

Backend Word validation checks uniqueness, finite non-overlapping intervals and clip bounds on PATCH. Inference postprocessing performs its own normalization/refinement; do not assume every transformed result is revalidated through the PATCH schema. Merges, minimum-duration fixes and the end-of-clip boundary need property tests.

SRT/VTT contain grouped word spans, not every animation or page-hold detail. A kinetic template can show one word at a time while its text subtitle export contains a larger group. This is a format capability difference that should be documented rather than promising identical typography/timing. No RTL shaping or professional editor round-trip validation was completed.


Source report: [audit chapter](../audit/subtitle-timing-segmentation.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
