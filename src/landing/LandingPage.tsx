import React from 'react';
import { AudioLines, Captions, Crop, Download, Highlighter, Languages, Mic, Play, Sparkles, Timer, Upload, Wand2 } from 'lucide-react';
import templatesJson from '../lib/caption-templates.json';
import { FAQ, FEATURES, KEYWORDS, STEPS, USE_CASES } from './content';
import { Marquee, Reveal, ScrollWords, ShinyText, SplitText, SpotlightCard, Tilt } from './fx';
import { Faq, FinalCta, PageShell, PrimaryCta, loadHero, loadLoop, loadPlain } from './shared';
import { Reel } from './Reel';
import { HERO_FPS, HERO_FRAMES, LOOP_SECONDS } from './remotion/timing';

import { GALLERY_LINES } from './remotion/sampleWords';


const GALLERY_IDS = ['mogrt-swing', 'mogrt-drop', 'mogrt-wipe', 'mogrt-triple', 'neon', 'mogrt-flip', 'glow-script', 'bounce'];
/** One hero colour per card, so the gallery shows that the accent is the creator's choice. */
const GALLERY_ACCENTS = ['#2ee368', '#ff4fa3', '#ffb020', '#22d3ee', '#a78bfa', '#ff6b4a', '#7dd3fc', '#facc15'];
const templates = templatesJson as { id: string; name: string; tag: string }[];
const GALLERY = GALLERY_IDS.map((id, i) => {
  const t = templates.find(x => x.id === id)!;
  return { id, name: t.name, tag: t.tag.split(' · ').pop() ?? '', line: GALLERY_LINES[i % GALLERY_LINES.length], hero: 1 + (i % 3), accent: GALLERY_ACCENTS[i] };
});

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  hinglish: <Languages size={22} />, timing: <Timer size={22} />, highlight: <Highlighter size={22} />,
  templates: <Wand2 size={22} />, frame: <Crop size={22} />, export: <Download size={22} />,
};
const STEP_ICONS = [<Upload size={22} key="u" />, <Mic size={22} key="m" />, <Sparkles size={22} key="s" />];

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-container lp-hero-copy">
        <Reveal className="lp-eyebrow-wrap">
          <span className="lp-eyebrow"><span className="lp-pulse" aria-hidden="true" /><ShinyText>Made for Hinglish creators</ShinyText></span>
        </Reveal>
        <SplitText as="h1" className="lp-h1" text="Hinglish captions that sound like you." accent={['you']} />
        <Reveal as="p" className="lp-lede" delay={420}>
          Upload a Reel, Short or YouTube video. Bol writes every word the way you say it — Hinglish, Hindi or English — and animates it in styles made to stop the scroll.
        </Reveal>
        <Reveal className="lp-hero-ctas" delay={560}>
          <PrimaryCta />
          <a href="#styles" className="btn btn-ghost btn-lg"><Play size={16} aria-hidden="true" />See the styles</a>
        </Reveal>
        <Reveal as="ul" className="lp-hero-proof" delay={680}>
          <li>No watermark</li><li>Exports up to 4K · 60 fps</li><li>Roman Hindi &amp; Devanagari</li>
        </Reveal>
      </div>

      <Reveal className="lp-container lp-compare" delay={300}>
        <div className="lp-phone-col is-before">
          <span className="lp-phone-tag">Typical auto-captions</span>
          <p className="lp-note is-wrong" aria-hidden="true"><span>yar? kamal?</span><em>spelling it wrong</em></p>
          <Tilt className="lp-phone is-small">
            <Reel load={loadPlain} durationInFrames={HERO_FRAMES} fps={HERO_FPS} width={1080} height={1920} poster="/landing/hero-before.webp" label="A generic auto-caption, misspelling Hinglish" eager />
          </Tilt>
        </div>
        {/* A pen-drawn arrow, sketched in when the phones scroll into view. */}
        <div className="lp-compare-arrow" aria-hidden="true">
          <span className="lp-arrow-label">Bol fixes it</span>
          <svg viewBox="0 0 160 90" width="160" height="90" fill="none">
            <path className="lp-draw" d="M8 62 C 40 18, 92 10, 140 40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path className="lp-draw is-late" d="M124 26 L 142 41 L 120 50" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="lp-phone-col is-after">
          <span className="lp-phone-tag is-accent">With Bol Studio</span>
          <ul className="lp-notes" aria-label="What changes">
            <li className="lp-note n1"><b>01</b>A new style every scene, 24 to pick from</li>
            <li className="lp-note n2"><b>02</b>Hinglish spelled the way you say it</li>
            <li className="lp-note n3"><b>03</b>The punchline word highlighted, automatically</li>
          </ul>
          <Tilt className="lp-phone is-hero">
            <Reel load={loadHero} durationInFrames={HERO_FRAMES} fps={HERO_FPS} width={1080} height={1920} poster="/landing/hero-after.webp" label="Animated Hinglish captions in four Bol Studio templates" eager />
          </Tilt>
        </div>
      </Reveal>
    </section>
  );
}

