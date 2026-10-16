import { HERO_SCENES } from './sampleWords';

/** Composition sizes and lengths, importable without pulling in Remotion itself. */
export const HERO_FPS = 30;
export const SCENE_SECONDS = 3.6;
export const HERO_FRAMES = Math.round(HERO_SCENES.length * SCENE_SECONDS * HERO_FPS);
export const LOOP_SECONDS = 3.2;
