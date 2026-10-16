/**
 * Writes every public page's HTML after the client build: the home page into
 * dist/index.html, each SEO page into dist/<slug>.html (vercel.json rewrites
 * /<slug> to it). Search engines and link previews get the full text, title,
 * description, canonical and structured data without running JavaScript.
 * Reads the SSR bundle built by `vite build --ssr src/landing/ssr.tsx`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ssrDir = path.join(root, '.ssr-landing');
const entry = fs.readdirSync(ssrDir).find(f => /^ssr\.(m?js)$/.test(f));
if (!entry) throw new Error('prerender: SSR bundle not found in .ssr-landing');
const { paths, renderPage, metaFor, structuredData } = await import(pathToFileURL(path.join(ssrDir, entry)).href);

const template = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
if (!template.includes('<!--landing-html-->')) throw new Error('prerender: placeholder missing from dist/index.html');

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** Replace one tag's attribute value, failing loudly if the tag is missing. */
function setAttr(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`prerender: ${pattern} not found in index.html`);
  return html.replace(pattern, (_m, before, _old, after) => `${before}${esc(value)}${after}`);
}

for (const p of paths) {
  const meta = metaFor(p);
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`);
  html = setAttr(html, /(<meta name="description" content=")([^"]*)(")/, meta.description);
  html = setAttr(html, /(<link rel="canonical" href=")([^"]*)(")/, meta.canonical);
  html = html.replace(/(<link rel="alternate" hreflang="[^"]+" href=")([^"]*)(")/g, (_m, a, _o, c) => `${a}${meta.canonical}${c}`);
  html = setAttr(html, /(<meta property="og:url" content=")([^"]*)(")/, meta.canonical);
  // The home page keeps its hand-written share copy; the others share their own title.
  if (p !== '/') {
    html = setAttr(html, /(<meta property="og:title" content=")([^"]*)(")/, meta.title);
    html = setAttr(html, /(<meta property="og:description" content=")([^"]*)(")/, meta.description);
    html = setAttr(html, /(<meta name="twitter:title" content=")([^"]*)(")/, meta.title);
    html = setAttr(html, /(<meta name="twitter:description" content=")([^"]*)(")/, meta.description);
    html = setAttr(html, /(<meta property="og:image" content=")([^"]*)(")/, meta.image);
    html = setAttr(html, /(<meta name="twitter:image" content=")([^"]*)(")/, meta.image);
    if (meta.imageAlt) html = setAttr(html, /(<meta property="og:image:alt" content=")([^"]*)(")/, meta.imageAlt);
  }
  const body = renderPage(p);
  html = html.replace('<!--landing-html-->', body).replace('<!--landing-jsonld-->', structuredData(p).replace(/</g, '\\u003c'));
  const out = p === '/' ? 'index.html' : `${p.slice(1)}.html`;
  fs.writeFileSync(path.join(root, 'dist', out), html);
  console.log(`prerender: ${p} -> dist/${out} (${(body.length / 1024).toFixed(1)} KB)`);
}
fs.rmSync(ssrDir, { recursive: true, force: true });
