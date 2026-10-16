import React from 'react';
import { LandingPage } from './LandingPage';
import { KeywordPage, keywordPageFor } from './KeywordPage';
import { StylesPage } from './StylesPage';
import { STYLES_PAGE } from './pages';

/** `/reels-captions/`, `/reels-captions.html` and `/reels-captions` are the same page. */
export const normalisePath = (path: string) =>
  (path.length > 1 ? path.replace(/\/+$/, '').replace(/\.html$/, '').replace(/^\/index$/, '/') : path) || '/';

/** Which public page a path renders; anything unknown gets the home page. */
export function PublicPage({ path }: { path: string }) {
  const p = normalisePath(path);
  if (p === STYLES_PAGE.path) return <StylesPage />;
  const kw = keywordPageFor(p);
  if (kw) return <KeywordPage page={kw} />;
  return <LandingPage />;
}
