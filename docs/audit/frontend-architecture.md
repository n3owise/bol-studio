# Frontend architecture

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The application is a client-rendered React 19 editor bootstrapped by `src/main.tsx`, with Vite and TypeScript. There is one workspace rather than a URL router: active panel and modal state select Caption, Media, Text, Style, Settings and overlay views. `AuthScreen` gates the editor when Supabase is configured. No server rendering or hydration path exists.

`App` owns the selected Project, settings, transcript, playback clock, history, canvas elements, autosave state, upload state and export polling. It passes callbacks into the panels. `StudioNavbar` handles project naming, save feedback and workspace/export entry points. `CaptionsPanel` groups and edits words; `WordInspector` offers word edits; `TextPanel` changes typography; `StylePanel` and `TemplateCard` choose/preview treatments. `MediaPanel` owns an additional asset list and modal state; `SettingsPanel` handles aspect, storage/limits and deletion. `StudioModals` assembles project/export/help/find-replace views. `Modal` supplies stronger focus behavior than several custom overlays.

The preview uses Remotion `CaptionTrack` → `CaptionPage` → `CaptionWord`. `pages.ts` is the shared segmentation authority. `caption-defaults.json`, `caption-templates.json` and `caption-fonts.json` are consumed on both sides of the API; preserve these single sources. The separate canvas media scene is less unified than captions (BOL-06).

The principal maintainability issue is state ownership in a 4,436-line entry module and a 12,274-line stylesheet. There is no top-level error boundary. Extract persistence, playback and scene state only after pinning observable behavior; indiscriminate component splitting would not itself fix concurrency. See the symbol inventory for every named declaration and its line.
