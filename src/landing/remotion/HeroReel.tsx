import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionTrack } from '../../remotion/CaptionTrack';
import { defaults, type Settings } from '../../lib/types';
import { HERO_SCENES, sampleLine } from './sampleWords';
import { clamp, reelTheme as t } from './theme';

import { SCENE_SECONDS } from './timing';
export { HERO_FPS, HERO_FRAMES, SCENE_SECONDS } from './timing';

/** Two drifting colour fields on the dark ground, so no frame is a flat fill. */
const BgMesh: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 70;
  const d2 = Math.cos(frame / 70) * 60;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${t.colors.bgAlt} 0%, ${t.colors.bg} 70%)` }}>
      <div style={{
        position: 'absolute', width: 1300, height: 1300, borderRadius: '50%', top: -420 + d2 * 0.4, left: -380 + d1,
        filter: 'blur(60px)', background: `radial-gradient(circle, ${muted ? '#3a3d46' : t.colors.accent}38, transparent 62%)`,
      }} />
      <div style={{
        position: 'absolute', width: 1000, height: 1000, borderRadius: '50%', bottom: -300, right: -360 - d2,
        filter: 'blur(80px)', background: `radial-gradient(circle, ${muted ? '#2a2c33' : t.colors.teal}2a, transparent 65%)`,
      }} />
    </AbsoluteFill>
  );
};

/**
 * The "speaker": a ring of level bars around a soft core, pulsing as if to a
 * voice. Stands in for footage, which the landing page does not ship.
 */
const VoiceRing: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = 56;
  const intro = spring({ frame, fps, config: t.spring.smooth });
  const breathe = 1 + Math.sin(frame / 22) * 0.02;
  const colour = muted ? '#5b5e68' : t.colors.accent;
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '27%', width: 0, height: 0,
      transform: `scale(${interpolate(intro, [0, 1], [0.86, 1]) * breathe})`, opacity: intro,
    }}>
      <div style={{
        position: 'absolute', width: 300, height: 300, left: -150, top: -150, borderRadius: '50%',
        background: muted
          ? 'radial-gradient(circle at 40% 35%, #3b3e47, #16171c 70%)'
          : `radial-gradient(circle at 40% 35%, #1d3a29, ${t.colors.bgAlt} 72%)`,
        boxShadow: muted ? 'none' : `0 0 120px ${t.colors.glow}, inset 0 0 40px rgba(46,227,104,0.25)`,
        border: `2px solid ${muted ? 'rgba(255,255,255,0.08)' : 'rgba(46,227,104,0.35)'}`,
      }} />
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.abs(Math.sin(frame / 4.2 + i * 0.55)) * 0.6 + Math.abs(Math.sin(frame / 9 + i * 1.7)) * 0.4;
        const len = muted ? 22 + wave * 18 : 30 + wave * 90;
        return (
          <div key={i} style={{
            position: 'absolute', left: -4, top: 0, width: 8, height: len, borderRadius: 8,
            background: colour, opacity: muted ? 0.45 : 0.55 + wave * 0.45,
            transformOrigin: '50% 0%',
            transform: `rotate(${(360 / bars) * i}deg) translateY(185px)`,
          }} />
        );
      })}
    </div>
  );
};

/** Perspective floor lines, scrolling slowly toward the viewer. */
const Floor: React.FC = () => {
  const frame = useCurrentFrame();
  const offset = (frame * 1.6) % 80;
  return (
    <div style={{ position: 'absolute', left: -200, right: -200, bottom: -40, height: 640, perspective: 520, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0, transform: 'rotateX(64deg)', transformOrigin: '50% 100%',
        backgroundImage: 'linear-gradient(rgba(46,227,104,0.16) 2px, transparent 2px), linear-gradient(90deg, rgba(46,227,104,0.10) 2px, transparent 2px)',
        backgroundSize: '80px 80px', backgroundPosition: `0 ${offset}px`,
        maskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
        WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
      }} />
    </div>
  );
};

