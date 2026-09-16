import captionDefaults from './caption-defaults.json';
export type Word = { id: string; text: string; original: string; start: number; end: number; confidence: number; confidenceApproximate?: boolean; emphasis: boolean; emphasisScore: number; spotlight?: boolean; behind?: boolean; fromGlossary?: boolean;
  /**
   * The creator's own line decision, overriding the clause breaker.
   *
   * `true` always ends a page after this word, `false` never does, and
   * undefined leaves it to `breakSegment`. The editor used to express this by
   * appending a full stop to the word and squeezing the following timings;
   * that put punctuation the speaker never said into the caption, corrupted
   * the timings it touched, and could not be told apart from a full stop the
   * recogniser produced on its own.
   */
  lineBreak?: boolean;
  /** An emoji the recogniser matched to this word, and how sure it was. */
  emoji?: string;
  emojiScore?: number };
export type Settings = {
  template: string;
  accent: string;
  fontSize: number;
  position: number;
  positionX?: number;
  wordsPerLine: number;
  uppercase: boolean;
  motion: number;
  aspect: 'original' | '9:16' | '1:1' | '16:9';
  fontFamily?: string;
  textColor?: string;
  /**
   * Third line colour for stacked lockups. Premiere composition 2 drives its
   * three lines from three separate Color Control effects; this is the third.
   */
  accentSecondary?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  align?: 'left' | 'center' | 'right';
  showSafeArea?: boolean;
  /**
   * Whether the app picks a word to enlarge on each line. Default on.
   *
   * Off, captions read evenly — every word the same size and colour — unless
   * the creator highlights one by hand. The emphasis is what a reel is for and
   * what a lecture does not want, so it is a choice rather than a fixed style.
   */
  autoHighlight?: boolean;

  /**
   * Typography adjustments, applied on top of whatever the template specifies
   * rather than replacing it.
   *
   * Each template carries deliberate typography — weights per row, tracking,
   * and a separate line height for Devanagari, whose matras collide at Latin
   * spacing. A raw line-height value here would throw all of that away, so
   * these are a multiplier and an offset: 1 and 0 mean "exactly what the
   * template says", and the Devanagari handling survives either way.
   */
  lineHeight?: number;
  /** Extra tracking in em, added to the template's own. */
  letterSpacing?: number;
  /** Forced on when true; when undefined the template decides. */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /**
   * How every caption word is cased. `uppercase` predates this and still works;
   * this wins when both are set.
   */
  textCase?: 'none' | 'upper' | 'lower' | 'sentence' | 'title';
  /**
   * Which app's interface to outline over the preview, so captions do not end
   * up behind it. 'none' is off.
   *
   * This replaces `showSafeArea`, which drew one generic 86% box and had no
   * control anywhere in the interface, so it could never be switched on. The
   * covered regions are not square and differ per app: Reels reserves more of
   * the bottom for its caption block than Shorts does for its title.
   */
  safeArea?: 'none' | 'reels' | 'shorts';
};
export type ExportJob = { id: string; mode: string; resolution?: number; fps?: number; status: string; progress: number; message: string; filename?: string };
export type GreenScreenSettings = {
  enabled: boolean;
  color: string;
  tolerance: number; // 0 - 100
  spillReduction: boolean;
  smoothEdges: boolean;
};
export type MediaAsset = {
  id: string;
  name: string;
  filename: string;
  mediaType: 'video' | 'audio' | 'image';
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  createdAt: string;
  url?: string;
  thumbnailUrl?: string;
  greenScreen?: GreenScreenSettings;
};
export type CanvasVisualElement = {
  id: string;
  assetId: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  scale: number; // default 1.0
  rotation?: number;
  start?: number; // timeline seconds (default 0)
  end?: number; // timeline seconds (default duration)
  greenScreen?: GreenScreenSettings;
  visible?: boolean;
  locked?: boolean;
  zIndex?: number;
};
export type Project = {
  id: string;
  name: string;
  filename: string;
  mediaType: string;
  videoEnabled?: boolean;
  duration: number;
  width: number;
  height: number;
  created: string;
  status: string;
  progress: number;
  message: string;
  words: Word[];
  settings: Settings;
  waveform: number[];
  exports: ExportJob[];
  script: 'roman' | 'native';
  language: 'hi' | 'en' | 'auto';
  model?: string;
  revision: number;
  mediaAssets?: MediaAsset[];
  canvasElements?: CanvasVisualElement[];
  /** Brand names, handles and domains the recogniser cannot know. */
  glossary?: string[];
  /** Strip background music before recognition. Off by default. */
  isolateVocals?: boolean;
  /** Whether the last run matched emoji to words; reused on a re-run. */
  emoji?: boolean;
  /** Whether the last run asked Whisper for English instead of the spoken words. */
  translate?: boolean;
  activeMediaAssetId?: string;
};
/**
 * Canonical caption defaults. server/app.py loads the same JSON file, so a
 * project created by the API and one created in the browser start identical —
 * they used to disagree on template, accent and wordsPerLine.
 */
export const defaults: Settings = captionDefaults as Settings;
export const defaultGreenScreen: GreenScreenSettings = {
  enabled: true,
  color: '#00FF00',
  tolerance: 50,
  spillReduction: true,
  smoothEdges: true,
};
