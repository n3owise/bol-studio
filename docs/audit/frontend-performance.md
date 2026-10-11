# Frontend performance

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

An isolated copy built successfully with installed Vite 7.3.6 in1.70s. Output JS: app253.03kB, Remotion267.52kB, Supabase217.75kB, general vendor198.60kB, icons17.94kB; total954.84kB before compression,284.85kB gzip. CSS totals252.22kB before compression,47.94kB gzip. These are emitted-asset sizes, not a measured cold-load transfer or Lighthouse score. See evidence/build.txt.

Manual vendor chunks exist; they are not equivalent to route-level lazy loading. Many font files are emitted, including scripts/weights needed by caption templates; assess actual browser requests before trimming required Hindi glyphs. Build validation took place in `/tmp/bol-audit-build` so existing dist and local font files were not modified.

Caption/timeline lists are not virtualized. Playback updates shared state, making large lists expensive; whole-project polling also repeatedly transfers words and exports. Canvas image/video caches are not consistently disposed on switching projects. No heap profile, long recording benchmark or production network waterfall was measured; these are source-supported optimization targets, not quantified slowdowns. Start with profiling a20,000-word synthetic project, summary list endpoints and explicit cache ownership.
