---
version: 1
name: bol.studio
description: >
  The design system for bol.studio, a Hinglish caption studio. Dark technical
  creative tool, not a SaaS dashboard: near-neutral greys biased slightly cool,
  one luminous green accent, a geometric display face against a humanist body
  face, and restrained elevation. Light and dark are both first-class and the
  interface is authored in tokens, never literals. This file is extracted from
  the running product — every value below is what src/styles.css actually
  declares, not an aspiration.

colors:
  # One accent, the same hex in both themes. The green is the brand; everything
  # else is a ground for it.
  accent: "#2ee368"
  accent-hover-light: "#26cf5e"
  accent-hover-dark: "#34f573"
  # The ink that goes ON the accent. Same in both themes, because the accent is.
  accent-text: "#052e16"
  # Green as TEXT, on a normal ground. Must differ per theme or it fails
  # contrast on one of them.
  emphasis-text-light: "#15803d"
  emphasis-text-dark: "#6ee89a"

  light:
    bg-app: "#fcfcfd"
    bg-panel: "#ffffff"
    bg-surface: "#f4f5f7"
    bg-surface-hover: "#ebecee"
    bg-input: "#ffffff"
    bg-stage: "#000000"
    text-primary: "#09090b"
    text-secondary: "#52525b"
    text-muted: "#63636b"
    border-subtle: "#e5e7eb"
    border-medium: "#d1d5db"
    border-strong: "#9ca3af"
    brand-ink: "#09090b"
    brand-ink-text: "#ffffff"
    danger: "#ef4444"
    warning: "#f59e0b"
    info: "#3b82f6"

  dark:
    bg-app: "#0a0b0d"
    bg-panel: "#111215"
    bg-surface: "#191b22"
    bg-surface-hover: "#222530"
    bg-input: "#131418"
    bg-stage: "#050507"
    text-primary: "#f4f4f6"
    text-secondary: "#a1a1aa"
    text-muted: "#8b8b96"
    border-subtle: "rgba(255,255,255,0.08)"
    border-medium: "rgba(255,255,255,0.15)"
    border-strong: "rgba(255,255,255,0.28)"
    # Inverts in dark: the primary button becomes the accent.
    brand-ink: "#2ee368"
    brand-ink-text: "#052e16"
    danger: "#f87171"
    warning: "#fbbf24"
    info: "#60a5fa"

typography:
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
  hindi: "'Noto Sans Devanagari', sans-serif"
  caption-montserrat: "'Montserrat', 'Noto Sans Devanagari', 'DM Sans', system-ui, sans-serif"
  floor: 11px   # nothing smaller ships
  scale: [11, 11.5, 12.5, 13, 13.5, 14, 15, 17, 21, 26, 30]

radii:
  pill: 999px
  card: 16px
  panel: 12px
  control: 8px
  chip: 6px

targets:
  min-interactive: 28px   # visual box may be smaller; the hit area may not
---

# bol.studio — design system

A studio for putting animated Hinglish captions on video. It is a **creative
tool**, so it should read as dark, technical and a little playful — not as a
generic SaaS dashboard, not as a cyberpunk terminal, and not as an AI product
with a purple gradient hero.

> This file replaced a generated one describing Anthropic's cream-and-coral
> system. That system is not this product's, and following it would have
> repainted the identity. What follows is extracted from `src/styles.css`.

---

## 1. Non-negotiables

These are not preferences. Each one is here because breaking it shipped a bug.

**Author in tokens, never literals.** A hex in a rule is a value that only works
in one theme. The single exception is a surface that is deliberately one theme
in both — the video stage, the sign-in gate — and those declare their own local
tokens at the top of their block and say why.

**Text on the accent takes `--color-accent-text`, never `--color-text-inverse`.**
`--color-text-inverse` is white in light and near-black in dark; the accent is
the same green in both. Ten rules got this wrong and rendered white-on-green at
1.7:1 — each with the correct ink already sitting there as an unused fallback.
The same trap caught `--color-brand-ink`, which is near-black in light and *the
accent itself* in dark: a green letter on a green circle at 1:1.

**When you find one instance of a token mistake, grep for the pattern.** The
audit found the `--color-text-inverse` bug twice. Searching for the shape of it
found ten more.

**Nothing below 11px, and no interactive target under 28px.** The drawn control
may be smaller — the sign-in switch is 26px tall and reads fine — but its hit
area is grown past it with padding or an oversized invisible input.

**Both themes, every time.** Define the light palette on bare `:root`, redefine
only the tokens for dark. A colour whose only definition lives inside a
`[data-theme]` block never applies in the un-stamped state.

