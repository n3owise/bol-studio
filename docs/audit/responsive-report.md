# Responsive measurements

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The populated synthetic editor was measured at900px height in the Codex in-app browser. All requested widths plus600/900 intermediates were exercised. Document scrollWidth equals viewport width, but this masks overflow hidden inside components. Bounds and offscreen labels are saved in evidence/responsive.json.

| Width | Observed toolbar condition |
|---|---|
|320|Header scrollWidth386; Export clipped. Timeline needs662px within294px. Filters overflow.|
|375|Header still needs386px; Export clipped. Timeline needs662px within349px.|
|390|Header fits; timeline split/zoom/search/fullscreen exceed viewport.|
|428|Timeline zoom/search/fullscreen exceed viewport.|
|600|Timeline search/fullscreen exceed viewport.|
|768|Stacked layout has no offscreen toolbar button in the measured state.|
|900|Two-column transition leaves466px timeline; zoom/search/fullscreen overflow.|
|1024|590px timeline; search/fullscreen overflow.|
|1280|Measured toolbar actions fit.|
|1440|Measured toolbar actions fit.|
|1920|Measured toolbar actions fit.|

At320px the preview is180px tall and caption panel sits below timeline with bottom navigation. The screenshot captures this state. These bounds do not certify every panel/modal, short landscape viewport or mobile touch environment. No second browser engine was exercised. Recheck empty/upload, processing, media modal, word inspector and export states after reflow changes, including768/769 and container widths around662px.

![320px populated editor](evidence/editor-320.png)

![1280px populated editor](evidence/editor-1280.png)
