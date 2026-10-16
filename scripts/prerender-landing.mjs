/**
 * Writes the landing page's HTML into dist/index.html after the client build,
 * so search engines and link previews get the full page text without running
 * JavaScript. Reads the SSR bundle built by `vite build --ssr src/landing/ssr.tsx`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ssrDir = path.join(root, '.ssr-landing');
const entry = fs.readdirSync(ssrDir).find(f => /^ssr\.(m?js)$/.test(f));
if (!entry) throw new Error('prerender: SSR bundle not found in .ssr-landing');
const { renderLanding, structuredData } = await import(pathToFileURL(path.join(ssrDir, entry)).href);

const file = path.join(root, 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');
if (!html.includes('<!--landing-html-->')) throw new Error('prerender: placeholder missing from dist/index.html');
const body = renderLanding();
html = html.replace('<!--landing-html-->', body)
  .replace('<!--landing-jsonld-->', structuredData().replace(/</g, '\\u003c'));
fs.writeFileSync(file, html);
fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerender: wrote ${(body.length / 1024).toFixed(1)} KB of landing HTML into dist/index.html`);
