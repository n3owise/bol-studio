import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionTrack } from '../../remotion/CaptionTrack';
import { defaults, type Settings } from '../../lib/types';
import { sampleLine } from './sampleWords';
import { clamp, reelTheme as t } from './theme';

import { LOOP_SECONDS } from './timing';
export { LOOP_SECONDS } from './timing';

export type TemplateLoopProps = { template: string; line: string; hero: number; accent?: string };

/** One gallery card: a single template playing a single line on a moving ground. */
export const TemplateLoop: React.FC<TemplateLoopProps> = ({ template, line, hero, accent = t.colors.accent }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 40;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 30% 10%, ${accent}1f 0%, ${t.colors.bgAlt} 45%, ${t.colors.bg} 100%)`, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: 700, height: 700, borderRadius: '50%', right: -260 + drift, bottom: -320,
        background: `radial-gradient(circle, ${accent}33, transparent 65%)`, filter: 'blur(40px)',
      }} />
      <CaptionTrack
        words={sampleLine(template, line, 0.2, LOOP_SECONDS - 0.6, hero)}
        settings={{ ...defaults, template, accent, position: 50, fontSize: 70 } as Settings}
        background="transparent"
      />
    </AbsoluteFill>
  );
};

/**
 * The 1200×630 link preview (og:image): wordmark, promise and one template
 * mid-animation. Rendered to public/og-image.jpg with `remotion still`.
 */
export const OgCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: t.spring.smooth });
  const mark = spring({ frame: frame - 12, fps, config: t.spring.smooth });
  const ink = '#09090b';
  return (
    <AbsoluteFill style={{ background: '#fcfcfd', fontFamily: t.fonts.display, color: ink }}>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 39px, rgba(9,9,11,0.05) 39px 40px)' }} />
      <div style={{ position: 'absolute', right: -120, top: 120, width: 760, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(46,227,104,0.28), transparent 65%)', filter: 'blur(30px)', transform: 'rotate(-8deg)' }} />
      <div style={{ position: 'absolute', left: 72, top: 64 }}>
        <Img src={staticFile('bol.studio.svg')} style={{ height: 36 }} />
      </div>
      <div style={{
        position: 'absolute', left: 72, top: 160, width: 660, fontSize: 76, lineHeight: 1.0, fontWeight: 700, letterSpacing: '-0.05em',
        opacity: p, transform: `translateY(${interpolate(p, [0, 1], [24, 0], clamp)}px)`,
      }}>
        Hinglish captions that sound like{' '}
        <span style={{ position: 'relative', display: 'inline-block', padding: '0 6px' }}>
          <span style={{ position: 'absolute', left: -4, right: -4, top: '34%', bottom: '-6%', background: 'rgba(46,227,104,0.7)', borderRadius: '8px 22px 10px 26px', transform: `skewX(-8deg) rotate(-1.5deg) scaleX(${mark})`, transformOrigin: 'left center', zIndex: -1 }} />
          <span style={{ position: 'relative' }}>you.</span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: 72, bottom: 70, fontFamily: t.fonts.body, fontSize: 28, color: '#52525b' }}>
        Animated captions for Reels, Shorts &amp; YouTube
      </div>
      <div style={{
        position: 'absolute', right: 80, top: 56, width: 330, height: 518, borderRadius: 46, padding: 9,
        background: 'linear-gradient(150deg, #ffffff, #e4e6ea 45%, #f6f7f9)', boxShadow: '0 0 0 6px rgba(46,227,104,0.2), 0 40px 80px -30px rgba(9,9,11,0.45)',
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 37, overflow: 'hidden', background: `radial-gradient(120% 80% at 30% 15%, #1b3324 0%, ${t.colors.bgAlt} 50%, ${t.colors.bg} 100%)` }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 190, textAlign: 'center', lineHeight: 0.95 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: t.colors.text }}>ekdum</div>
            <div style={{ display: 'inline-block', margin: '10px 0', padding: '6px 22px 10px', borderRadius: 18, background: t.colors.accent, color: t.colors.accentText, fontSize: 84, fontWeight: 700, letterSpacing: '-0.04em' }}>MAST</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: t.colors.text }}>captions</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
