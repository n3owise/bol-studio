/**
 * Renders each public page's link preview into public/og/<slug>.jpg from the
 * OgCard composition. Run after changing src/landing/og.ts:
 *   npx tsx scripts/render-og.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { OG_CARDS } from '../src/landing/og';

fs.mkdirSync('public/og', { recursive: true });
for (const [path, { alt: _alt, ...props }] of Object.entries(OG_CARDS)) {
  const out = `public/og${path}.jpg`;
  execFileSync('npx', ['remotion', 'still', 'src/landing/remotion/index.ts', 'OgCard', out,
    `--props=${JSON.stringify(props)}`, '--frame=59', '--image-format=jpeg', '--jpeg-quality=88'], { stdio: 'inherit' });
}
