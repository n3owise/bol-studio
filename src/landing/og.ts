import type { OgCardProps } from './remotion/TemplateLoop';

/**
 * Each public page's link preview. The home page keeps public/og-image.jpg;
 * every other page gets its own card in public/og/<slug>.jpg, rendered by
 * `npx tsx scripts/render-og.ts` and referenced by metaFor.
 */
export const OG_CARDS: Record<string, OgCardProps & { alt: string }> = {
  '/hinglish-captions': {
    lead: 'Hinglish captions, spelled the way you', mark: 'speak.', fontSize: 68,
    sub: 'Roman Hindi, timed word by word', phone: ['bilkul', 'SAHI', 'spelling'],
    alt: 'Bol Studio: Hinglish captions, spelled the way you speak',
  },
  '/hindi-subtitles': {
    lead: 'Hindi subtitles in', mark: 'Devanagari.', fontSize: 72,
    sub: 'Timed to every word, ready for Reels & YouTube', phone: ['har', 'SHABD', 'timed'],
    alt: 'Bol Studio: Hindi subtitles in Devanagari',
  },
  '/reels-captions': {
    lead: 'Reels captions that keep people', mark: 'watching.', fontSize: 72,
    sub: 'Animated captions for Instagram Reels', phone: ['scroll', 'ROKO', 'zara'],
    alt: 'Bol Studio: Reels captions that keep people watching',
  },
  '/youtube-shorts-subtitles': {
    lead: 'Subtitles for YouTube', mark: 'Shorts.',
    sub: 'Burned-in captions, plus SRT and VTT files', phone: ['full', 'VIRAL', 'energy'],
    alt: 'Bol Studio: subtitles for YouTube Shorts',
  },
  '/caption-styles': {
    lead: '24 animated caption', mark: 'styles.',
    sub: 'Pick one, play it live, export it', phone: ['pick', 'YOUR', 'vibe'],
    alt: 'Bol Studio: 24 animated caption styles',
  },
};

export const ogImageFor = (path: string) => (OG_CARDS[path] ? `/og${path}.jpg` : '/og-image.jpg');
