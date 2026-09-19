import React, { useEffect, useRef, useState } from 'react';
import { AsciiArt } from './AsciiArt';

/**
 * The caption demonstration beside the sign-in form.
 *
 * This panel used to be decoration. It is the product instead: one real
 * treatment, running on a real script with real per-word timings.
 *
 * The treatment is `mogrt-rise` — the Premiere preset the editor ships, read
 * out of the .mogrt file: a Montserrat Black lockup with a gradient ramp and a
 * glow on the emphasised word, entering with a rise. It is the smoothest of the
 * nine, which is why it is the one a stranger should see first. The constants
 * below are not a lookalike; they are the same numbers the renderer uses, from
 * src/remotion/theme.ts and src/remotion/treatments.ts, scaled to this frame.
 *
 * One treatment, not a carousel. A row of style chips turned the panel into a
 * picker, and a picker invites you to compare rather than to watch — which is
 * the wrong job for the eight seconds somebody spends here.
 *
 * It is a purpose-built miniature, not the Remotion player. The player would
 * pull the whole renderer and a composition into the first screen anyone loads,
 * to show eight seconds of text.
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
  { text: 'ki',      start: 1.64, end: 1.92 },
  { text: 'ye',      start: 2.00, end: 2.30 },
  { text: 'kaise',   start: 2.30, end: 2.88 },
  { text: 'kaam',    start: 2.88, end: 3.36 },
  { text: 'karta',   start: 3.36, end: 3.88 },
  { text: 'hai',     start: 3.88, end: 4.44 },
  { text: 'Har',     start: 4.84, end: 5.18 },
  { text: 'word',    start: 5.18, end: 5.60 },
  { text: 'apne',    start: 5.60, end: 6.06 },
  { text: 'time',    start: 6.06, end: 6.50 },
  { text: 'par',     start: 6.50, end: 7.04 },
];

/**
 * Where the line breaks into pages, as [first, last+1] word indices.
 *
 * Five words a page, which is what the editor's own paging lands on for speech
 * at this rate: short enough to read at a glance on a phone held at arm's
 * length, long enough that the page is not changing on every other word.
 */
const PAGES: [number, number][] = [[0, 5], [5, 10], [10, 15]];

const DURATION = 7.8;

/**
 * Where the loop opens, in seconds.
 *
 * Not zero: at zero the first word is mid-entrance and the frame is briefly
 * empty, so the first thing a visitor sees is a blank video. Starting a beat in
 * means the panel has a composed caption in it from the first painted frame.
 */
const START_AT = 1.15;

/* ---- mogrt-rise, as the renderer has it ---------------------------------- */

