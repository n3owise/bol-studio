# Caption style and thumbnail parity

The picker now renders `CaptionTrack`, the same composition used by the video preview and server export. Idle cards show a settled frame; hover or keyboard focus plays the actual composition. Only one card animates at a time, with motion disabled for reduced-motion preferences. Cards use current text settings and the selected preset's custom accent.

Source inspection on 2026-10-12 found nine original archives in `Documents/Premiere Assets/MOGRT/Render composition 1–9.mogrt`. Compositions 1 and 3–9 contain one Montserrat Black text layer, Glow and Gradient Ramp. Composition 2 has three fields: Montserrat ExtraBold Italic, STIX Two Text SemiBold, Montserrat SemiBold Italic. The web adaptation uses those fonts and effects in word-by-word emphasized lockups; it does not reproduce the original text-field structure.

The eight single-field originals genuinely share typography. Their distinct browser motion variants are approximations; the named browser presets cannot be conclusively mapped to source compositions from the available metadata. All supplied JPG previews and embedded thumbnails are black. Pixel-exact Premiere motion, positioning, gradient and glow parity remains unverified and requires visible Premiere reference renders. No source assets are copied into the public site.

The remaining web templates use distinct title, stacked, serif, boxed, outlined and karaoke compositions. User font, position, case, colors and motion settings remain overrides. Thumbnails illustrate a sample phrase rather than the user's actual transcript; the video's aspect ratio and content naturally affect final wrapping and scale.

Validation: render a settled frame for every registered template, inspect the contact sheet, verify timed MOGRT stacks and word-title pagination, run frontend tests, typecheck, isolated production build, and desktop browser picker checks.

## Word-by-word caption adaptation

The user clarified that Premiere effects should be adapted to timed, emphasized-word captions rather than reproduce single text fields. All MOGRT presets now use separate word entrances: prefix above-left, enlarged accent word centered, suffix below-right. Source fonts and effects remain inspiration, not exact Premiere parity. The Text panel effect target selects all words or emphasized words only. In emphasized-only mode supporting words keep normal typography/color with a subtle entrance; page-wide framing and tilt are removed so effects stay on individual emphasized words. Caption size, emphasized size and line height still apply.
