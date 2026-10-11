# UI fixes — 9 October 2026

BOL-08, BOL-09, BOL-10 and BOL-11 are fixed in the local workspace. This continues the second priority batch and preserves existing user changes. BOL-06's video/primary-media export parity remains open.

## Responsive actions — BOL-08

The studio navbar now reflows at narrow widths, retains Export, and lets the project name shrink. At phone widths, Projects keeps its accessible label while its visual text is compacted. Timeline controls wrap within the actual editor column, including split desktop layouts. Preview actions also wrap. Caption filters wrap instead of clipping or fading the Auto-highlight control. The mobile studio fills the remaining height rather than assuming a fixed 56-pixel navbar.

Browser measurements covered 320, 375, 390, 428, 600, 768, 900, 1024, 1100, 1280 and 1440 pixels at a height of 900, in both empty and populated editor states. Every measured navbar/preview/timeline/filter action remained within the viewport horizontally, and document width matched viewport width. Phone screenshots were visually reviewed. These checks cover signed-out local controls; hosted account-menu variants and shorter/zoomed viewports were not evaluated. Timeline content itself remains intentionally scrollable.

Evidence: [populated measurements](evidence/ui-fixes-responsive.json), [empty measurements](evidence/ui-fixes-empty-responsive.json), [320-pixel screenshot](evidence/ui-fixes-320.png).

## Keyboard editing — BOL-09

IME composition events are ignored. The editable-target guard now runs before question-mark help, project undo/redo, and split commands. Inputs, textareas, selects, editable regions and textbox roles keep native typing/editing behavior. Save and the command palette remain intentionally available while editing; Escape continues to dismiss overlays.

Browser checks typed a question mark into Project name without opening shortcuts, used native Cmd+Z to restore the name, and opened shortcuts with Shift+/ outside the input. Textarea, contenteditable and IME paths are covered by the guard's source logic but were not separately exercised in this browser smoke test.

## Timeline search — BOL-10

The timeline Search and replace button opens the shared Search & Replace modal. Active styling derives from the modal state; obsolete showSearchBar state and reset calls are removed. In the disposable fixture, Find reported one match, Replace All changed Namaste to Hello, and the change was verified in the persisted project. Matching/counting edge cases remain BOL-22 and are not closed here.

## Safe-area command — BOL-11

The palette writes the actual safeArea enum instead of the unused showSafeArea flag. It shows Instagram Reels by default and accurately names whichever guides are being hidden. Browser checks verified three Reels zones and selected Reels in the Text panel, selected Shorts and observed the matching palette label, then hid guides and confirmed zero zones, Off selected, and safeArea=none on disk. Guides remain visual warnings rather than automatic caption repositioning.

## Verification

- 107 Node tests passed after the TSX changes.
- TypeScript checking and the final isolated production build passed.
- Browser flows used only copied synthetic data in /tmp/bol-ui-fix-data and local test servers. No user project or hosted account was changed.
- React review applied the react-best-practices skill: no new subscriptions or duplicated derived state were introduced; the existing key listener cleanup remains intact.
- Browser tabs and viewport overrides were cleared; temporary preview/backend processes were stopped after verification.

Action observations: [browser journal](evidence/ui-fixes-actions.json). Build/test logs: evidence/ui-fixes-build.txt and evidence/ui-fixes-node.txt. Other audit findings remain open; this report does not assert full accessibility certification or scene/export parity.
