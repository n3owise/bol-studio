# Bol Studio mobile editor redesign

Status: mobile layout and control adaptations implemented. Browser viewport verification passed; physical-device acceptance remains pending.

## Objective

Design the phone experience from the user journey outward: upload, generate, review, customize, export. Preserve the existing processing, authentication and editing behavior while rebuilding the mobile layout and interactions. Retain the studio brand and global typography/color tokens.

## Initial findings

The global document uses `overflow: hidden` and viewport height, so every route needs an intentional scroll container. Mobile layout currently combines 768px, 760px, 560px, 520px and 420px overrides. The navbar can wrap into two rows while the studio has conflicting height rules. The desktop control density and timeline actions compete with the preview. Address these structurally rather than adding another cascade of overrides.

## Mobile screen architecture

- Compact header: brand/back context, account button and labelled Export action. Put secondary actions such as theme and shortcuts in an overflow menu. Project naming belongs in a secondary editable context row, not a competing toolbar.
- Preview above controls in portrait: contain the entire authored frame; never crop the export composition. Size its container according to viewport height as well as video aspect ratio. Playback, current time and fullscreen remain reachable. Avoid duplicating the player for different layouts.
- One active tool panel below the preview: Caption, Media, Text, Style and Settings in a persistent labelled bottom navigation. Preserve panel position when switching. Provide a clear preview-focus mode when users need more room to watch.
- Landscape phones: preview and tool panel beside each other when space permits; short-height screens use a compact player and scrollable controls. Layout derives from available space rather than named device models.
- Timeline: compact scrubber and play controls by default. Advanced trimming expands into a dedicated editing region; horizontal movement is confined to timeline content. Provide tappable alternatives for precision actions that currently depend on dragging or hover.
- Safe areas: respect top/bottom insets, browser bars and virtual keyboard. Bottom navigation must never cover the final control in a panel.

## Panel specifications

Caption: primary Generate action in empty state; clear processing/error/retry states; readable transcript rows; inline word editing with keyboard-aware scrolling; emphasis toggles and line actions with generous touch targets.

Media: clear upload/add/replace actions, visible supported formats and limits; responsive asset thumbnails; avoid accidental replacement/deletion; progress and retry visible.

Text: consistent section headings and spacing; font dropdown with live typeface samples; linked/unlinked size controls; sliders with readable values and direct value editing; compact preset swatches and a reachable custom-color sheet with HEX/picker/eyedropper support detection; placement/safe zones and motion controls grouped separately.

Style: two-column preset grid where readable, single-column fallback on narrow widths; centered thumbnail text; selected border/background/check and accessible selected state; preserve user settings behavior.

Settings: progressive grouping with concise descriptions, compatible controls and no horizontal form overflow. Avoid hiding required settings behind ambiguous icons.

## Profile, upload setup and export

Profile: mobile sheet/dialog with a clear title/close action, wrapping identity text, full-width editable name, aligned details, temporary-session note beside the workspace detail, reachable settings/sign-out actions.

Upload setup: use the same section rhythm and type scale as panels, single-column choices on narrow devices, visible selected states, footer action reachable with scrolling and keyboard.

Export: pause playback immediately; full-height-safe sheet, concise format/resolution/frame-rate controls, a persistent primary action without covering content, distinguish preparation/rendering/download states, actionable failures, and clear download completion. Verify iOS and Android download behavior on real devices.

Authentication, analytics consent and admin analytics must also reflow and remain usable on phones. No change to admin authorization or analytics consent semantics.

## Interaction and accessibility requirements

Use at least 44–48 CSS-pixel touch areas for primary controls as a practical mobile target; meet WCAG 2.2 target spacing, focus visibility and contrast requirements. Main form inputs use a readable size that avoids mobile browser auto-zoom. Support keyboard navigation, screen-reader labels, reduced motion and text enlargement. The non-timeline interface must reflow at 320 CSS pixels without horizontal scrolling. Do not depend on hover. Sliders must have meaningful labels, values and keyboard/direct-input alternatives.

References: https://www.w3.org/TR/WCAG22/ ; https://www.w3.org/WAI/WCAG21/Understanding/reflow ; https://developer.apple.com/design/tips/ ; https://developer.apple.com/design/human-interface-guidelines/layout

## Implementation sequence

1. Capture baseline phone/landscape screenshots and inventory all control and dialog states.
2. Establish mobile layout tokens, breakpoints, safe-area spacing and a single scroll ownership model. Consolidate conflicting mobile CSS rules.
3. Build header, preview, tool area, bottom navigation and timeline expansion. Preserve one editing state/player.
4. Adapt each panel's controls and selected/empty/loading/error states.
5. Adapt profile, upload setup, font/color selectors and export dialogs.
6. Validate behavior and responsive layout; repair failures before deployment.

## Acceptance matrix

Widths 320, 360, 375, 390, 412 and 430 CSS pixels; short and tall portrait viewports; 667x375 and 844x390 landscape; intermediate/tablet widths 600, 768 and 1024; desktop regression at 1280 and 1440. Include 9:16, 16:9 and square media, long account/project names, long captions, keyboard open and text zoom.

Browser checks: Chrome and Safari where available, light/dark, upload/setup, every navigation panel, font selection, linked sizes, color controls, preset selection, transcript edit, preview play/pause/fullscreen, profile name update, export progress/error/download. Verify scrolling to the last control and no accidental background scroll in dialogs. Browser viewport simulation verifies layout only; real phone acceptance remains necessary for virtual keyboard, safe areas and download behavior.

Do not claim all mobile sizes or WCAG compliance from a handful of screenshots. Record tested widths, behaviors and remaining physical-device limitations.

## Implemented and verified

The mobile stylesheet owns layout up to 900px. Header secondary actions use a More control; account/export stay in the header. Preview precedes tools in the DOM and visual flow. Labelled bottom navigation respects safe areas. One editor scroll region owns portrait scrolling; each tool remembers its scroll position. Timeline precision controls expand on request. Pointer events and cancellation handling replace mouse-only handlers in the editor. Text, media, preset, settings, profile, upload setup and export controls receive mobile sizing and dialog constraints. Desktop preview/tools retain their grid positions. Auth input sizing and admin dashboard reflow are included.

Verified local browser bounds at 320x568, 360x640, 375x667, 390x844, 412x915, 430x932, 667x375, 844x390, 768x1024, 1024x768 and 1440x900. No horizontal page/editor overflow was observed in the checked Text layout. All five mobile panels at 390x844 had scrollable content and no horizontal overflow. Font popup contained 20 options and remained inside the viewport. More exposes undo/redo, theme and shortcuts. Portrait and landscape screenshots were saved for review. TypeScript, all 158 existing frontend tests, production build and diff whitespace checks passed.

Not verified on physical iOS/Android devices: virtual keyboard, real safe-area insets, finger precision dragging, long-press behavior, full processing/export/download and OS file playback. Local tests used an empty editor rather than a real video project. Account/export dialogs have responsive rules but loaded-account/export-state acceptance still needs a physical-phone pass. No formal accessibility certification is claimed.
