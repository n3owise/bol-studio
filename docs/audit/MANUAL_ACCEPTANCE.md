# User-reported manual acceptance — 2026-10-11

These results are reported by the user during guided localhost checks. They apply to the clips, device, player and browser tested; exact fixture names, settings and device versions were not collected. They do not certify every combination.

## Reported passed

- Temporary editing session: close and reopen starts an empty editor.
- Additional caption recognition and speech timing check.
- Mobile layout check reported passed, then further mobile work explicitly deferred; desktop is the current target.
- Longer-clip desktop playback, seeking, caption scrolling, timeline zoom, editing, Undo/Redo and export check.
- Exported video playback: beginning/middle/end synchronization, preview styling/position, clipping and ending check.
- Desktop VoiceOver labels, keyboard navigation and Escape from dialogs.
- Background-noise isolation: speech audibility, noise reduction, missing words and timing check.
- Desktop editing-app subtitle import: Hindi text, caption timing and missing-line check reported passed; app name and subtitle format were not supplied.
- Alternate MOV or WebM upload, preview, caption generation and MP4 export synchronization check (specific format not recorded).
- Light/dark desktop readability: caption text, timestamps, selected rows, settings and dialogs.

Earlier guided checks also received user passes for MP4 playback, keyboard/focus, browser zoom, caption-group navigation and SRT/VTT player checks. This record distinguishes user reports from automated evidence.

## Explicitly deferred

- Translation quality: user requested a later to-do discussion after the remaining master audit checks.
- Mobile development and broader mobile acceptance: leave the current mobile view as is.
- Saved projects and permanent storage: implement later; current editing is temporary.

## Remaining

- Broader desktop codec/HDR/variable-frame-rate and target-app imports beyond tested clips/players.
- Hosted account, session refresh, deployment boot and real hosting environment checks.
- Production monitoring, alert delivery and temporary-session cleanup verification on the chosen host.
- Multiple-server scaling is unsupported and requires future architecture work if needed.
- Formal held-out speech quality benchmarks and measured long-session device profiling remain unestablished; the manual checks above provide acceptance for tested examples.