/** treatments.ts: mogrtBase.heroScale, which mogrt-rise takes unchanged. */
const HERO_SCALE = 1.45;
/** theme.timing.presetIn — the Premiere presets travel further and take longer. */
const ENTER = 0.42;
/** theme.BASE_WIDTH. Every motion constant below is authored against it. */
const BASE_WIDTH = 720;
/** theme.motion.heroRise / heroBlur / heroFrom. */
const HERO_RISE = 14;
const HERO_BLUR = 9;
const HERO_FROM = 0.62;
/** theme.ease.out, near enough: fast attack, long glide. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function timecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export const CaptionDemo: React.FC<{ compact?: boolean }> = ({ compact }) => {
  // Total elapsed, not the position in the loop: the loop position is derived
  // from it, so nothing has to be reset when it wraps.
  const [elapsed, setElapsed] = useState(START_AT);
  const [motion, setMotion] = useState(true);
  const frame = useRef<number>(0);

  // The frame's own width, so the motion constants can be scaled the way the
  // renderer scales them — k = width / 720. Without it, a rise and a blur
  // authored for a 720px frame get applied to a 300px one, which is a different
  // animation wearing the same numbers.
  const stage = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(BASE_WIDTH);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // A composed still, not a blank one: parked mid-sentence so the hero word,
    // the gradient and the word track are all showing something true.
    if (query?.matches) { setMotion(false); setElapsed(2.6); return; }

    const started = performance.now() - START_AT * 1000;
    const tick = (now: number) => {
      setElapsed((now - started) / 1000);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const time = elapsed % DURATION;
  const k = stageWidth / BASE_WIDTH;

  // Which page is on screen. A page comes up just before its first word is
  // spoken and holds until the next one does, which is how caption pages behave
  // in the editor — the text is never absent mid-sentence.
  const pageIndex = PAGES.reduce(
    (found, [first], i) => (time >= SCRIPT[first].start - 0.3 ? i : found),
    0,
  );
  const [pageStart, pageEnd] = PAGES[pageIndex];
  const page = SCRIPT.slice(pageStart, pageEnd);

  // The hero is whichever word is being spoken, and it holds until the next one
  // takes over — so there is never a frame with no emphasis.
  const heroIndex = page.reduce((found, word, i) => (time >= word.start ? i : found), 0);

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

      <div className="demo-stage" ref={stage}>
        {/* Stand-in for footage. A gradient rather than a still, because a
            photograph of somebody who did not agree to appear in a sign-in
            screen is not a detail to hand-wave, and the captions are the
            subject here anyway. */}
        <div className="demo-backdrop" aria-hidden="true" />

        <div className="demo-captions">
          {page.map((word, i) => {
            const isHero = i === heroIndex;

            // The rise: opacity, travel, blur and scale on one envelope,
            // started when the word is spoken. Read off the clock rather than
            // restarting a CSS keyframe, which cannot be retriggered faster
            // than it plays — that bug left the frame empty once already.
            const age = Math.max(0, time - word.start);
            const t = motion ? Math.min(1, age / ENTER) : 1;
            const e = easeOut(t);

            const scale = (isHero ? HERO_SCALE : 1) * (HERO_FROM + (1 - HERO_FROM) * e);
            const rise = (1 - e) * HERO_RISE * k;
            const blur = (1 - e) * HERO_BLUR * k;

            return (
              <span
                key={pageStart + i}
                className={`demo-word${isHero ? ' is-hero' : ''}`}
                // The blur goes through a custom property rather than `filter`
                // so the stylesheet can compose it with the hero's two glow
                // drop-shadows. Setting `filter` here would replace them, and
                // the emphasis would lose its glow for the whole entrance.
                style={{
                  opacity: Math.min(1, t / 0.35),
                  transform: `translateY(${rise.toFixed(2)}px) scale(${scale.toFixed(3)})`,
                  ['--demo-blur' as string]: `${blur.toFixed(2)}px`,
                } as React.CSSProperties}
              >
                {word.text}
              </span>
            );
          })}
        </div>

        {/* The transport is a word track, not a progress bar. One segment per
            word, at its real width, lighting as the playhead crosses it: that
            is what "word-level timing" means, and a solid green bar would have
            demonstrated nothing except that time passes. Not a control — there
            is nothing to scrub on a sign-in screen, and a transport that
            ignored the click would be worse than none. */}
        <div className="demo-transport" aria-hidden="true">
          <div className="demo-track">
            {SCRIPT.map((word, i) => (
              <span
                key={i}
                className={`demo-tick${time >= word.end ? ' is-past' : ''}${
                  time >= word.start && time < word.end ? ' is-now' : ''}`}
                style={{
                  left: `${(word.start / DURATION) * 100}%`,
                  width: `${((word.end - word.start) / DURATION) * 100}%`,
                }}
              />
            ))}
            <span className="demo-playhead" style={{ left: `${progress * 100}%` }} />
          </div>
          <span className="demo-time">{timecode(time)} / {timecode(DURATION)}</span>
        </div>

        <span className="demo-badge" aria-hidden="true">Rise — Premiere preset</span>
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
