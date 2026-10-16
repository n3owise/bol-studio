import React from 'react';
import { Composition } from 'remotion';
import { HERO_FPS, HERO_FRAMES, HeroReel, PlainReel } from './HeroReel';
import { LOOP_SECONDS, OgCard, TemplateLoop, type TemplateLoopProps } from './TemplateLoop';

/** The landing page's compositions, registered for rendering and frame checks. */
export const LandingRoot: React.FC = () => (
  <>
    <Composition id="HeroReel" component={HeroReel} durationInFrames={HERO_FRAMES} fps={HERO_FPS} width={1080} height={1920} />
    <Composition id="PlainReel" component={PlainReel} durationInFrames={HERO_FRAMES} fps={HERO_FPS} width={1080} height={1920} />
    <Composition
      id="TemplateLoop"
      component={TemplateLoop as React.FC<TemplateLoopProps>}
      durationInFrames={Math.round(LOOP_SECONDS * 30)}
      fps={30}
      width={1080}
      height={1350}
      defaultProps={{ template: 'mogrt-swing', line: 'aaj ka vlog shuru karte hain', hero: 1 }}
    />
    <Composition id="OgCard" component={OgCard} durationInFrames={60} fps={30} width={1200} height={630} />
  </>
);
