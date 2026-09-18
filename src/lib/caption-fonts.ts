import bundledFonts from './caption-fonts.json';

export type CaptionFont = {
  family: string;
  label: string;
  devanagari: boolean;
  note: string;
};

/**
 * The faces offered in the caption font picker.
 *
 * caption-fonts.json is the shipped list: every family in it is bundled into
 * the Remotion build, because the headless renderer cannot reach the browser's
 * fonts and anything missing falls back silently, so the export stops matching
 * the preview. server/app.py reads the same file.
 *
 * DEV_ONLY_FONTS are additions for trying a face out locally. They are gated on
 * import.meta.env.DEV, which Vite replaces with a literal at build time, so the
 * branch and the font files it pulls in are dropped from a production bundle
 * rather than merely hidden.
 *
 * Satoshi is here rather than in the JSON because of its licence. The ITF Free
 * Font License permits the licensee's own use in any medium, and separately
 * forbids making the font "available as a selectable font for third-party users
 * to create, edit, customize or generate their own content" through a design
 * tool — which is precisely what the caption picker is. Evaluating it on this
 * machine is the licensee's own use; shipping it to bol-studio.me would not be.
 */
const DEV_ONLY_FONTS: CaptionFont[] = [
  { family: 'Satoshi', label: 'Satoshi (local only)', devanagari: false, note: 'Not licensed to ship' },
];

if (import.meta.env.DEV) {
  void import('../fonts/satoshi.css');
}

export const captionFonts: CaptionFont[] = import.meta.env.DEV
  ? [...(bundledFonts as CaptionFont[]), ...DEV_ONLY_FONTS]
  : (bundledFonts as CaptionFont[]);
