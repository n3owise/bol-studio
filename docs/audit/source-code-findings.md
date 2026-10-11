# Source findings and remaining hypotheses

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The consolidated30-item registry is [prioritized-findings.md](prioritized-findings.md), with machine-readable records in findings.json. It separates executed bugs from source-established defects, architecture risks and unverified reproduction scenarios. No source fixes were made.

## Additional observations requiring targeted follow-up

- MediaPanel’s async asset listing/upload completion can race project switches; verify stale response rejection and abort on unmount. Rename/duplicate/chromakey state is partly panel-local, so parent scene synchronization needs a regression.
- The primary asset menu offers deletion although the backend refuses primary removal. Green-screen preview starts from disabled configuration while Apply enables it; confirm the preview accurately reflects what will be applied. Menus inside overflow-hidden thumbnails may be clipped.
- Main import flow does not reset all canvas/active-media state as explicitly as openProject; test new upload immediately after editing overlays. Nested state updates inside canvas updater callbacks deserve cleanup.
- CaptionPanel local generation fields initialize from project but need reset on project changes. Add Caption starts inline editing using the pre-insertion groups length; it may fail to focus the added line. Time display can round59.96s to00:60.0. These were source observations, not browser-confirmed bugs.
- Kinetic template hero handling should be tested with autoHighlight=false; page-builder tests alone do not cover all renderer branches. Explicit-break rebalancing warrants invariant tests.
- Image preview/export rotation and zIndex order do not share one scene implementation. Missing image decodes are silently ignored. Review scene parity beyond the successful basic caption export.
- Demucs and benchmark mkstemp usage should close descriptors explicitly. Export watchdog termination may leave descendant processes unless the whole group is managed. Repeated exports retain snapshots/logs/MP4s without retention limits.
- JS media caches can retain image/video objects. Project polling returns complete words. No heap/load measurements were taken.
- JWKS cache keeps stale keys on refresh failure and throttles refresh attempts, with an async lock. Cold-cache failures and retry policy deserve an outage test; do not describe it as having no lock.
- TODO/FIXME/HACK search found little direct TODO debt; the fallback placeholder panel remains in main.tsx even though known nav panels have implementations. Legacy CSS is more substantial than explicit TODO comments.

Do not silently promote these observations to verified defects. Reproduce with synthetic fixtures, record expected behavior and add narrowly targeted tests before changing production code.
