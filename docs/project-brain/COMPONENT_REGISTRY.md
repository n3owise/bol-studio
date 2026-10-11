# Component registry

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

Components are composed by main.tsx; there is no routing framework. Panel visibility is local state, and most business mutations are callbacks into App. A component’s presence does not imply independent state ownership or end-to-end test coverage.

| Component | Responsibility | State/data relationship |
|---|---|---|
|`AuthScreen`|Sign-in/signup/reset/recovery UI using Supabase; dual-face form focus and errors.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`CaptionsPanel`|Generation settings, grouping, search/filter, inline edits, drag/drop and caption options.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`CommandPalette`|Searchable commands/project shortcuts and keyboard selection; own dialog implementation.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`LiveAnnouncer`|Screen-reader live status presentation.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`MediaPanel`|Project asset browsing/upload/rename/duplicate/delete, chromakey preview and custom dialogs.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`Modal`|Reusable labelled modal, focus containment/return and dismissal.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`OnboardingTour`|Three-step stage/timeline/export onboarding overlay and keyboard navigation.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`SettingsPanel`|Project properties/aspect/limits/storage information and deletion confirmation.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`ShortcutModal`|Keyboard command reference content inside shared modal.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`StudioModals`|Workspace search/sort, export, help and find-replace modal composition.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`StudioNavbar`|Project name/save state, theme, history, account/workspace and export entry points.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`StylePanel`|Template filtering/selection and preview cards.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`TemplateCard`|Treatment thumbnail composition, accents and selected state.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`TextPanel`|Caption font/size/color/stroke/background/position and typography controls.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`TimelineRuler`|Timeline tick spacing and time labels from zoom/duration.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|
|`WordInspector`|Focused word text/case/highlight/split/delete controls.|Receives App/project callbacks; local presentation state. Named declarations and imports: [file inventory](../audit/source-file-inventory.md).|

Render components: CaptionTrack selects active pages, CaptionPage lays out treatments, CaptionWord applies per-word animation/type, Root registers the headless composition. TemplateCard previews treatments independently of project media. AuthScreen talks to Supabase through auth.ts; MediaPanel is the largest additional API-owning panel. Modal/LiveAnnouncer should be reused rather than reimplemented.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
