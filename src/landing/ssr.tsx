import React from 'react';
import { renderToString } from 'react-dom/server';
import { LandingPage } from './LandingPage';
import { FAQ, SITE_URL } from './content';

/** The landing page as static HTML, injected into dist/index.html at build time. */
export function renderLanding(): string {
  return renderToString(<LandingPage />);
}

/** Structured data for search engines, built from the same FAQ the page shows. */
export function structuredData(): string {
  const graph = [
    {
      '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'Bol Studio', url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`, email: 'hello@bol-studio.me',
    },
    {
      '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Bol Studio',
      alternateName: ['bol.studio', 'Bol'], publisher: { '@id': `${SITE_URL}/#org` }, inLanguage: 'en-IN',
    },
    {
      '@type': 'WebApplication', name: 'Bol Studio', url: SITE_URL, applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser', browserRequirements: 'Requires JavaScript',
      description: 'Animated Hinglish, Hindi and English captions and subtitles for Instagram Reels, YouTube Shorts and videos.',
      image: `${SITE_URL}/og-image.jpg`, publisher: { '@id': `${SITE_URL}/#org` },
      featureList: [
        'Hinglish (Roman Hindi), Hindi (Devanagari) and English transcription',
        'Word-level caption timing', '24 animated caption templates',
        'Export up to 4K at 60 fps without a watermark', 'SRT, VTT, TXT, JSON and CSV subtitle export',
        'Green-screen caption layer export',
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