/** The template's name, as a pill that springs in at each scene and leaves before the next. */
const TemplateChip: React.FC<{ name: string; sceneFrames: number }> = ({ name, sceneFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 4, fps, config: t.spring.snappy });
  const exit = interpolate(frame, [sceneFrames - 10, sceneFrames - 2], [0, 1], { ...clamp, easing: t.ease.in });
  return (
    <div style={{
      position: 'absolute', top: 150, left: 72, display: 'flex', alignItems: 'center', gap: 16,
      padding: '18px 30px 18px 22px', borderRadius: 999, background: 'rgba(17,18,21,0.72)',
      border: '2px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)',
      opacity: p * (1 - exit),
      transform: `translateY(${interpolate(p, [0, 1], [-30, 0]) - exit * 24}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
      fontFamily: t.fonts.display, fontWeight: 700, fontSize: 38, color: t.colors.text, letterSpacing: '-0.02em',
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, background: t.colors.accent, boxShadow: `0 0 18px ${t.colors.glow}` }} />
      {name}
    </div>
  );
};


const ICONS = {
  heart: 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z',
  comment: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z',
  share: 'M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z',
  save: 'M6 3h12v18l-6-4.5L6 21V3z',
};

const Icon: React.FC<{ d: string; size?: number; fill?: string; stroke?: string }> = ({ d, size = 74, fill = 'none', stroke = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/**
 * Reel-style screen furniture: story progress at the top, the action rail on
 * the right, the creator row at the bottom. It makes the phone read as a real
 * short-video app rather than an abstract card. The heart pops once per scene,
 * when the highlighted word lands.
 */
const ReelChrome: React.FC<{ muted?: boolean; scenes: number; sceneFrames: number }> = ({ muted, scenes, sceneFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = Math.min(scenes - 1, Math.floor(frame / sceneFrames));
  const local = frame - scene * sceneFrames;
  const pop = muted ? 0 : spring({ frame: local - Math.round(sceneFrames * 0.55), fps, config: t.spring.bouncy });
  const liked = !muted && local > sceneFrames * 0.55;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: t.fonts.body, color: '#fff' }}>
      <div style={{ position: 'absolute', top: 64, left: 48, right: 48, display: 'flex', gap: 10 }}>
        {Array.from({ length: scenes }).map((_, i) => {
          const fill = i < scene ? 1 : i > scene ? 0 : local / sceneFrames;
          return (
            <div key={i} style={{ flex: 1, height: 7, borderRadius: 7, background: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: '#fff' }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', right: 40, bottom: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46, opacity: muted ? 0.7 : 0.95 }}>
        <div style={{ transform: `scale(${1 + pop * 0.35 - Math.max(0, pop - 1) * 0.35})` }}>
          <Icon d={ICONS.heart} fill={liked ? '#ff3b5c' : 'none'} stroke={liked ? '#ff3b5c' : '#fff'} />
        </div>
        <Icon d={ICONS.comment} />
        <Icon d={ICONS.share} />
        <Icon d={ICONS.save} />
      </div>
      <div style={{ position: 'absolute', left: 48, right: 170, bottom: 120, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: muted ? '#4b4e57' : `conic-gradient(${t.colors.accent}, ${t.colors.teal}, ${t.colors.accent})`, padding: 5 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 34, background: muted ? '#2b2d33' : '#16301f', border: '3px solid #0a0b0d' }} />
          </div>
          <span style={{ fontSize: 38, fontWeight: 700 }}>@aapka.channel</span>
          <span style={{ fontSize: 30, fontWeight: 700, padding: '8px 22px', border: '2.5px solid rgba(255,255,255,0.8)', borderRadius: 14 }}>Follow</span>
        </div>
        <div style={{ fontSize: 34, opacity: 0.85 }}>♪ original audio</div>
      </div>
    </AbsoluteFill>
  );
};

const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill style={{ backgroundColor: t.colors.accent, mixBlendMode: 'soft-light', opacity: 0.12 }} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25), transparent 22%, transparent 70%, rgba(0,0,0,0.45))' }} />
  </AbsoluteFill>
);

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";
  return (
    <AbsoluteFill style={{
      pointerEvents: 'none', backgroundImage: noise, backgroundSize: '220px',
      backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: 0.07, mixBlendMode: 'overlay',
    }} />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
);

const captionSettings = (template: string): Settings => ({ ...defaults, template, position: 54, positionX: 45, fontSize: 88 } as Settings);

/**
 * The "after" phone: every few seconds a new Bol template takes the same kind
 * of line, so the hero shows the product rather than describing it.
 */
export const HeroReel: React.FC = () => {
  const { fps } = useVideoConfig();
  const sceneFrames = Math.round(SCENE_SECONDS * fps);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', fontFamily: t.fonts.body }}>
      <BgMesh />
      <Floor />
      <VoiceRing />
      {HERO_SCENES.map((scene, i) => (
        <Sequence key={scene.template} from={i * sceneFrames} durationInFrames={sceneFrames}>
          <TemplateChip name={scene.name} sceneFrames={sceneFrames} />
          <CaptionTrack
            words={sampleLine(scene.template, scene.text, 0.25, SCENE_SECONDS - 0.7, scene.hero)}
            settings={captionSettings(scene.template)}
            background="transparent"
          />
        </Sequence>
      ))}
      <ReelChrome scenes={HERO_SCENES.length} sceneFrames={sceneFrames} />
      <Grade />
      <Grain />
      <Vignette />
    </AbsoluteFill>
  );
};

/**
 * The "before" phone: the same scene, greyed, with the flat auto-caption most
 * apps produce — and its usual way of spelling Hinglish.
 */
export const PlainReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFrames = Math.round(SCENE_SECONDS * fps);
  const lines = ['yar ye caption to kamal he', 'ab har reel dikhe gi ek dam pro', 'hindi english ya hinglish sab chale ga', 'bas upload karo or chill karo'];
  const line = lines[Math.min(lines.length - 1, Math.floor(frame / sceneFrames))];
  return (
    <AbsoluteFill style={{ overflow: 'hidden', filter: 'saturate(0.2) brightness(0.8)' }}>
      <BgMesh muted />
      <VoiceRing muted />
      <div style={{
        position: 'absolute', left: 90, right: 90, top: '55%', textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 62, lineHeight: 1.3, color: '#fff',
      }}>
        <span style={{ background: 'rgba(0,0,0,0.75)', padding: '6px 14px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{line}</span>
      </div>
      <ReelChrome muted scenes={lines.length} sceneFrames={sceneFrames} />
      <Grain />
      <Vignette />
    </AbsoluteFill>
  );
};
