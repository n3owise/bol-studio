/** Constants describing the editor shell itself, rather than any one project. */

/** Save-state label. Compared by identity elsewhere, so it lives in one place. */
export const UNSAVED = 'Unsaved changes';

export type NavPanelId = 'caption' | 'media' | 'text' | 'style' | 'settings';


/**
 * What /api/health reports about the worker behind the editor.
 *
 * Only the status dot in the nav rail ever read this, and it read nothing but
 * "did the request succeed" — so which recogniser was loaded, whether its model
 * was actually on disk, and whether ffmpeg existed were all being fetched every
 * seven seconds and discarded. Those three answer most of "why did that go
 * wrong", which is why the Settings panel now shows them.
 *
 * `backend`, not `engine`: the editor's own copy of this type called it engine,
 * which is not a key the server sends, so it was always undefined.
 */
export type Health = {
  status?: string;
  backend?: string;
  model?: string;
  available?: boolean;
  ffmpeg?: boolean;
  [key: string]: unknown;
};
