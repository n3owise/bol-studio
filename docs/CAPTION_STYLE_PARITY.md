# Caption style and thumbnail parity

The picker now renders `CaptionTrack`, the same composition used by the video preview and server export. Idle cards show a settled frame; hover or keyboard focus plays the actual composition. Only one card animates at a time, with motion disabled for reduced-motion preferences. Cards use current text settings and the selected preset's custom accent.

Source inspection on 2026-10-12 found nine original archives in `Documents/Premiere Assets/MOGRT/Render composition 1–9.mogrt`. Compositions 1 and 3–9 contain one Montserrat Black text layer, Glow and Gradient Ramp. Composition 2 has three fields: Montserrat ExtraBold Italic, STIX Two Text SemiBold, Montserrat SemiBold Italic. The web adaptation keeps word-by-word emphasized lockups and Premiere-inspired motion; it does not reproduce the original text-field structure. On 2026-10-13 the eight presets gained distinct serif/sans font pairings at the user’s request, replacing the shared Montserrat appearance.

The eight single-field originals genuinely share typography. Their distinct browser motion variants are approximations; the named browser presets cannot be conclusively mapped to source compositions from the available metadata. All supplied JPG previews and embedded thumbnails are black. Pixel-exact Premiere motion, positioning, gradient and glow parity remains unverified and requires visible Premiere reference renders. No source assets are copied into the public site.

The remaining web templates use distinct title, stacked, serif, boxed, outlined and karaoke compositions. User font, position, case, colors and motion settings remain overrides. Thumbnails illustrate a sample phrase rather than the user's actual transcript; the video's aspect ratio and content naturally affect final wrapping and scale.

Validation: render a settled frame for every registered template, inspect the contact sheet, verify timed MOGRT stacks and word-title pagination, run frontend tests, typecheck, isolated production build, and desktop browser picker checks.

## Word-by-word caption adaptation

The user clarified that Premiere effects should be adapted to timed, emphasized-word captions rather than reproduce single text fields. All MOGRT presets now use separate word entrances: prefix above-left, enlarged accent word centered, suffix below-right. Source fonts and effects remain inspiration, not exact Premiere parity. The Style panel effect target selects all words or emphasized words only. In emphasized-only mode supporting words keep normal typography/color without movement, appearing at their spoken times; page-wide framing and tilt are removed so effects stay on individual emphasized words. Caption size, emphasized size and line height still apply.

## Independent font controls (2026-10-13)

The Text panel selects `heroFontFamily` and `supportingFontFamily` independently. An unset choice uses the preset pairing; legacy `fontFamily` remains a fallback for existing settings. The font catalog is shared with backend validation, and fonts are bundled into the shared Remotion composition for thumbnails, preview and export.

| Preset | Emphasized font | Supporting font |
| --- | --- | --- |
| Udaan | Playfair Display | DM Sans |
| Dhamaka | Fraunces | Poppins |
| Barsaat | Cormorant Garamond italic | Montserrat |
| Phailaav | Bodoni Moda | Space Grotesk |
| Jhoola | Lora italic | Mukta |
| Parda | DM Serif Display | DM Sans |
| Palat | STIX Two Text italic | Oswald |
| Sarkan | Libre Baskerville italic | Montserrat |

Hindi characters fall back to bundled Noto Devanagari when a selected serif has no Devanagari glyphs.
