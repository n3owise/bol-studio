import React, { useEffect, useRef, useState } from 'react';

/**
 * Small motion primitives for the landing page, in the spirit of reactbits.dev
 * (SplitText, ShinyText, Magnet, SpotlightCard, ScrollReveal, Marquee), written
 * here so they share the page's tokens and respect prefers-reduced-motion.
 * Everything renders its final content on the server; motion is added after
 * hydration, so crawlers and no-JS readers see the full text.
 */

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

/** Live visibility, for pausing work that is off screen. */
export function useVisible<T extends Element>(margin = '120px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, visible] as const;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Fade + rise + de-blur when scrolled into view. `delay` in ms staggers siblings. */
export const Reveal: React.FC<{ as?: keyof React.JSX.IntrinsicElements; delay?: number; className?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ as = 'div', delay = 0, className = '', children, style }) => {
  const [ref, seen] = useInView<HTMLElement>();
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`fx-reveal ${seen ? 'is-in' : ''} ${className}`} style={{ ...style, '--d': `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
};

/**
 * A headline that rises in word by word. `accent` words are wrapped in the
 * highlight pill; the plain text stays in the DOM for search engines.
 */
export const SplitText: React.FC<{ text: string; accent?: string[]; className?: string; as?: 'h1' | 'h2' | 'p'; start?: number }> = ({ text, accent = [], className = '', as = 'h2', start = 0 }) => {
  const [ref, seen] = useInView<HTMLHeadingElement>('0px');
  const Tag = as;
  const words = text.split(' ');
  return (
    <Tag ref={ref} className={`fx-split ${seen ? 'is-in' : ''} ${className}`} aria-label={text}>
      {words.map((w, i) => {
        const clean = w.replace(/[.,!?]/g, '');
        const isAccent = accent.includes(clean);
        return (
          <React.Fragment key={i}>
            <span className="fx-split-mask" aria-hidden="true">
              <span className={`fx-split-word ${isAccent ? 'fx-accent' : ''}`} style={{ '--i': i, '--s': `${start}ms` } as React.CSSProperties}>{w}</span>
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </Tag>
  );
};

/** Text with a light sweep passing across it. */
export const ShinyText: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`fx-shiny ${className}`}>{children}</span>
);

/** A link that leans toward the pointer and springs back when it leaves. */
export const MagnetLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { strength?: number }> = ({ strength = 0.28, className = '', children, ...rest }) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (prefersReduced() || e.pointerType !== 'mouse') return;
    const el = ref.current!; const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <a ref={ref} className={`fx-magnet ${className}`} onPointerMove={onMove} onPointerLeave={reset} {...rest}>
      {children}
    </a>
  );
};

/** A card with a soft spotlight that follows the pointer across it. */
export const SpotlightCard: React.FC<{ className?: string; children: React.ReactNode; as?: 'div' | 'article' | 'li'; style?: React.CSSProperties }> = ({ className = '', children, as = 'div', style }) => {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as React.ElementType;
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current!; const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return <Tag ref={ref} className={`fx-spotlight ${className}`} style={style} onPointerMove={onMove}>{children}</Tag>;
};

/** An endless horizontal strip; the list is doubled so the loop has no seam. */
export const Marquee: React.FC<{ items: string[]; reverse?: boolean }> = ({ items, reverse }) => (
  <div className={`fx-marquee ${reverse ? 'is-reverse' : ''}`}>
    <div className="fx-marquee-track">
      {[0, 1].map(copy => (
        <ul key={copy} className="fx-marquee-list" aria-hidden={copy === 1 ? true : undefined}>
          {items.map(item => <li key={item}><span className="fx-marquee-dot" />{item}</li>)}
        </ul>
      ))}
    </div>
  </div>
);

/**
 * A paragraph whose words light up as it scrolls through the viewport — the
 * reading is paced by the reader's own scroll.
 */
export const ScrollWords: React.FC<{ text: string; accent?: string[]; className?: string }> = ({ text, accent = [], className = '' }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (prefersReduced()) return;
    setProgress(0);
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect(); const vh = window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);
  const words = text.split(' ');
  return (
    <p ref={ref} className={`fx-scrollwords ${className}`}>
      {words.map((w, i) => {
        const lit = progress * words.length - i;
        const clean = w.replace(/[.,!?—]/g, '');
        return (
          <React.Fragment key={i}>
            <span className={accent.includes(clean) ? 'fx-accent-text' : ''} style={{ opacity: 0.16 + Math.min(1, Math.max(0, lit)) * 0.84 }}>{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </p>
  );
};

/** Tilts its child toward the pointer: depth for the hero phones. */
export const Tilt: React.FC<{ className?: string; children: React.ReactNode; max?: number }> = ({ className = '', children, max = 7 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (prefersReduced() || e.pointerType !== 'mouse') return;
    const el = ref.current!; const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${-y * max}deg`); el.style.setProperty('--ry', `${x * max}deg`);
  };
  const reset = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  return <div ref={ref} className={`fx-tilt ${className}`} onPointerMove={onMove} onPointerLeave={reset}>{children}</div>;
};
