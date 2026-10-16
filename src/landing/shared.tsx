import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { STUDIO_URL } from './content';
import { MagnetLink, Reveal, SplitText } from './fx';

/**
 * Pieces every public page shares: the nav, footer, FAQ, closing call to
 * action and the Remotion loaders. The home page and the SEO pages are built
 * from these so they stay one site, not five lookalikes.
 */

export type AnyComp = React.ComponentType<Record<string, unknown>>;
export const loadHero = () => import('./remotion/HeroReel').then(m => m.HeroReel as unknown as AnyComp);
export const loadPlain = () => import('./remotion/HeroReel').then(m => m.PlainReel as unknown as AnyComp);
export const loadLoop = () => import('./remotion/TemplateLoop').then(m => m.TemplateLoop as unknown as AnyComp);

/** The SEO pages, in the order the footer lists them. */
export const GUIDE_LINKS = [
  { href: '/hinglish-captions', label: 'Hinglish captions' },
  { href: '/hindi-subtitles', label: 'Hindi subtitles' },
  { href: '/reels-captions', label: 'Captions for Reels' },
  { href: '/youtube-shorts-subtitles', label: 'YouTube Shorts subtitles' },
  { href: '/caption-styles', label: 'All 24 caption styles' },
];

export const PrimaryCta: React.FC<{ children?: React.ReactNode; size?: 'lg' | 'md' }> = ({ children = 'Start captioning', size = 'lg' }) => (
  <MagnetLink href={STUDIO_URL} className={`btn btn-primary btn-${size}`}>
    <span className="btn-shine" aria-hidden="true" />
    {children}<ArrowRight size={18} aria-hidden="true" />
  </MagnetLink>
);

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-nav-inner">
        <a href="/" className="lp-logo" aria-label="Bol Studio home">
          <img src="/bol.studio.svg" alt="bol.studio" width={112} height={26} />
        </a>
        <nav aria-label="Primary" className="lp-nav-links">
          <a href="/#how">How it works</a>
          <a href="/caption-styles">Styles</a>
          <a href="/#features">Features</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-nav-cta">
          <a href={STUDIO_URL} className="lp-nav-login">Log in</a>
          <a href={STUDIO_URL} className="btn btn-primary btn-sm">Get started</a>
        </div>
      </div>
    </header>
  );
}

export type FaqItem = { q: string; a: string };

/**
 * One answer open at a time, opening and closing with a height animation.
 * Answers stay in the DOM while closed, so the prerendered page still carries
 * every one of them for search engines.
 */
export function Faq({ items, title = 'Questions creators ask us.', kicker = '00:27' }: { items: FaqItem[]; title?: string; kicker?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="lp-section lp-faq" aria-labelledby="faq-title">
      <div className="lp-container lp-faq-layout">
        <Reveal className="lp-section-head is-left">
          <span className="lp-kicker"><b>{kicker}</b>FAQ</span>
          <h2 id="faq-title" className="lp-h2">{title}</h2>
          <p className="lp-sub">Still curious? Write to <a href="mailto:hello@bol-studio.me">hello@bol-studio.me</a>.</p>
        </Reveal>
        <div className="lp-faq-list">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div className={`lp-faq-item ${isOpen ? 'is-open' : ''}`}>
                  <h3 className="lp-faq-q">
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                    >
                      <span>{item.q}</span><ChevronDown size={20} aria-hidden="true" />
                    </button>
                  </h3>
                  <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="lp-faq-a" inert={!isOpen}>
                    <div className="lp-faq-a-inner"><p>{item.a}</p></div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ title = 'Your next reel deserves better captions.', accent = ['better'], lede = 'Upload a clip and watch your own words come alive.' }: { title?: string; accent?: string[]; lede?: string }) {
  return (
    <section className="lp-final" aria-labelledby="final-title">
      <div className="lp-final-bg" aria-hidden="true" />
      <div className="lp-container lp-final-inner">
        <SplitText as="h2" className="lp-final-title" text={title} accent={accent} />
        <Reveal as="p" className="lp-lede" delay={300}>{lede}</Reveal>
        <Reveal delay={420}><PrimaryCta /></Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <div className="lp-footer-brand">
          <img src="/bol.studio.svg" alt="bol.studio" width={104} height={24} loading="lazy" />
          <p>Animated Hinglish, Hindi and English captions for Reels, Shorts and YouTube.</p>
        </div>
        <nav aria-label="Guides" className="lp-footer-col">
          <h2 className="lp-footer-title">Guides</h2>
          {GUIDE_LINKS.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <nav aria-label="Footer" className="lp-footer-col">
          <h2 className="lp-footer-title">Bol Studio</h2>
          <a href={STUDIO_URL}>Open the studio</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="mailto:hello@bol-studio.me">Contact</a>
        </nav>
      </div>
      <div className="lp-container"><p className="lp-footer-copy">© {new Date().getFullYear()} Bol Studio</p></div>
    </footer>
  );
}

/** The page frame: skip link, ruled backdrop, nav, main and footer. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <a href="#main" className="lp-skip">Skip to content</a>
      <div className="lp-backdrop" aria-hidden="true" />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
