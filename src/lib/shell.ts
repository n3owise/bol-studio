/** Constants describing the editor shell itself, rather than any one project. */

/** Save-state label. Compared by identity elsewhere, so it lives in one place. */
export const UNSAVED = 'Unsaved changes';

export type NavPanelId = 'caption' | 'media' | 'text' | 'style' | 'audio' | 'settings';

export const SAMPLE_ITEMS = [
  { title: 'Mountain Ascent', duration: '0:12', thumbnail: '/samples/sample-1.jpg' },
  { title: 'Personal Story', duration: '0:28', thumbnail: '/samples/sample-2.jpg' },
  { title: 'City Skyline', duration: '0:15', thumbnail: '/samples/sample-3.jpg' },
];
