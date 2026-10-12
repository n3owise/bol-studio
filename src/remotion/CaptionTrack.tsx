import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, useVideoConfig } from 'remotion';
import { buildPages } from '../lib/pages';
import { CaptionPage } from './CaptionPage';
import { defaults, type Settings, type Word } from '../lib/types';
import { localFacesReady } from '../lib/caption-fonts';
import { captionWordsPerPage, treatmentFor } from './treatments';

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
// Every family offered in the caption font picker has to be in this bundle:
// the headless renderer has no access to the browser's fonts, so anything
// missing here silently falls back and the export stops matching the preview.
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/poppins/devanagari-700.css';
import '@fontsource/mukta/700.css';
import '@fontsource/mukta/800.css';
import '@fontsource/anek-devanagari/700.css';
import '@fontsource/anek-devanagari/800.css';
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';

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
    // Both, and in this order: document.fonts.ready settles against the faces
    // registered at that moment, so a face still being added is not waited for
    // by it. The local-only ones are added by a promise of their own.
    localFacesReady
      .then(() => document.fonts.ready)
      .then(() => { if (!cancelled) continueRender(handle); });
    return () => { cancelled = true; };
  }, [handle]);
}

export const CaptionTrack: React.FC<CaptionTrackProps> = ({ words, settings, background }) => {
  const { fps, width, height } = useVideoConfig();
  useFontsReady();

  const resolved: Settings = { ...defaults, ...settings };
  const treatment = treatmentFor(resolved.template);
  const layout = treatment.layout;
  const perPage = captionWordsPerPage(resolved.template, resolved.wordsPerLine);
  // Lockups built around a hero always promote one; row layouts only do it when
  // a word earns it, so the quieter templates stay quiet.
  const alwaysPromote = layout !== 'rows';
  const pages = useMemo(
    () => buildPages(words ?? [], perPage, { alwaysPromote, autoHighlight: resolved.autoHighlight !== false }),
    [words, perPage, alwaysPromote, resolved.autoHighlight],
  );

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
