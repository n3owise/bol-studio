import React from 'react';
import { ArrowUpRight, Mic, Sparkles, Upload, Wand2 } from 'lucide-react';
import templatesJson from '../lib/caption-templates.json';
import { Reveal, ShinyText, SplitText, SpotlightCard } from './fx';
import { KEYWORD_PAGES, type KeywordPageContent } from './pages';
import { Reel } from './Reel';
import { LOOP_SECONDS } from './remotion/timing';
import { GALLERY_LINES } from './remotion/sampleWords';
import { Faq, FinalCta, GUIDE_LINKS, PageShell, PrimaryCta, loadLoop } from './shared';

const templates = templatesJson as { id: string; name: string; tag: string; description: string }[];
const templateById = (id: string) => templates.find(t => t.id === id)!;
const STEP_ICONS = [<Upload size={22} key="u" />, <Mic size={22} key="m" />, <Wand2 size={22} key="w" />, <Sparkles size={22} key="s" />];
const PICK_ACCENTS = ['#2ee368', '#ff4fa3', '#22d3ee'];

/** A template playing live inside a 4:5 card. */
function TemplateCard({ id, line, hero, accent, caption }: { id: string; line: string; hero: number; accent: string; caption?: string }) {
  const t = templateById(id);
  return (
    <SpotlightCard className="lp-template-card" style={{ '--card-accent': accent } as React.CSSProperties}>
      <Reel
        load={loadLoop}
        inputProps={{ template: id, line, hero, accent }}
        durationInFrames={Math.round(LOOP_SECONDS * 30)} fps={30} width={1080} height={1350}
        label={`${t.name} caption template`}
      />
      <div className="lp-template-meta"><strong><i className="lp-template-dot" aria-hidden="true" />{t.name}</strong><span>{t.tag.split(' · ').pop()?.toLowerCase()}</span></div>
      {caption && <p className="lp-template-why">{caption}</p>}
    </SpotlightCard>
  );
}

/**
 * One search-led page: a hero that answers the query, an explainer, a worked
 * comparison, steps, recommended styles, tips, related guides and an FAQ.
 * The section kickers keep the home page's caption-timecode labels.
 */
export function KeywordPage({ page }: { page: KeywordPageContent }) {
  const related = GUIDE_LINKS.filter(l => l.href !== page.path);
  return (
    <PageShell>
      <section className="lp-kw-hero" aria-labelledby="kw-title">
        <div className="lp-hero-glow" aria-hidden="true" />
        <div className="lp-container lp-kw-hero-grid">
          <div className="lp-kw-hero-copy">
            <Reveal><span className="lp-eyebrow"><span className="lp-pulse" aria-hidden="true" /><ShinyText>{page.eyebrow}</ShinyText></span></Reveal>
            <SplitText as="h1" className="lp-h1 lp-kw-h1" text={page.h1} accent={page.accent} />
            <Reveal as="p" className="lp-lede" delay={380}>{page.lede}</Reveal>
            <Reveal className="lp-hero-ctas is-left" delay={500}>
              <PrimaryCta />
              <a href="/caption-styles" className="btn btn-ghost btn-lg">See all 24 styles</a>
            </Reveal>
          </div>
          <Reveal className="lp-kw-demo" delay={250}>
            <TemplateCard id={page.demo.template} line={page.demo.line} hero={page.demo.hero} accent={page.demo.accent ?? '#2ee368'} />
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-kw-intro" aria-labelledby="kw-intro">
        <div className="lp-container lp-kw-split">
          <Reveal className="lp-section-head is-left">
            <span className="lp-kicker"><b>00:04</b>The basics</span>
            <h2 id="kw-intro" className="lp-h2">{page.intro.heading}</h2>
          </Reveal>
          <div className="lp-kw-prose">
            {page.intro.paragraphs.map((p, i) => <Reveal as="p" key={i} delay={i * 80}>{p}</Reveal>)}
          </div>
        </div>
      </section>

      <section className="lp-section lp-kw-examples" aria-labelledby="kw-examples">
        <div className="lp-container">
          <Reveal className="lp-section-head">
            <span className="lp-kicker"><b>00:09</b>Examples</span>
            <h2 id="kw-examples" className="lp-h2">{page.examples.heading}</h2>
            <p className="lp-sub">{page.examples.sub}</p>
          </Reveal>
          <Reveal className="lp-kw-table-wrap">
            <table className={`lp-kw-table ${page.examples.strike ? 'is-compare' : ''}`}>
              <thead><tr><th scope="col">{page.examples.cols[0]}</th><th scope="col">{page.examples.cols[1]}</th></tr></thead>
              <tbody>
                {page.examples.rows.map(([a, b]) => (
                  <tr key={a}><td className="is-before">{a}</td><td className="is-after"><mark>{b}</mark></td></tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-steps" aria-labelledby="kw-how">
        <div className="lp-container">
          <Reveal className="lp-section-head">
            <span className="lp-kicker"><b>00:15</b>How to</span>
            <h2 id="kw-how" className="lp-h2">How to do it in Bol Studio.</h2>
          </Reveal>
          <ol className="lp-steps-list is-four">
            {page.steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 110} className="lp-step">
                <SpotlightCard className="lp-step-card">
                  <div className="lp-step-top"><span className="lp-step-icon">{STEP_ICONS[i]}</span><span className="lp-step-n">{String(i + 1).padStart(2, '0')}</span></div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-gallery" aria-labelledby="kw-styles">
        <div className="lp-container">
          <Reveal className="lp-section-head">
            <span className="lp-kicker"><b>00:21</b>Styles</span>
            <h2 id="kw-styles" className="lp-h2">{page.styles.heading}</h2>
          </Reveal>
          <ul className="lp-gallery-grid is-three">
            {page.styles.picks.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 90} className="lp-gallery-item">
                <TemplateCard id={p.id} line={GALLERY_LINES[(i + 2) % GALLERY_LINES.length]} hero={1 + i} accent={PICK_ACCENTS[i]} caption={p.why} />
              </Reveal>
            ))}
          </ul>
          <Reveal className="lp-center"><a href="/caption-styles" className="btn btn-ghost btn-md">Browse all 24 styles <ArrowUpRight size={16} aria-hidden="true" /></a></Reveal>
        </div>
      </section>

      <section className="lp-section lp-kw-tips" aria-labelledby="kw-tips">
        <div className="lp-container lp-kw-split">
          <Reveal className="lp-section-head is-left">
            <span className="lp-kicker"><b>00:24</b>Tips</span>
            <h2 id="kw-tips" className="lp-h2">{page.tips.heading}</h2>
          </Reveal>
          <ol className="lp-kw-tip-list">
            {page.tips.items.map((t, i) => (
              <Reveal as="li" key={t.title} delay={i * 90}>
                <h3><b>{i + 1}</b>{t.title}</h3>
                <p>{t.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <Faq items={page.faq} title="Questions, answered." />

      <section className="lp-section lp-kw-related" aria-labelledby="kw-related">
        <div className="lp-container">
          <Reveal className="lp-section-head is-left">
            <h2 id="kw-related" className="lp-h2 is-small">Keep reading</h2>
          </Reveal>
          <ul className="lp-kw-related-grid">
            {related.map((l, i) => (
              <Reveal as="li" key={l.href} delay={i * 60}>
                <a href={l.href} className="lp-kw-related-link"><span>{l.label}</span><ArrowUpRight size={18} aria-hidden="true" /></a>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <FinalCta title={page.final.title} accent={page.final.accent} />
    </PageShell>
  );
}

export const keywordPageFor = (path: string) => KEYWORD_PAGES.find(p => p.path === path);
