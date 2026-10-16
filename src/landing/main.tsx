import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './landing.css';
import { PublicPage } from './App';
import { STUDIO_URL } from './content';

/**
 * Sign-up confirmations and password resets still redirect to the site root,
 * because that is the address Supabase was told about. The landing page is not
 * the place that finishes them, so pass the whole callback on to the studio.
 */
const { search, hash } = window.location;
const isAuthCallback = /(?:^|[#&])(access_token|refresh_token|error_description|type=recovery|type=signup)/.test(hash)
  || /(?:^|[?&])(code|token_hash|error_description)=/.test(search);

if (isAuthCallback) {
  window.location.replace(STUDIO_URL + search + hash);
} else {
  const root = document.getElementById('root')!;
  // Hydrate the HTML written at build time; in dev there is none, so render.
  const page = <PublicPage path={window.location.pathname} />;
  if (root.firstElementChild) hydrateRoot(root, page);
  else createRoot(root).render(page);
  (window as unknown as { __lpReady?: boolean }).__lpReady = true;

  // The backdrop's glow follows the pointer.
  window.addEventListener('pointermove', e => {
    const el = document.querySelector<HTMLElement>('.lp'); if (!el) return;
    el.style.setProperty('--cx', `${e.clientX}px`);
    el.style.setProperty('--cy', `${e.clientY}px`);
  }, { passive: true });
}
