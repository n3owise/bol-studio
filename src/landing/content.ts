/**
 * The landing page's words, kept apart from layout so the FAQ text and the
 * FAQPage structured data in index.html are generated from the same list.
 * Every claim here is something the studio actually does.
 */
export const SITE_URL = 'https://www.bol-studio.me';
export const STUDIO_URL = '/studio';

export const KEYWORDS = [
  'Hinglish captions', 'Hindi subtitles', 'Reels captions', 'YouTube Shorts subtitles', 'Animated captions',
  'Word-by-word highlights', 'Podcast clips', 'Vlogs', 'Roman Hindi', 'Devanagari', 'SRT & VTT export', 'No watermark',
];

export const STEPS = [
  {
    n: '01', title: 'Upload your video',
    body: 'Drop in a Reel, a Short or a long YouTube cut. MP4, MOV, WebM and audio files up to 1 GB.',
  },
  {
    n: '02', title: 'Pick how it’s written',
    body: 'Hinglish in Roman letters, Hindi in Devanagari, or English. Bol writes the words the way you actually say them.',
  },
  {
    n: '03', title: 'Style it and export',
    body: 'Choose an animated template, highlight the words that matter, and export a captioned video up to 4K at 60 fps.',
  },
];

export const FEATURES = [
  { key: 'hinglish', title: 'Hinglish-first transcription', body: '“kya scene hai” stays “kya scene hai” — not a translation, not a misspelling. Roman Hindi, Devanagari or English, per project.' },
  { key: 'timing', title: 'Word-perfect timing', body: 'Every word carries its own start and end, so captions land on the beat of your speech. Nudge any word on the timeline.' },
  { key: 'highlight', title: 'Highlight the punchline', body: 'Bol picks one word per line to stand out. Tap any other word to make it the hero instead.' },
  { key: 'templates', title: '24 animated templates', body: 'Udaan, Dhamaka, Bawaal and more — motion-designed lockups inspired by pro editing presets, ready in one click.' },
  { key: 'frame', title: 'Every frame shape', body: 'Original, 9:16 for Reels and Shorts, 1:1 for feed, 16:9 for YouTube — captions keep their place when you reframe.' },
  { key: 'export', title: 'Export without a watermark', body: 'Burned-in MP4 up to 4K, a green-screen caption layer for your own editor, or SRT, VTT, TXT, JSON and CSV files.' },
];

export const USE_CASES = [
  { title: 'Reels & Shorts', body: 'Big, bold captions that keep people watching with the sound off.' },
  { title: 'Podcast clips', body: 'Turn long Hinglish conversations into captioned clips people can follow.' },
  { title: 'Tutorials & vlogs', body: 'Clean subtitles in the language your audience speaks every day.' },
  { title: 'Brand & UGC ads', body: 'Highlight the offer word and export in every shape the platforms ask for.' },
];

export const FAQ = [
  {
    q: 'How do I add Hinglish captions to my Instagram Reels?',
    a: 'Upload your Reel to Bol Studio, choose Hinglish as the language, and Bol transcribes it word by word in Roman Hindi. Pick a caption template, adjust any word on the timeline, then export a captioned MP4 in 9:16 ready to post.',
  },
  {
    q: 'What is the difference between Hinglish and Hindi captions?',
    a: 'Hinglish captions write Hindi and English the way people type them on their phones, in Roman letters — “kya baat hai”. Hindi captions use Devanagari script — “क्या बात है”. Bol supports both, plus plain English.',
  },
  {
    q: 'Can Bol Studio make subtitles for YouTube Shorts and long videos?',
    a: 'Yes. Export captions burned into the video for Shorts, or download SRT or VTT subtitle files to upload to YouTube for longer videos.',
  },
  {
    q: 'Does the exported video have a watermark?',
    a: 'No. Videos exported from Bol Studio have no watermark.',
  },
  {
    q: 'Can I edit the words and timing?',
    a: 'Yes. Every word can be retyped, split, merged, moved to another line or re-timed by dragging it on the timeline. Search and replace fixes a name everywhere at once.',
  },
  {
    q: 'Which video formats and sizes are supported?',
    a: 'MP4, MOV, WebM, AVI and MKV video, plus MP3, WAV and M4A audio, up to 1 GB per file. Exports go up to 4K at 60 fps in original, 9:16, 1:1 or 16:9 frames.',
  },
  {
    q: 'Can I use the captions in Premiere Pro, CapCut or Final Cut?',
    a: 'Yes. Export a green-screen caption layer and key it over your footage in any editor, or use the SRT and VTT files.',
  },
];
