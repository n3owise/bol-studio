# Accessibility review against WCAG 2.2 AA

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

This is an issue-focused review, not a conformance certification. The app has named buttons, headings, a LiveAnnouncer status region, and a shared Modal with focus handling. AuthScreen marks the inactive face inert and uses distinct field IDs, which avoids invisible duplicate form focus.

Confirmed keyboard interference: typing ? in the Project name input opens Keyboard Shortcuts (BOL-09). Source also suppresses browser zoom globally (BOL-19). Custom palette/tour/media dialogs do not consistently use the shared focus containment/return behavior; word insertion uses tabIndex=-1 and several drag handles have no equivalent keyboard action (BOL-18). Native button semantics should replace generic clickable/role-button word surfaces where possible.

Responsive clipping at320px and900–1024px is relevant to reflow and focus visibility: controls can exist in the accessibility tree while being outside the visible container. Caption timelines may need two-dimensional layout, but primary actions and toolbars still need a reachable alternative. The target criterion is [WCAG 2.2](https://www.w3.org/TR/WCAG22/):1.4.4 resize text,1.4.10 reflow,2.1.1 keyboard,2.4.3 focus order,2.4.7 focus visible,2.4.11 focus not obscured,2.5.7 dragging movements,2.5.8 target size,4.1.2 name/role/value and4.1.3 status messages.

Reduced-motion overrides exist in parts of CSS but not uniformly across tour/palette/spinners/theme behavior. No full computed contrast scan, VoiceOver/NVDA session,200% zoom test or target-spacing exception analysis was completed. White on the light danger token #ef4444 calculates about3.76:1; inspect actual affected small-text states before claiming a contrast failure. User-generated caption colors are separate from the product chrome. Acceptance requires both themes, keyboard-only editing, real assistive technology and the specified viewport matrix.
