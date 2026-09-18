/**
 * Register faces that live in public/ rather than in the bundle.
 *
 * Done with the FontFace API rather than a CSS `@font-face` with `url()`. The
 * editor is built by Vite, which leaves an absolute URL alone and serves it from
 * public/; the export renderer is built by webpack, which tries to *resolve* one
 * as a module and fails the build outright when the file is absent — which it is
 * in any clone, because these faces are gitignored. A runtime URL is invisible
 * to both bundlers, so a missing file degrades to a rejected promise rather than
 * a broken build.
 *
 * The URL itself comes from staticFile() because the two disagree about where
 * public/ lives: Vite serves it at the root, Remotion copies it into the bundle
 * and serves it under /public. Hard-coding either one 404s in the other, and a
 * 404 here is silent — every frame simply renders in a fallback face.
 */
import { staticFile } from 'remotion';

const WEIGHTS: { file: string; weight: number; style: 'normal' | 'italic' }[] = [
  { file: 'Satoshi-Regular', weight: 400, style: 'normal' },
  { file: 'Satoshi-Italic', weight: 400, style: 'italic' },
  { file: 'Satoshi-Medium', weight: 500, style: 'normal' },
  { file: 'Satoshi-MediumItalic', weight: 500, style: 'italic' },
  { file: 'Satoshi-Bold', weight: 700, style: 'normal' },
  { file: 'Satoshi-BoldItalic', weight: 700, style: 'italic' },
  { file: 'Satoshi-Black', weight: 900, style: 'normal' },
  { file: 'Satoshi-BlackItalic', weight: 900, style: 'italic' },
];

let registered = false;

/**
 * Load the local-only faces, once.
 *
 * The returned promise is what the renderer waits on: Remotion blocks its first
 * frame until `document.fonts.ready`, and a face still loading at that moment
 * renders in a fallback — the silent mismatch between preview and export that
 * bundling every offered family is meant to prevent.
 */
export function registerLocalFaces(): Promise<void> {
  if (registered || typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return Promise.resolve();
  }
  registered = true;
  return Promise.all(WEIGHTS.map(async ({ file, weight, style }) => {
    try {
      const url = staticFile(`fonts/satoshi/${file}.woff2`);
      const face = new FontFace('Satoshi', `url(${url}) format('woff2')`, {
        weight: String(weight),
        style,
        display: 'block',
      });
      document.fonts.add(await face.load());
    } catch {
      // Absent in a clone, and absent is the correct state there. The family is
      // not offered either, so nothing asks for it and nothing looks wrong.
    }
  })).then(() => undefined);
}