**No control that does nothing.** An ALL CAPS toggle that did not change case, a
PRO badge for a tier that does not exist, alignment icons wired to position,
sample cards that opened nothing — all shipped looking finished. If a control
cannot do its job yet, withhold the entry point rather than draw a dead one.

**Two places must never compute the same answer.** The highlight state, the
caption page split, the theme — each had two implementations that drifted. One
source, read from everywhere.

---

## 2. Colour

One accent. `#2ee368` in both themes, so it is the constant the interface turns
around.

The greens are separated by **job**, and mixing them up is the most common
mistake in this codebase:

| Token | Job |
| --- | --- |
| `--color-accent` | The accent as a **surface** — button fills, focus rings, the active switch, the caption highlight pill |
| `--color-accent-text` | Ink **on** that surface. Same in both themes |
| `--color-emphasis-text` | Green as **text on a normal ground** — links, meter fills, the mark's accent letter. Differs per theme or it fails contrast on one |
| `--color-accent-dim` | Tinted ground behind a selected thing |
| `--color-accent-glow` | Glow only. Never a fill, never text |

Focus and success must not be the same green. Focus is `--color-accent`;
a success or strength signal is `--color-emphasis-text`. A focused-but-weak
field that lights up in the success colour reads as approved.

Neutrals are biased very slightly cool, never a pure mid grey. The dark palette
is obsidian rather than black — `#0a0b0d` app, `#111215` panel — so panels
separate from the page without a border doing all the work.

**Contrast floor is 4.5:1 for body text and 3:1 for large text and UI edges,
measured against the composited background, not the token's nominal ground.**
`--color-text-muted` was one value across both themes and sat at 3.7:1 on dark
panels; it is now `#63636b` light and `#8b8b96` dark for that reason.

---

## 3. Typography

**Space Grotesk** for display — headings, the wordmark area, numerals that want
presence. **DM Sans** for everything read in quantity. **Noto Sans Devanagari**
carries Hindi and must be in any stack that can receive Devanagari, because a
Latin-tight line clips the matras above and below.

Captions rendered into video are a separate stack: **Montserrat 800/900** for
the Premiere-preset treatments, tracked at `-0.035em` for the hero word and
`-0.01em` for the rest, on a `0.86` line height — heavy grotesques ship loose
and display sizes need tightening.

Body copy sits near 65 characters. Headings take `text-wrap: balance`. Uppercase
labels get `0.04em`–`0.09em` of tracking and never drop below 11px. Numbers that
line up in columns take `font-variant-numeric: tabular-nums`.

---

## 4. Surfaces, elevation, motion

Border, fill, radius and shadow each say "separate object" — spend them by role.
One radius and one shadow stamped on everything flattens the hierarchy.

Elevation is four steps, and they are theme-aware: the dark theme's shadows are
much heavier (`0 16px 36px -4px rgba(0,0,0,0.7)` at `lg`) because a soft shadow
disappears on a dark ground.

Motion is `cubic-bezier(0.22, 1, 0.36, 1)` for entrances — fast attack, long
glide — and 120–180ms for state changes. Two rules learned the hard way:

- **Never transition a property you also set every frame from script.** A
  `transition: transform` fighting a per-frame inline transform turns a 420ms
  entrance into a smear.
- **Never restart a CSS keyframe from a React `key` on something that changes
  faster than the animation plays.** It gets retriggered before it can advance
  and sits on its first frame forever — which looks like an empty element, not
  like motion. Derive the value from a clock instead.

Every animation should have a `prefers-reduced-motion` answer; this is a design requirement, not a claim of complete current coverage. That answer should be a
**composed still**, never a blank one.

---

## 5. The sign-in gate

Deliberately its own thing, and the rules above bend for it:

- **Always light**, in both themes, and it declares its own light tokens rather
  than inheriting the document's. Anything added there must take its colour from
  those or from a literal that works on a light ground.
- The style is flat-bordered with **hard offset shadows** — 2px borders, a
  shadow with no blur offset down and right, and a press that moves the control
  the length of its own shadow. After
  `uiverse.io/andrew-demchenk0/afraid-cougar-9` (MIT), rebuilt on our tokens.
- Log in, sign up, reset, "check your inbox" and choosing a new password are
  faces of one card that **turns** between them, counted in signed half-turns.
- The turned-away face is `inert`, and the two faces' field ids differ. Both are
  mounted at once: without the first, tab lands in an invisible form; without
  the second, every `<label>` points at whichever rendered first.

