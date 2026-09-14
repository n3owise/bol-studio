import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, useVideoConfig } from 'remotion';
import { buildPages } from '../lib/pages';
import { CaptionPage } from './CaptionPage';
import { defaults, type Settings, type Word } from '../lib/types';
import { treatmentFor } from './treatments';

import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/oswald/700.css';
import '@fontsource/noto-sans-devanagari/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/montserrat/600-italic.css';
import '@fontsource/montserrat/800-italic.css';
import '@fontsource/stix-two-text/600.css';

export type CaptionTrackProps = {
  words: Word[];
  settings: Settings;
  /** Transparent for overlay renders; a colour for standalone previews. */
  background?: string;
};

/** Block the first frame until webfonts are ready, so no frame renders in fallback type. */
function useFontsReady() {
  const [handle] = React.useState(() => delayRender('Loading caption fonts'));
  React.useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => { if (!cancelled) continueRender(handle); });
    return () => { cancelled = true; };
  }, [handle]);
}

export const CaptionTrack: React.FC<CaptionTrackProps> = ({ words, settings, background }) => {
  const { fps, width, height } = useVideoConfig();
  useFontsReady();

  const resolved: Settings = { ...defaults, ...settings };
  const perPage = treatmentFor(resolved.template).layout === 'single' ? 1 : resolved.wordsPerLine;
  const pages = useMemo(() => buildPages(words ?? [], perPage), [words, perPage]);

  return (
    <AbsoluteFill style={{ background: background ?? 'transparent' }}>
      {pages.map(page => {
        const from = Math.round(page.start * fps);
        const durationInFrames = Math.max(1, Math.round(page.end * fps) - from);
        return (
          <Sequence key={page.id} from={from} durationInFrames={durationInFrames} layout="none">
            <CaptionPage
              page={page}
              settings={resolved}
              width={width}
              height={height}
              pageFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
