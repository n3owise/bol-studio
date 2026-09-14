import React from 'react';
import { Composition } from 'remotion';
import { CaptionTrack, type CaptionTrackProps } from './CaptionTrack';
import { defaults } from '../lib/types';

/** Captions render at 60 fps: word-by-word entrances are ~8 frames at 30 and read as stepped. */
export const CAPTION_FPS = 60;

const sampleWords = [
  { id: 'w1', text: 'hello', original: 'hello', start: 0.1, end: 0.45, confidence: 1, emphasis: false, emphasisScore: 0.4 },
  { id: 'w2', text: 'my', original: 'my', start: 0.52, end: 0.68, confidence: 1, emphasis: false, emphasisScore: 0.3 },
  { id: 'w3', text: 'naam', original: 'naam', start: 0.76, end: 1.12, confidence: 1, emphasis: true, emphasisScore: 0.88, spotlight: true },
  { id: 'w4', text: 'is', original: 'is', start: 1.18, end: 1.3, confidence: 1, emphasis: false, emphasisScore: 0.2 },
  { id: 'w5', text: 'Rahul', original: 'Rahul', start: 1.34, end: 1.85, confidence: 1, emphasis: false, emphasisScore: 0.6 },
  { id: 'w6', text: 'aur', original: 'aur', start: 2.26, end: 2.42, confidence: 1, emphasis: false, emphasisScore: 0.2 },
  { id: 'w7', text: 'aaj', original: 'aaj', start: 2.46, end: 2.7, confidence: 1, emphasis: false, emphasisScore: 0.45 },
  { id: 'w8', text: 'main', original: 'main', start: 2.74, end: 2.95, confidence: 1, emphasis: false, emphasisScore: 0.3 },
  { id: 'w9', text: 'aapko', original: 'aapko', start: 3.0, end: 3.42, confidence: 1, emphasis: true, emphasisScore: 0.91, spotlight: true },
  { id: 'w10', text: 'is', original: 'is', start: 3.5, end: 3.62, confidence: 1, emphasis: false, emphasisScore: 0.2 },
  { id: 'w11', text: 'video', original: 'video', start: 3.66, end: 4.0, confidence: 1, emphasis: false, emphasisScore: 0.5 },
  { id: 'w12', text: 'me', original: 'me', start: 4.04, end: 4.18, confidence: 1, emphasis: false, emphasisScore: 0.2 },
];

/**
 * The exporter passes the frame size and length alongside the caption data, so
 * one registered composition serves every aspect ratio and clip length.
 */
type CaptionsProps = CaptionTrackProps & {
  width?: number;
  height?: number;
  durationInFrames?: number;
};

const DEFAULT_PROPS: CaptionsProps = {
  words: sampleWords,
  settings: defaults,
  background: 'transparent',
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Captions"
    component={CaptionTrack as React.FC<CaptionsProps>}
    durationInFrames={Math.round(5 * CAPTION_FPS)}
    fps={CAPTION_FPS}
    width={720}
    height={1280}
    defaultProps={DEFAULT_PROPS}
    calculateMetadata={({ props }: { props: CaptionsProps }) => ({
      durationInFrames: props.durationInFrames ?? Math.round(5 * CAPTION_FPS),
      width: props.width ?? 720,
      height: props.height ?? 1280,
    })}
  />
);
