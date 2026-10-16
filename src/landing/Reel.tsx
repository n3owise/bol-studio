import React, { Suspense, lazy, useEffect, useRef } from 'react';
import type { PlayerRef } from '@remotion/player';
import { useMounted, useVisible } from './fx';

/**
 * The Remotion player is loaded only in the browser and only once a reel is
 * near the viewport, so the page's first paint is just HTML, CSS and a poster
 * image. Off-screen reels pause, so a long scroll never has many playing at once.
 */
const LazyPlayer = lazy(() => import('@remotion/player').then(m => ({ default: m.Player })));

type ReelProps = {
  /** Imported lazily, so Remotion and the caption engine load after the page is interactive. */
  load: () => Promise<React.ComponentType<Record<string, unknown>>>;
  inputProps?: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  poster?: string;
  label: string;
  className?: string;
  /** Mount even before it scrolls into view (the hero). */
  eager?: boolean;
};

export const Reel: React.FC<ReelProps> = ({ load, inputProps, durationInFrames, fps, width, height, poster, label, className = '', eager }) => {
  const mounted = useMounted();
  const [ref, visible] = useVisible<HTMLDivElement>('200px');
  const player = useRef<PlayerRef>(null);
  const started = useRef(false);
  const [component, setComponent] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
  if (visible) started.current = true;
  const wanted = mounted && (eager || started.current);
  useEffect(() => {
    if (!wanted || component) return;
    let live = true;
    void load().then(c => { if (live) setComponent(() => c); });
    return () => { live = false; };
  }, [wanted, component, load]);
  const show = wanted && component !== null;

  useEffect(() => {
    const p = player.current; if (!p) return;
    if (visible) p.play(); else p.pause();
  }, [visible, show]);

  return (
    <div ref={ref} className={`reel ${className}`} style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={label}>
      {poster && <img className="reel-poster" src={poster} alt={label} width={width / 2} height={height / 2} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'} />}
      {show && (
        <Suspense fallback={null}>
          <LazyPlayer
            ref={player}
            component={component!}
            inputProps={inputProps ?? {}}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            autoPlay
            loop
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
          />
        </Suspense>
      )}
    </div>
  );
};
