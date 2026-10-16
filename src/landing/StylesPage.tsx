import React from 'react';
import templatesJson from '../lib/caption-templates.json';
import { Reveal, ShinyText, SplitText, SpotlightCard } from './fx';
import { Reel } from './Reel';
import { LOOP_SECONDS } from './remotion/timing';
import { GALLERY_LINES } from './remotion/sampleWords';
import { Faq, FinalCta, PageShell, PrimaryCta, loadLoop } from './shared';

const templates = templatesJson as { id: string; name: string; tag: string; description: string }[];
const ACCENTS = ['#2ee368', '#ff4fa3', '#ffb020', '#22d3ee', '#a78bfa', '#ff6b4a', '#7dd3fc', '#facc15'];

export const STYLES_FAQ = [
  { q: 'How many caption styles does Bol Studio have?', a: `${templates.length} animated templates, from bold rising words to glowing scripts, highlight pills and one-word-at-a-time hooks.` },
  { q: 'Can I change the colours of a style?', a: 'Yes. Each style takes your own text and highlight colours, and the highlighted word can be any word you choose.' },
  { q: 'Do the styles work with Hindi in Devanagari?', a: 'Yes. Every style falls back to a Devanagari typeface, so Hindi renders properly in all of them.' },
  { q: 'Can I switch style after captioning?', a: 'Yes. The words and timing stay the same; pick another style and the whole video updates.' },
];

/**
 * Every template, playing live. Players mount only near the viewport and pause
 * off screen, so 24 of them on one page stay cheap.
 */
export function StylesPage() {
  return (
    <PageShell>
      <section className="lp-hero lp-styles-hero" aria-labelledby="styles-title">
        <div className="lp-hero-glow" aria-hidden="true" />
        <div className="lp-container lp-hero-copy">
          <Reveal><span className="lp-eyebrow"><span className="lp-pulse" aria-hidden="true" /><ShinyText>{templates.length} caption styles</ShinyText></span></Reveal>
          <SplitText as="h1" className="lp-h1" text="Animated caption styles, playing live." accent={['live']} />
          <Reveal as="p" className="lp-lede" delay={380}>
            Every Bol Studio template, each with a Hinglish name and its own motion. Pick one in the studio and your whole video takes it on — the words and timing stay the same.
          </Reveal>
          <Reveal className="lp-hero-ctas" delay={500}><PrimaryCta>Try them on your video</PrimaryCta></Reveal>
        </div>
      </section>

      <section className="lp-section lp-gallery lp-styles-all" aria-label="All caption styles">
        <div className="lp-container">
          <ul className="lp-gallery-grid">
            {templates.map((t, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              return (
                <Reveal as="li" key={t.id} delay={(i % 4) * 80} className="lp-gallery-item">
                  <SpotlightCard as="article" className="lp-template-card" style={{ '--card-accent': accent } as React.CSSProperties}>
                    <Reel
                      load={loadLoop}
                      inputProps={{ template: t.id, line: GALLERY_LINES[i % GALLERY_LINES.length], hero: 1 + (i % 3), accent }}
                      durationInFrames={Math.round(LOOP_SECONDS * 30)} fps={30} width={1080} height={1350}
                      label={`${t.name} caption template`}
                    />
                    <div className="lp-template-meta"><h2 className="lp-template-name"><i className="lp-template-dot" aria-hidden="true" />{t.name}</h2><span>{t.tag.toLowerCase()}</span></div>
                    <p className="lp-template-why" lang="hi-Latn">{t.description}</p>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <Faq items={STYLES_FAQ} title="About the styles." kicker="00:21" />
      <FinalCta title="Find the style that sounds like you." accent={['you']} />
    </PageShell>
  );
}