---

## 6. Copy

Write from the reader's side of the screen. A person manages *captions*, not
*treatment payloads*.

**Never promise something the backend may not do.** Sign-up announces a
confirmation email only when the session says one is coming, because that is a
dashboard setting. Password reset says the same thing whether or not the
address exists. Password strength is advice and never a gate, because the only
rule the backend has is a length — inventing a character-class requirement is
claiming something untrue.

**Say the uncomfortable thing early.** Uploads do not survive a restart yet. That
belongs where it is actionable — in the projects list — and not on the sign-in
screen, where it is anxiety at the worst possible moment.

Errors say what went wrong and how to fix it, live next to the field they are
about, carry an icon as well as a colour, and persist while the reader retypes.
A six-second toast is the wrong container for something you must act on.

---

## 7. Known debt

Real, measured, still open. Do not treat this section as decoration.

**Verify by measuring the running app, not by reading the diff.** An edit script
once printed its success line and died before writing the file; two token fixes
looked applied and were not. Only re-measuring in the browser caught it.

### Resolved: audio projects could not be saved

`patch_project` refused *any* `videoEnabled` on a non-video project, and the
editor autosaves the whole project — words, settings, name, `videoEnabled` —
on every change. So every save an audio creator made came back 409 and nothing
reached the disk; the only symptom was the save badge turning amber. It now
refuses only `videoEnabled: true`, which is the actual mistake. Pinned by
`test_an_audio_project_saves_although_it_has_no_video_layer`.

### Resolved: the foreign greens

The product carried three green *families* beside its own: Tailwind `green`
(300/400/500/600/900), Tailwind `emerald` (400/500), and a few one-offs —
twenty distinct green hues in total where there should have been six. Every
foreign one now resolves to a token, picked by the property it painted:

| Property | Token |
| --- | --- |
| `background`, `border`, `outline`, `box-shadow` | `--color-accent` |
| `color` on a normal ground | `--color-emphasis-text` |
| `color` on a green ground | `--color-accent-text` |
| a pale or deep green wash | `--color-accent-dim` |

Bare `#2ee368` in a rule is gone too — 79 of them, each an exact no-op, since
the token is that value in every scope it is declared in.

**Alphas were left alone, deliberately.** A first pass folded twenty-two
different `rgba()` alphas into `--color-accent-dim` and `--color-accent-glow`
and was thrown away: a 0.8 ring is not a 0.45 glow, and collapsing them would
have been a second bug dressed as a fix. Only the *hue* was ever wrong, so
`rgba(34, 197, 94, 0.55)` became `rgba(46, 227, 104, 0.55)` — same alpha, right
green. Six green hues remain and all six are declared tokens.

### Resolved: phantom tokens

Six tokens were referenced and never declared. Three had no fallback, so the
property resolved to nothing; three were guarded but still described a system
that did not exist. All now point at real tokens:

| Was | Now | Why |
| --- | --- | --- |
| `--color-brand-primary` | `--color-accent` | It meant the brand primary, which is the accent |
| `--color-border-active` | `--color-border-hover` | Already carried the exact value the one guarded site spelled out |
| `--shadow-xl` | `--shadow-popover` | Every site was a popover, and the fallbacks were light-theme shadows that stayed light on a dark ground |
| `--bg-surface-elevated` | `--color-bg-surface` | Theme-aware instead of three different hardcoded washes |
| `--color-bg-timeline` | `--color-bg-panel` | Same value in light; stops being a phantom |
| `--rule` | `--color-border-medium` | A hairline is a border |

`--color-brand-primary` also painted `.template-tick`, whose ink was the literal
`#09090b` on an accent ground — the exact trap in section 1. It takes
`--color-accent-text` now.

**A caution about how this was found.** A first pass at this list also accused
`--card-accent` (24 uses) and `--pill-text` (4) of being undeclared. They are
not: `TemplateCard.tsx` sets both inline, per card, from the template's own
accent. They are **instance values, not system tokens**, which is why they do
not sit with the palette. A scan of the stylesheet alone cannot tell the two
apart — check for inline `style={{ '--x': … }}` before calling a token broken.
Both now also carry a floor on `.template-art` so a template arriving without an
accent degrades to the brand green rather than to nothing.

The only names left undeclared in CSS are
`--magicui-theme-toggle-vt-duration` and `--magicui-theme-vt-clip-from`, which
`animated-theme-toggler.tsx` sets on the root with `style.setProperty` for the
duration of a theme transition and removes afterwards.
