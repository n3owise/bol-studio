import bundledFonts from './caption-fonts.json';
import { registerLocalFaces } from '../fonts/local-faces';

export type CaptionFont = {
  family: string;
  label: string;
  devanagari: boolean;
  note: string;
};

/**
 * Whether faces that are licensed for this machine only may be offered.
 *
 * Two environments ask this and they cannot be told apart by one flag. The
 * editor is a Vite build, where `import.meta.env.DEV` becomes a literal. The
 * export renderer is a Remotion bundle built by webpack on whatever machine is
 * running the server — including a deployed one, where nothing about the build
 * says "production" in a way this could read.
 *
 * So the renderer is told explicitly, through an environment variable the
 * server passes to Remotion, and it is the *only* thing the renderer consults.
 * A deployment that does not set BOL_LOCAL_FONTS gets a false here no matter
 * how its bundle was built, which is the direction this has to fail in.
 */
function localFontsEnabled(): boolean {
  // Bundled for Node: the export renderer. Told, never inferred.
  if (typeof process !== 'undefined') {
    return process.env?.BOL_LOCAL_FONTS === '1';
  }
  // Bundled for the browser: the editor. Vite replaces this with a literal, so
  // a production build drops the branch rather than evaluating it.
  return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
}

/**
 * The faces offered in the caption font picker.
 *
 * caption-fonts.json is the shipped list: every family in it is bundled into
 * the Remotion build, because the headless renderer cannot reach the browser's
 * fonts and anything missing falls back silently, so the export stops matching
 * the preview. server/app.py reads the same file.
 *
 * DEV_ONLY_FONTS are additions for trying a face out locally, gated on the
 * above. Satoshi is here rather than in the JSON because of its licence: the
 * ITF Free Font License permits the licensee's own use in any medium, and
 * separately forbids making a font "available as a selectable font for
 * third-party users to create, edit, customize or generate their own content"
 * through a design tool — which is precisely what the caption picker is.
 * Evaluating it on this machine is the first; putting it on bol-studio.me would
 * be the second.

 */
const DEV_ONLY_FONTS: CaptionFont[] = [
  { family: 'Satoshi', label: 'Satoshi (local only)', devanagari: false, note: 'Not licensed to ship' },
];

const localFonts = localFontsEnabled();

/** Resolves once the local-only faces are usable; never rejects. */
export const localFacesReady: Promise<void> = localFonts
  ? registerLocalFaces()
  : Promise.resolve();

export const captionFonts: CaptionFont[] = localFonts
  ? [...(bundledFonts as CaptionFont[]), ...DEV_ONLY_FONTS]
  : (bundledFonts as CaptionFont[]);
