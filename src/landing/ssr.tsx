import React from 'react';
import { OG_CARDS, ogImageFor } from './og';
import { renderToString } from 'react-dom/server';
import { PublicPage, normalisePath } from './App';
import { FAQ, SITE_URL } from './content';
import { KEYWORD_PAGES, PUBLIC_PATHS, STYLES_PAGE, canonicalFor } from './pages';
import { STYLES_FAQ } from './StylesPage';

/** Every public path the build writes an HTML file for. */
export const paths = PUBLIC_PATHS;

/** A public page as static HTML, injected into its HTML file at build time. */
export function renderPage(path: string): string {
  return renderToString(<PublicPage path={path} />);
}

const HOME_META = {
  title: 'Bol Studio — Hinglish Captions & Hindi Subtitles for Reels and Shorts',
  description: 'Add animated Hinglish, Hindi and English captions to Instagram Reels, YouTube Shorts and videos. Word-perfect timing, 24 caption styles, export up to 4K with no watermark.',
};

/** Title, description and canonical URL for a path. */
export function metaFor(path: string) {
  const p = normalisePath(path);
  const kw = KEYWORD_PAGES.find(k => k.path === p);
  const base = kw ?? (p === STYLES_PAGE.path ? STYLES_PAGE : HOME_META);
  const og = OG_CARDS[p];
  return {
    title: base.title, description: base.description, canonical: canonicalFor(p),
    image: `${SITE_URL}${ogImageFor(p)}`, imageAlt: og?.alt,
  };
}

const org = {
  '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'Bol Studio', url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`, email: 'hello@bol-studio.me',
};
const faqPage = (items: { q: string; a: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: items.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
});

/** Structured data for a path, built from the same FAQ the page shows. */
export function structuredData(path: string): string {
  const p = normalisePath(path);
  const meta = metaFor(p);
  let graph: object[];
  if (p === '/') {
    graph = [
      org,
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
      faqPage(FAQ),
    ];
  } else {
    const kw = KEYWORD_PAGES.find(k => k.path === p);
    const name = kw ? kw.h1 : 'Animated caption styles';
    graph = [
      org,
      {
        '@type': 'WebPage', '@id': `${meta.canonical}#page`, url: meta.canonical, name: meta.title, description: meta.description,
        isPartOf: { '@id': `${SITE_URL}/#website` }, publisher: { '@id': `${SITE_URL}/#org` }, inLanguage: 'en-IN',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Bol Studio', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name, item: meta.canonical },
        ],
      },
      faqPage(kw ? kw.faq : STYLES_FAQ),
    ];
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
