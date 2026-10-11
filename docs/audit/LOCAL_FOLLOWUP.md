# Local follow-up — 10 October 2026

The next local pass addresses remaining BOL-18/BOL-25 work without closing their broader acceptance requirements.

## Changes

Caption playback uses an index built when groups change instead of scanning every group each frame. Filtered caption positions use a cached map. Overlaps retain original group priority, timestamps remain end-exclusive, and the existing 80 ms display padding remains. Empty groups cannot create phantom active captions. Nested/unsorted intervals are tested; pathological overlapping intervals can still require a linear scan. This is not a complete timeline or editor performance rewrite.

Search fields have explicit labels; native modal headings use unique stable IDs. The palette exposes a combobox, its controlled list and active option; the tour announces its current step. Palette/tour bodies scroll within short dynamic viewports, footer actions wrap, focus outlines remain visible and tour controls have larger hit areas. Reduced-motion preferences disable dialog decoration and caption-panel automatic smooth scrolling, preserving authored caption animations.

## Verification

- [Frontend regression](evidence/next-local-node.txt): **139 passed**, zero failures/skips.
- [Type check](evidence/next-local-typecheck.txt): exit 0.
- [Isolated production build](evidence/next-local-build.txt): exit 0, checkout assets preserved.
- [Playback microbenchmark](evidence/next-playback-index.json): 10,000 groups and 10,000 matching lookups; indexed about 2.5 ms versus linear about 165 ms on this host. This measures lookup work, not overall editor latency.
- [Browser evidence](evidence/next-short-dialog.json): at 640 × 360, palette and footer stay within the viewport, no horizontal document overflow, Down updates a selected active descendant. [Screenshot](evidence/next-short-dialog.png).
- Existing 10,000-word synthetic project opens after the change; no user project was edited. Backend code was unchanged, so the preceding 216-test backend result was not rerun.

## Still pending

Real screen readers, true browser magnification, broader devices and a whole-editor playback profile remain unverified. Real model quality and hosted identity/deployment checks still require the inputs described in [the final re-audit](FINAL_REAUDIT.md).
