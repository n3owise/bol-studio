import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AsciiArt } from './AsciiArt';

/**
 * The caption demonstration beside the sign-in form.
 *
 * This panel used to be decoration. It is the product instead: the same
 * word-level highlight, the same three treatments, running on a real script
 * with real per-word timings. Somebody who has never heard of bol.studio should
 * be able to look at it for four seconds and know what the thing makes.
 *
 * It is a purpose-built miniature, not the Remotion player. The player would
 * pull the whole renderer, its fonts and a composition into the first screen
 * anyone loads, to show eight seconds of text — so this re-implements the one
 * behaviour that matters, and the treatments below are named after the real
 * ones in src/remotion/treatments.ts rather than invented for the picture.
 */

type DemoWord = { text: string; start: number; end: number };

/**
 * Hinglish, because that is the thing the product is actually good at and an
 * English sentence would demonstrate nothing a dozen other tools cannot do.
 * Timings are the sort of thing the recogniser returns — uneven, because speech
 * is uneven, and that unevenness is the whole point of word-level timing.
 */
const SCRIPT: DemoWord[] = [
  { text: 'Aaj',     start: 0.00, end: 0.42 },
  { text: 'hum',     start: 0.42, end: 0.72 },
  { text: 'dekhte',  start: 0.72, end: 1.24 },
  { text: 'hain',    start: 1.24, end: 1.64 },
  { text: 'ki',      start: 1.64, end: 1.86 },
  { text: 'ye',      start: 1.86, end: 2.16 },
  { text: 'kaise',   start: 2.16, end: 2.74 },
  { text: 'kaam',    start: 2.74, end: 3.22 },
  { text: 'karta',   start: 3.22, end: 3.74 },
  { text: 'hai.',    start: 3.74, end: 4.30 },
  { text: 'Har',     start: 4.70, end: 5.04 },
  { text: 'word',    start: 5.04, end: 5.46 },
  { text: 'apne',    start: 5.46, end: 5.92 },
  { text: 'time',    start: 5.92, end: 6.36 },
  { text: 'par.',    start: 6.36, end: 6.90 },
];

/**
 * Where the line breaks into pages, as [first, last+1] word indices.
 *
 * Five words a page, which is what the editor's own paging lands on for speech
 * at this rate: short enough to read at a glance on a phone held at arm's
 * length, long enough that the page is not changing on every other word.
 */
const PAGES: [number, number][] = [[0, 5], [5, 10], [10, 15]];

const DURATION = 7.6;

type PresetKey = 'karaoke' | 'kinetic' | 'mumbai';

/**
 * Named after the treatments the editor actually ships, so a chip here is a
 * promise the product keeps. The descriptions are what each one does, in the
 * words a creator would use.
 */
const PRESETS: { key: PresetKey; label: string; note: string }[] = [
  { key: 'karaoke', label: 'Karaoke', note: 'Highlight follows the voice' },
  { key: 'kinetic', label: 'Kinetic', note: 'One word, full frame' },
  { key: 'mumbai', label: 'Mumbai', note: 'Stacked and condensed' },
];

function timecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export const CaptionDemo: React.FC<{ compact?: boolean }> = ({ compact }) => {
  // Total elapsed, not the position in the loop: the loop position is derived
  // from it, and the loop *count* is what rotates the style. Storing the
  // wrapped value instead would make that count permanently zero.
  const [elapsed, setElapsed] = useState(0);
  const time = elapsed % DURATION;
  // Auto-rotation shows that more than one treatment exists; once somebody has
  // expressed a preference, moving it out from under them is the wrong answer,
  // so a click pins their choice. null means nobody has chosen yet.
  const [picked, setPicked] = useState<PresetKey | null>(null);
  const [motion, setMotion] = useState(true);
  const frame = useRef<number>(0);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (query?.matches) { setMotion(false); setElapsed(2.4); return; }

    const started = performance.now();
    const tick = (now: number) => {
      setElapsed((now - started) / 1000);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const loops = Math.floor(elapsed / DURATION);

  // Derived, not stored. An effect that advanced a preset on each loop would
  // also fire on mount — twice under StrictMode — so the panel opened on a
  // style nobody had reached yet. Reading it from the loop count has no such
  // edge: loop 0 is always the first preset.
  const preset: PresetKey = picked ?? PRESETS[motion ? loops % PRESETS.length : 0].key;

  const activeIndex = useMemo(
    () => SCRIPT.findIndex((word) => time >= word.start && time < word.end),
    [time],
  );

  // Which page is on screen. A page comes up just before its first word is
  // spoken and holds until the next one does, which is how caption pages behave
  // in the editor — the text is never absent mid-sentence.
  const pageIndex = PAGES.reduce(
    (found, [first], i) => (time >= SCRIPT[first].start - 0.25 ? i : found),
    0,
  );
  const [pageOffset, pageEnd] = PAGES[pageIndex];
  const page = SCRIPT.slice(pageOffset, pageEnd);

  // Kinetic shows one word at a time, so it needs something on screen between
  // words rather than an empty frame.
  const lastSpoken = SCRIPT.reduce((found, word, i) => (time >= word.start ? i : found), 0);

  /**
   * The kinetic entrance, driven off the same clock as everything else.
   *
   * It was a CSS keyframe restarted by remounting the span on each new word,
   * and it sat at zero opacity forever: the animation was being restarted far
   * faster than it could play, so the panel showed an empty frame. Deriving the
   * entrance from the word's own age cannot fail that way — there is no
   * animation to restart, and the value is a pure function of the time.
   */
  const age = Math.max(0, time - SCRIPT[lastSpoken].start);
  const entrance = Math.min(1, age / 0.26);
  const eased = 1 - (1 - entrance) ** 3;

  const progress = Math.min(1, time / DURATION);

  return (
    <div className={`demo${compact ? ' demo-compact' : ''}`}>
      <div className="demo-head">
        <span className="demo-live">
          <span className="demo-live-dot" aria-hidden="true" />
          Captions in action
        </span>
        <span className="demo-langs">Hinglish · Hindi · English</span>
      </div>

      <div className="demo-body">
        <div className="demo-stage">
          {/* Stand-in for footage. A gradient rather than a still, because a
              photograph of somebody who did not agree to appear in a sign-in
              screen is not a detail to hand-wave, and the captions are the
              subject here anyway. */}
          <div className="demo-backdrop" aria-hidden="true" />

          <div className={`demo-captions demo-${preset}`}>
            {preset === 'kinetic' ? (
              <span
                className="demo-word is-active"
                style={{
                  opacity: Math.min(1, entrance / 0.4),
                  transform: `scale(${0.78 + 0.22 * eased})`,
                }}
              >
                {SCRIPT[lastSpoken].text.replace(/[.,]$/, '')}
              </span>
            ) : (
              page.map((word, i) => {
                const index = i + pageOffset;
                const state = index === activeIndex ? 'is-active'
                  : (index < activeIndex || (activeIndex === -1 && time > word.end)) ? 'is-spoken'
                  : 'is-ahead';
                return <span key={index} className={`demo-word ${state}`}>{word.text}</span>;
              })
            )}
          </div>

          {/* Not a control: there is nothing to scrub on a sign-in screen, and a
              transport that ignores the click would be worse than none. It is
              here because seeing the playhead cross the words is what makes
              "word-level timing" a claim the panel demonstrates rather than
              states. */}
          <div className="demo-transport" aria-hidden="true">
            <div className="demo-track"><div className="demo-fill" style={{ width: `${progress * 100}%` }} /></div>
            <span className="demo-time">{timecode(time)} / {timecode(DURATION)}</span>
          </div>
        </div>

        <div className="demo-presets" role="group" aria-label="Caption style">
          {PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`demo-preset${item.key === preset ? ' is-on' : ''}`}
              aria-pressed={item.key === preset}
              title={item.note}
              onClick={() => setPicked(item.key)}
            >
              <span className="demo-preset-aa" aria-hidden="true">Aa</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="demo-claim">
        Captions that <em>move</em> with the words.
      </p>

      {!compact && (
        <>
          <ul className="demo-points">
            <li><strong>Hinglish-native</strong>Understands how people actually talk.</li>
            <li><strong>Word-level timing</strong>Every word lands on its own beat.</li>
            <li><strong>Motion-ready</strong>Animated presets, not flat subtitles.</li>
          </ul>

          {/* The waveform, kept as a thin brand strip rather than the panel's
              subject. A terminal aesthetic that dominates would say "developer
              tool", and this is a tool for people who cut video. */}
          <div className="demo-strip">
            <AsciiArt cols={40} rows={4} />
            <span>More than subtitles — a better way to say it.</span>
            <AsciiArt cols={40} rows={4} />
          </div>
        </>
      )}
    </div>
  );
};
