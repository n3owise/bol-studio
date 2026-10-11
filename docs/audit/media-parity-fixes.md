# Media preview and export parity — BOL-06

Fixed locally on 2026-10-09. Original audit evidence remains historical.

Video overlays now decode at export frame rate, start at their placed timeline offset, and loop like the browser preview. A bounded stream avoids staging all decoded frames on disk. The primary video holds its final frame if shorter than the project. Decoder processes are stopped after completion or failure. Missing or undecodable visible media fails export explicitly instead of silently disappearing.

Preview and export use stable saved z order, rotation, centered geometry, and the shared chroma-key function. Keyed primary video preserves the preview's contain geometry. Primary video selection is saved, restored when opening a project, included in revision conflict detection and undo history, and resolved through the project manifest during export. Its audio is exported as well, matching preview playback. The caption transcript and project duration still belong to the original upload; switching primary media does not transcribe it or change duration. Audio projects retain their original primary media; additional visuals can be placed as overlays.

Registered visual paths retain UUID membership and canonical containment checks. Overlay playback URLs are derived from project and asset IDs when loading, rather than trusting a persisted URL. This is not a complete resolution of the separate long-running token refresh issue BOL-15.

Verification:

- 109 Node tests and 116 Python tests passed; the pre-existing external boot/deployment test remains deselected. Type checking and an isolated production build passed.
- New tests verify stable layer ordering, actual FFmpeg frame progression, overlay looping, primary final-frame holding, and saved primary selection with foreign asset rejection.
- A two-second synthetic 720p/24fps export used a selected yellow video instead of the original black source, a delayed red/blue video rotated 90 degrees, and a keyed magenta image above it. Pixel assertions at 0, 0.3, 0.9, 1.3 and 1.9 seconds verified selection, timing, looping, rotation, layer order and key removal. The exported audio's dominant frequency was 880 Hz, matching the selected clip rather than the original 220 Hz audio.
- Browser verification opened the saved synthetic project and sought to approximately 0.9 seconds. The preview showed the selected yellow base, rotated blue overlay and keyed magenta foreground, matching the exported frame. Screenshots are in evidence/media-parity-preview.png and evidence/media-parity-export-frame.png.

Limits: this synthetic scene has no caption words; existing caption regression tests passed, but this batch did not repeat the earlier caption visual matrix. Live hosted authentication, long clips, 4K performance, every media codec and high overlay counts were not exercised. The compositor now decodes the primary video as well as overlays, which adds processing cost; admission limits and performance work remain separate audit items. No deployment or production project edits were performed.