function Statement() {
  return (
    <section className="lp-section lp-statement" aria-label="Why Bol">
      <div className="lp-container">
        <ScrollWords
          className="lp-statement-text"
          accent={['scene', 'say']}
          text="Most auto-captions turn “kya scene hai” into “kya seen he”. Your audience notices. Bol is built for the way India actually talks, so your captions read exactly the way you say them."
        />
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="how" className="lp-section lp-steps" aria-labelledby="how-title">
      <div className="lp-container">
        <Reveal className="lp-section-head">
          <span className="lp-kicker"><b>00:04</b>How it works</span>
          <h2 id="how-title" className="lp-h2">From raw clip to captioned reel in three steps.</h2>
        </Reveal>
        <ol className="lp-steps-list">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 120} className="lp-step">
              <SpotlightCard className="lp-step-card">
                <div className="lp-step-top"><span className="lp-step-icon">{STEP_ICONS[i]}</span><span className="lp-step-n">{s.n}</span></div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section id="styles" className="lp-section lp-gallery" aria-labelledby="styles-title">
      <div className="lp-container">
        <Reveal className="lp-section-head">
          <span className="lp-kicker"><b>00:09</b>Caption styles</span>
          <h2 id="styles-title" className="lp-h2">24 animated templates. Zero keyframes.</h2>
          <p className="lp-sub">Motion-designed lockups with Hinglish names and Hinglish timing. These are the real templates, playing live.</p>
        </Reveal>
        <ul className="lp-gallery-grid">
          {GALLERY.map((g, i) => (
            <Reveal as="li" key={g.id} delay={(i % 4) * 90} className="lp-gallery-item">
              <SpotlightCard className="lp-template-card" style={{ '--card-accent': g.accent } as React.CSSProperties}>
                <Reel
                  load={loadLoop}
                  inputProps={{ template: g.id, line: g.line, hero: g.hero, accent: g.accent }}
                  durationInFrames={Math.round(LOOP_SECONDS * 30)} fps={30} width={1080} height={1350}
                  label={`${g.name} caption template`}
                />
                <div className="lp-template-meta"><strong><i className="lp-template-dot" aria-hidden="true" />{g.name}</strong><span>{g.tag.toLowerCase()}</span></div>
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
        <Reveal className="lp-center"><PrimaryCta size="md">Try every style</PrimaryCta></Reveal>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="lp-section lp-features" aria-labelledby="features-title">
      <div className="lp-container">
        <Reveal className="lp-section-head">
          <span className="lp-kicker"><b>00:15</b>Features</span>
          <h2 id="features-title" className="lp-h2">Built for the way India talks on camera.</h2>
        </Reveal>
        <ul className="lp-feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.key} delay={(i % 3) * 100} className={`lp-feature lp-feature-${f.key}`}>
              <SpotlightCard className="lp-feature-card">
                <span className="lp-feature-icon">{FEATURE_ICONS[f.key]}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                {f.key === 'hinglish' && (
                  <div className="lp-script-demo" aria-hidden="true">
                    <span>kya scene hai</span><span className="dev">क्या सीन है</span><span>what’s the scene</span>
                  </div>
                )}
                {f.key === 'timing' && (
                  <div className="lp-wave-demo" aria-hidden="true">{Array.from({ length: 28 }).map((_, k) => <i key={k} style={{ '--k': k } as React.CSSProperties} />)}</div>
                )}
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="lp-section lp-usecases" aria-labelledby="use-title">
      <div className="lp-container">
        <Reveal className="lp-section-head">
          <span className="lp-kicker"><b>00:21</b>Made for</span>
          <h2 id="use-title" className="lp-h2">Every kind of video you post.</h2>
        </Reveal>
        <ul className="lp-usecase-grid">
          {USE_CASES.map((u, i) => (
            <Reveal as="li" key={u.title} delay={i * 90} className="lp-usecase">
              <span className="lp-usecase-icon" aria-hidden="true">{[<Captions size={20} key="a" />, <AudioLines size={20} key="b" />, <Play size={20} key="c" />, <Sparkles size={20} key="d" />][i]}</span>
              <h3>{u.title}</h3><p>{u.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <PageShell>
      <Hero />
      <div className="lp-marquees" aria-label="What Bol makes">
        <Marquee items={KEYWORDS} />
      </div>
      <Statement />
      <Steps />
      <Gallery />
      <Features />
      <UseCases />
      <Faq items={FAQ} />
      <FinalCta />
    </PageShell>
  );
}
