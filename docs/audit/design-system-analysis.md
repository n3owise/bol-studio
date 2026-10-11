# Actual design system

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

`src/styles.css` defines light root tokens and dark overrides. Core colors: accent#2ee368 with dark ink#052e16; light app#fcfcfd/panel#fff/primary#09090b; dark app#0a0b0d/panel#111215/primary#f4f4f6. Muted text differs by theme. Typography uses DM Sans body, Space Grotesk display and Noto Sans Devanagari support. Caption fonts and treatment-specific stacks are separate from editor typography.

DESIGN.md describes11px minimum text,28px interaction targets, radii around6/8/12/16px and pill999px, and restrained theme-aware shadows. Those are intended system rules, not proof that every rendered control complies. Lucide icons dominate chrome. Motion includes CSS transitions/keyframes, template timing and view-transition theme switching; reduced-motion support is uneven.

Shared components include Modal, LiveAnnouncer, navbar, inspector, panels and template cards, but custom dialogs duplicate interaction logic. The stylesheet contains many layers of overrides and legacy selectors, including removed text-overlay UI. Newer shortcut/tour rules reference tokens outside the actual system, causing fallback styling. Some background declarations have unmatched closing parentheses.

Preserve identity and improve consistency through a small set of tested button/input/dialog/toolbar primitives. Document each semantic token’s background/foreground role, keep instance-specific --card-accent separate from global tokens, and validate both themes through computed styles/screenshots before deleting overrides.
