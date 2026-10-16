import { SITE_URL } from './content';
import type { FaqItem } from './shared';

/**
 * The search-led pages. Each one answers one thing people type into Google,
 * with its own words, examples and FAQ — so they are four pages worth ranking
 * rather than one page said four times. Every claim is something the studio
 * does today; when in doubt, it is left out.
 */

export type KeywordPageContent = {
  path: string;
  /** <title>, kept under ~60 characters. */
  title: string;
  /** Meta description, kept under ~155 characters. */
  description: string;
  eyebrow: string;
  h1: string;
  accent: string[];
  lede: string;
  demo: { template: string; line: string; hero: number; accent?: string; label: string };
  intro: { heading: string; paragraphs: string[] };
  /** `strike` crosses out the left column — only where it really is the wrong version. */
  examples: { heading: string; sub: string; cols: [string, string]; rows: [string, string][]; strike?: boolean };
  steps: { title: string; body: string }[];
  styles: { heading: string; picks: { id: string; why: string }[] };
  tips: { heading: string; items: { title: string; body: string }[] };
  faq: FaqItem[];
  final: { title: string; accent: string[] };
};

export const KEYWORD_PAGES: KeywordPageContent[] = [
  {
    path: '/hinglish-captions',
    title: 'Hinglish Caption Generator for Videos — Bol Studio',
    description: 'Turn speech into Hinglish captions written in Roman Hindi, the way you actually talk. Word-by-word timing, 24 animated styles, export with no watermark.',
    eyebrow: 'Hinglish caption generator',
    h1: 'Hinglish captions, spelled the way you speak.',
    accent: ['speak'],
    lede: 'Most caption tools either translate your Hindi into English or misspell it. Bol writes Hinglish in Roman letters, word for word, and times each word to your voice.',
    demo: { template: 'mogrt-pop', line: 'kya scene hai doston', hero: 2, label: 'A Hinglish caption animating in the Dhamaka style' },
    intro: {
      heading: 'What are Hinglish captions?',
      paragraphs: [
        'Hinglish is how most of India talks online: Hindi and English mixed in one sentence, typed in Roman letters on a phone keyboard. “Aaj ka video bahut special hai” is Hinglish. So is “ye trick koi nahi batayega”.',
        'Hinglish captions write those words exactly as they were said, in the same Roman script your audience already reads in comments and DMs. Not a translation into English, and not a guess at the spelling — the words you said, timed to the moment you said them.',
        'Generic auto-captions are built for one language at a time. Give them Hinglish and they either translate it (“what’s the scene”) or spell it as if it were English (“kya seen he”). Bol is built for mixed speech from the start.',
      ],
    },
    examples: {
      heading: 'What you say, what Bol writes.',
      sub: 'Compared with the kind of output a generic, English-first caption tool tends to give.',
      cols: ['A generic tool', 'Bol Studio'],
      strike: true,
      rows: [
        ['kya seen he', 'kya scene hai'],
        ['yar ye caption to kamal he', 'yaar ye captions toh kamaal hai'],
        ['subscribe karna mat bhul na', 'subscribe karna mat bhoolna'],
        ['comment me batao kesa laga', 'comment mein batao kaisa laga'],
      ],
    },
    steps: [
      { title: 'Upload your clip', body: 'MP4, MOV, WebM, AVI or MKV video, or MP3, WAV or M4A audio, up to 1 GB.' },
      { title: 'Choose Hinglish', body: 'In Caption setup, pick Hinglish. Bol transcribes word by word in Roman Hindi and times every word.' },
      { title: 'Fix anything in seconds', body: 'Retype a word, split or merge lines, or use search and replace to fix a name everywhere at once.' },
      { title: 'Style and export', body: 'Pick one of 24 animated templates and export an MP4 up to 4K at 60 fps, or SRT and VTT subtitle files.' },
    ],
    styles: {
      heading: 'Styles that suit Hinglish.',
      picks: [
        { id: 'mogrt-rise', why: 'Bold words rising one by one — easy to read on a small screen.' },
        { id: 'karaoke', why: 'A smooth highlight that follows your voice word by word.' },
        { id: 'mumbai', why: 'Condensed caps with a handwritten line, made for punchy talk.' },
      ],
    },
    tips: {
      heading: 'Writing Hinglish captions people read to the end.',
      items: [
        { title: 'Spell it the way your audience types', body: '“yaar”, “kaisa”, “bhoolna” — the spellings people use in comments feel natural on screen. Edit any word Bol writes in one tap.' },
        { title: 'Keep lines short', body: 'Two to four words per line keeps pace with speech. Bol breaks lines at natural pauses; you can split or join them by hand.' },
        { title: 'Highlight one word per line', body: 'One highlighted word — the punchline — pulls the eye. Bol picks one automatically and you can choose another.' },
      ],
    },
    faq: [
      { q: 'What is a Hinglish caption generator?', a: 'It is a tool that listens to a video where people mix Hindi and English, and writes the speech as captions in Roman letters — the way people type Hinglish on their phones. Bol Studio does this word by word, with timing for every word.' },
      { q: 'Does Bol translate my Hindi into English?', a: 'No. With Hinglish selected, Bol writes the words you said in Roman Hindi. It does not translate them. If you want Devanagari script, choose Hindi instead.' },
      { q: 'Can I fix spellings Bol gets wrong?', a: 'Yes. Click any word to retype it, or use search and replace to change a word or name everywhere in the video at once.' },
      { q: 'Can I export Hinglish subtitles as an SRT file?', a: 'Yes. Download SRT or VTT subtitle files, or plain text, JSON and CSV, as well as a captioned MP4.' },
      { q: 'Is there a watermark on exported videos?', a: 'No. Videos exported from Bol Studio have no watermark.' },
    ],
    final: { title: 'Say it your way. Caption it your way.', accent: ['your'] },
  },
  {
    path: '/hindi-subtitles',
    title: 'Add Hindi Subtitles to Video in Devanagari — Bol Studio',
    description: 'Add Hindi subtitles to any video in Devanagari script, with word-level timing and animated styles. Export a captioned MP4 or SRT and VTT files.',
    eyebrow: 'Hindi subtitle maker',
    h1: 'Hindi subtitles in Devanagari, timed to every word.',
    accent: ['Devanagari'],
    lede: 'Upload a video in Hindi and get subtitles in proper Devanagari script — or in Roman Hindi if your audience prefers it. Every word is timed, every line is editable.',
    demo: { template: 'mogrt-rise', line: 'आज का वीडियो शुरू करते हैं', hero: 2, label: 'A Hindi subtitle in Devanagari animating in the Udaan style' },
    intro: {
      heading: 'Hindi subtitles that read like Hindi.',
      paragraphs: [
        'Hindi viewers read Devanagari faster than any transliteration. Subtitles in “आज का वीडियो” feel native; the same line in an awkward Roman spelling makes people work to follow you.',
        'Bol Studio writes Hindi speech in Devanagari when you choose Hindi, and in Roman letters when you choose Hinglish — the same video, two scripts, depending on who you are making it for.',
        'Every caption font on the caption track falls back to a Devanagari typeface, so matras and conjuncts render properly instead of dropping to a system font halfway through a word.',
      ],
    },
    examples: {
      heading: 'One line, the script you choose.',
      sub: 'The same spoken sentence, written for two audiences.',
      cols: ['Hindi (Devanagari)', 'Hinglish (Roman)'],
      rows: [
        ['आज का वीडियो शुरू करते हैं', 'aaj ka video shuru karte hain'],
        ['ये ट्रिक कोई नहीं बताएगा', 'ye trick koi nahi batayega'],
        ['कमेंट में बताओ कैसा लगा', 'comment mein batao kaisa laga'],
        ['इसको लास्ट तक ज़रूर देखना', 'isko last tak zaroor dekhna'],
      ],
    },
    steps: [
      { title: 'Upload the video', body: 'Drop in your Hindi video or audio — MP4, MOV, WebM, MP3, WAV and more, up to 1 GB.' },
      { title: 'Pick Hindi', body: 'Choose Hindi in Caption setup for Devanagari, or Hinglish for Roman letters.' },
      { title: 'Review word by word', body: 'Every word sits on the timeline. Retype, re-time or move any word to another line.' },
      { title: 'Export', body: 'Burn the subtitles into an MP4 up to 4K, or download SRT and VTT files for YouTube and other players.' },
    ],
    styles: {
      heading: 'Styles that carry Devanagari well.',
      picks: [
        { id: 'editorial', why: 'Clean, calm type that lets longer Hindi lines breathe.' },
        { id: 'soft-focus', why: 'A quiet serif look for storytelling, poetry and podcasts.' },
        { id: 'bubble-highlight', why: 'Soft coloured pills behind key words — clear on busy footage.' },
      ],
    },
    tips: {
      heading: 'Getting Hindi subtitles right.',
      items: [
        { title: 'Pick the script for your audience', body: 'Devanagari for Hindi-first audiences; Roman Hindi for viewers who mostly type in English letters. You can switch per project.' },
        { title: 'Check names and spellings', body: 'Proper nouns are where any transcription slips. Search and replace fixes a name across the whole video at once.' },
        { title: 'Use files for long uploads', body: 'For long YouTube videos, upload an SRT or VTT file so viewers can switch subtitles on and off.' },
      ],
    },
    faq: [
      { q: 'How do I add Hindi subtitles to a video?', a: 'Upload the video to Bol Studio, choose Hindi in Caption setup, review the words on the timeline, then export a subtitled MP4 or download an SRT or VTT file.' },
      { q: 'Can the subtitles be in Devanagari script?', a: 'Yes. Choosing Hindi writes the subtitles in Devanagari. Choosing Hinglish writes the same speech in Roman letters.' },
      { q: 'Will Devanagari display correctly in every caption style?', a: 'Every caption style falls back to a Devanagari typeface, so Hindi words render with the right shapes rather than a mismatched system font.' },
      { q: 'Can I get an SRT file of Hindi subtitles?', a: 'Yes. Download SRT or VTT subtitle files, plus TXT, JSON with word timings, and CSV.' },
      { q: 'Can I edit the timing of a word?', a: 'Yes. Drag a word’s edges on the timeline to re-time it, or nudge it in small steps.' },
    ],
    final: { title: 'Hindi subtitles your viewers can actually read.', accent: ['actually'] },
  },
  {
    path: '/reels-captions',
    title: 'Captions for Instagram Reels in Hinglish — Bol Studio',
    description: 'Add animated captions to Instagram Reels in Hinglish, Hindi or English. 9:16 framing, Reels safe-area guides, 24 styles, export with no watermark.',
    eyebrow: 'Captions for Instagram Reels',
    h1: 'Reels captions that keep people watching.',
    accent: ['watching'],
    lede: 'Many people scroll Reels with the sound off. Bold, animated captions in your own language tell them what you are saying before they decide to swipe.',
    demo: { template: 'kinetic', line: 'ruko zara ye dekho', hero: 3, label: 'A Reels caption animating in the Bawaal style' },
    intro: {
      heading: 'Why Reels need captions.',
      paragraphs: [
        'A Reel gets a second or two to earn the next swipe. Without sound, there is nothing to hold someone but what is on screen — and spoken words are usually the best thing you have.',
        'Captions also make your Reel accessible to people who cannot hear it, and they make the same clip work in a quiet office, on a train, or late at night.',
        'Bol frames your video in 9:16, shows where the Reels interface will sit over it, and animates your words in styles made for a phone-sized screen.',
      ],
    },
    examples: {
      heading: 'Built for the Reels screen.',
      sub: 'What Bol handles so your captions survive the trip to Instagram.',
      cols: ['The problem', 'What Bol does'],
      rows: [
        ['Captions hidden behind the caption text and audio strip', 'Reels safe-area guides show the covered zones while you edit'],
        ['Landscape footage in a vertical feed', 'Reframe to 9:16 — captions keep their place as a percentage'],
        ['Small text nobody reads', '24 animated templates sized for a phone screen'],
        ['Watermarks on free tools', 'Exports with no watermark'],
      ],
    },
    steps: [
      { title: 'Upload the Reel', body: 'Drop in the clip you shot — portrait or landscape.' },
      { title: 'Frame it 9:16', body: 'Choose the 9:16 frame and turn on the Reels safe-area guide.' },
      { title: 'Pick a style', body: 'Choose an animated template and let Bol highlight the punchline word on every line.' },
      { title: 'Export and post', body: 'Export an MP4 up to 4K at 60 fps and upload it straight to Instagram.' },
    ],
    styles: {
      heading: 'Styles made for Reels.',
      picks: [
        { id: 'kinetic', why: 'One word at a time, full screen — the loudest hook there is.' },
        { id: 'mogrt-pop', why: 'Words punch in with a spring. Great for fast talking-head Reels.' },
        { id: 'editing-school', why: 'A bright badge card per word, built for list and tip videos.' },
      ],
    },
    tips: {
      heading: 'Caption tips for Reels.',
      items: [
        { title: 'Keep captions in the middle band', body: 'The top holds the Reels header; the bottom holds your caption text and audio strip. Keep captions between them — the safe-area guide shows where.' },
        { title: 'Lead with the hook', body: 'The first line decides whether people stay. Make it short and highlight the word that matters.' },
        { title: 'Match the style to the energy', body: 'Bouncy styles for comedy and hauls, calm serif styles for stories and advice.' },
      ],
    },
    faq: [
      { q: 'How do I add captions to Instagram Reels?', a: 'Upload your Reel to Bol Studio, choose the language, pick a caption style, then export a 9:16 MP4 and post it to Instagram.' },
      { q: 'Where should captions sit on a Reel?', a: 'In the middle band of the frame, clear of the Reels header at the top and the caption text, audio strip and buttons at the bottom and right. Bol’s Reels safe-area guide shows those zones while you edit.' },
      { q: 'Can I caption a landscape video for Reels?', a: 'Yes. Reframe it to 9:16 in the studio. Captions are positioned as a percentage of the frame, so they stay where you put them.' },
      { q: 'Do Reels captions from Bol have a watermark?', a: 'No. Exported videos have no watermark.' },
      { q: 'Can I use the same captions for YouTube Shorts?', a: 'Yes. Shorts are also 9:16, and Bol has a Shorts safe-area guide too.' },
    ],
    final: { title: 'Make your next Reel impossible to scroll past.', accent: ['impossible'] },
  },
  {
    path: '/youtube-shorts-subtitles',
    title: 'Subtitles for YouTube Shorts and Videos — Bol Studio',
    description: 'Add subtitles to YouTube Shorts in Hinglish, Hindi or English: burned-in animated captions for Shorts, or SRT and VTT files for regular videos.',
    eyebrow: 'Subtitles for YouTube',
    h1: 'Subtitles for Shorts, and files for everything else.',
    accent: ['Shorts'],
    lede: 'Burn animated captions into your Shorts, or download SRT and VTT files to upload alongside your regular YouTube videos — from the same transcript.',
    demo: { template: 'welcome-stack', line: 'is video mein seekhenge', hero: 2, label: 'A YouTube Shorts subtitle animating in the Hero Entry style' },
    intro: {
      heading: 'Two kinds of YouTube subtitles.',
      paragraphs: [
        'Shorts play in a vertical feed, often with the sound off. Subtitles burned into the video — big, animated, and part of the picture — are what stops the scroll there.',
        'Regular YouTube videos are different. Viewers expect to switch subtitles on and off, so YouTube takes a separate subtitle file you upload alongside the video.',
        'Bol gives you both from one transcript: an animated MP4 for Shorts, and SRT or VTT files for your long videos. Fix a word once and it is fixed in both.',
      ],
    },
    examples: {
      heading: 'Which export to use.',
      sub: 'Pick by where the video is going.',
      cols: ['Where it is going', 'What to export'],
      rows: [
        ['YouTube Shorts (9:16)', 'Burned-in animated captions as an MP4'],
        ['Regular YouTube video (16:9)', 'An SRT or VTT file, uploaded under Subtitles'],
        ['Editing further in your own editor', 'A green-screen caption layer to key over your footage'],
        ['Blog, show notes or a script', 'Plain text, or JSON and CSV with word timings'],
      ],
    },
    steps: [
      { title: 'Upload the video', body: 'Upload a Short or a longer cut — up to 1 GB per file.' },
      { title: 'Choose the language', body: 'Hinglish in Roman letters, Hindi in Devanagari, or English.' },
      { title: 'Review the transcript', body: 'Fix any word on the timeline; search and replace handles names across the whole video.' },
      { title: 'Export for where it goes', body: 'An animated 9:16 MP4 for Shorts, or SRT and VTT files for regular videos.' },
    ],
    styles: {
      heading: 'Styles that work on Shorts.',
      picks: [
        { id: 'welcome-stack', why: 'A three-tier lockup with a glowing hero word in the middle.' },
        { id: 'neon', why: 'A glow that holds up against dark, moody footage.' },
        { id: 'pop-up', why: 'The highlighted word jumps onto the screen — perfect for reactions.' },
      ],
    },
    tips: {
      heading: 'Subtitle tips for YouTube.',
      items: [
        { title: 'Shorts: keep clear of the title', body: 'The Shorts title and buttons cover the bottom and right edge. Bol’s Shorts safe-area guide shows where not to put captions.' },
        { title: 'Long videos: upload a file', body: 'In YouTube Studio, open the video, go to Subtitles and upload the SRT or VTT from Bol. Viewers can then turn them on or off.' },
        { title: 'One transcript, every format', body: 'Edit the words once in Bol, then export the MP4 and the subtitle files from the same project.' },
      ],
    },
    faq: [
      { q: 'How do I add subtitles to YouTube Shorts?', a: 'Upload the Short to Bol Studio, pick a language and caption style, then export a 9:16 MP4 with the captions burned in and upload it to YouTube.' },
      { q: 'How do I add subtitles to a regular YouTube video?', a: 'Download an SRT or VTT file from Bol Studio, then in YouTube Studio open the video, go to Subtitles and upload the file.' },
      { q: 'Should I burn in subtitles or upload a file?', a: 'For Shorts, burn them in — they are part of the look and work with the sound off. For regular videos, upload a file so viewers can switch subtitles on and off.' },
      { q: 'Can YouTube subtitles be in Hinglish?', a: 'Yes. Choose Hinglish to write the speech in Roman Hindi, or Hindi for Devanagari.' },
      { q: 'Can I export at 4K?', a: 'Yes. Captioned videos export at 720p, 1080p or 4K, at up to 60 fps.' },
    ],
    final: { title: 'Every video, subtitled. Every way YouTube wants it.', accent: ['Every'] },
  },
];

export const STYLES_PAGE = {
  path: '/caption-styles',
  title: 'Animated Caption Styles for Reels & Shorts — Bol Studio',
  description: 'Browse all 24 animated caption templates in Bol Studio, playing live — Udaan, Dhamaka, Bawaal and more, for Reels, Shorts and YouTube.',
};

/** Every public page, for the prerender, the client router and the sitemap. */
export const PUBLIC_PATHS = ['/', ...KEYWORD_PAGES.map(p => p.path), STYLES_PAGE.path];
export const canonicalFor = (path: string) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`);
