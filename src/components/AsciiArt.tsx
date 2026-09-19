import React, { useEffect, useRef, useState } from 'react';

/**
 * The artwork beside the sign-in form.
 *
 * Drawn as characters rather than an image for two reasons. It weighs nothing —
 * no asset to ship, no second request before the first screen can paint — and
 * it is the right subject: this is a studio for words on top of sound, so the
 * picture is a waveform, rendered in the same grid the captions are edited in.
 *
 * The field is a sum of three travelling sine waves with an envelope that fades
 * towards the top and bottom edges, so the bright band sits across the middle
 * and the corners fall away to blank. Sampling that field per cell and picking a
 * character by density is the whole trick — the "halftone" look is just a ramp
 * from space to '@'.
 */

// Lightest to heaviest. The gap at the start matters more than the glyphs do:
// it is what gives the picture its empty space.
const RAMP = ' .:-=+*#%@';

const DEFAULT_COLS = 58;
const DEFAULT_ROWS = 30;

/** Twelve frames a second. Fast enough to read as motion, slow enough to be cheap. */
const FRAME_MS = 1000 / 12;

function field(col: number, row: number, t: number, cols: number, rows: number): number {
  const x = col / (cols - 1);
  const y = row / (rows - 1);

  // The amplitude of this column, as a waveform bar. Four incommensurable
  // components, so the shape never visibly loops, plus a syllable-rate pulse —
  // speech is not a smooth tone, and a waveform that breathes evenly reads as a
  // synthesiser rather than a voice.
  const speech =
    Math.sin(x * 21.0 - t * 2.1) * 0.34 +
    Math.sin(x * 8.3 + t * 1.3) * 0.28 +
    Math.sin(x * 47.0 - t * 3.4) * 0.14 +
    Math.sin(x * 2.7 + t * 0.6) * 0.24;
  const syllables = 0.55 + 0.45 * Math.abs(Math.sin(x * 5.5 - t * 0.9));

  // Fade towards the left and right ends so the clip appears to start and stop
  // rather than running off under the panel border.
  const ends = Math.sin(Math.PI * Math.min(1, Math.max(0, x))) ** 0.45;

  const amplitude = Math.min(0.94, Math.abs(speech) * syllables * ends * 1.5);

  // A bar, mirrored about the centre line, with a soft tip: the last few cells
  // of each bar land on the lighter end of the ramp, which is what makes the
  // outline read as a curve instead of a staircase.
  const reach = Math.abs(y - 0.5) * 2;
  if (reach > amplitude) return 0;
  return Math.min(1, 0.35 + (amplitude - reach) * 1.8);
}

function frame(t: number, cols: number, rows: number): string {
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const value = field(col, row, t, cols, rows);
      const index = Math.min(RAMP.length - 1, Math.max(0, Math.round(value * (RAMP.length - 1))));
      line += RAMP[index];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export const AsciiArt: React.FC<{ cols?: number; rows?: number }> = ({
  cols = DEFAULT_COLS,
  rows = DEFAULT_ROWS,
}) => {
  // The still frame is the one a reader sees if motion is off, if the tab is in
  // the background, or in the instant before the first tick — so it is composed,
  // not blank.
  const [art, setArt] = useState(() => frame(0, cols, rows));
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches) return;

    let t = 0;
    const tick = () => {
      t += 0.055;
      setArt(frame(t, cols, rows));
    };
    timer.current = window.setInterval(tick, FRAME_MS);
    return () => { if (timer.current !== null) window.clearInterval(timer.current); };
  }, [cols, rows]);

  // aria-hidden: read aloud it is several hundred punctuation marks. It carries
  // no information the form does not already state.
  return <pre className="auth-art-canvas" aria-hidden="true">{art}</pre>;
};
