# Changelog

Notable changes to Bol Studio.

## 0.5.0 — 2026-09-19

The release where the editor was watched rather than reasoned about.

Playing a clip failed in four different ways that all looked like one broken
file, and an interface audit measured the running app rather than reading the
source. Both turned up the same shape of fault: something that presented itself
as working. A play button that silently did nothing. A control that drew itself
as checked and wrote a setting the renderer ignored. Text the same colour as its
background. None of it would have been found by reading the code, and most of it
had been there for weeks.

### Added

- **Fonts licensed for one machine can be tried without shipping them.** The
  caption picker's list is a module now: the faces that ship come from
  `caption-fonts.json`, and anything for local evaluation sits behind a flag
  Vite folds to a literal, so a production build drops the branch and the font
  files it would pull in. The renderer is told separately, by an environment
  variable, because a deployed Space builds its bundle exactly the way a laptop
  does and must not infer permission from that.

### Fixed

- **Playback, four times over.** Each looked like an unplayable file and none
  of them was.

  The player was handed its source before the media token existed, so the first
  request was always refused — and a `<video>` that has been refused stays
  broken until its source changes. Then every `play()` rejection produced the
  same "could not play" sentence, including the harmless one the browser raises
  whenever a pending play is interrupted. Then `playing` was set optimistically
  by one path that swallowed its failure, leaving the state true while the
  element sat paused, so the button called `pause()` on something already paused
  — which does nothing, fires no event to correct itself, and left playback
  stuck with nothing shown at all.

  The last was the one that kept recurring: the upload was remuxed **in place**
  when transcription started, replacing the very bytes the preview was already
  streaming. The browser had cached the old length, its next range request fell
  past the end of the new file, the server answered 416 exactly as the spec
  asks, and the player gave up moments after the captions appeared. The remux
  happens during upload now, before the project is handed back.

- **Text the same colour as its background.** Two rules put text on the green
  accent using `--color-text-inverse`, which is white in the light theme: the
  word being spoken measured 1.7:1 and the badge marking its line 1.08:1. Both
  read as absent rather than dim. Searching for the pattern found **ten more**
  rules making the identical mistake, every one with the correct green already
  written as its unused fallback.

- **Secondary text across the dark theme.** `--color-text-muted` held the same
  value in both themes, which reads at 3.7:1 on a dark panel. Twenty-one
  elements failed their contrast threshold in dark and six in light; both are
  now zero, measured. Nothing sits below 11px any more — ruler labels had run
  to 9px.

- **The timeline showed boxes with no words in them.** Zoom was fixed at 1, so
  a clip was squeezed into the viewport however much speech it held: cells came
  out ten to twenty-eight pixels wide and twenty-one of twenty-two labels were
  clipped, several to nothing. The zoom fits the words now, taken from the
  median word duration — counting words assumes speech is evenly paced and
  lands far short. Eighteen of twenty-two are legible where one was.

- **Template previews drew their sample words in a hardcoded near-black** that
  the dark theme never overrode while swapping the card's background out from
  under them, so every word but the accent-coloured highlight vanished.

- **Targets too small to hit**: the insert-a-word dot was 10px, the line play
  and options buttons 20px, filter pills 23px tall, word chips 24px. All now
  meet 28px.

- A form error on the sign-in screen stayed put while the reader corrected the
  field it was about.

### Changed

- **Caption settings say what they do.** "Show app interface" is "Check against
  Reels or Shorts"; "Words Per Line (Chunking)" has lost the implementation's
  word; "Third line — matches text" reads "Same as text". The position controls
  were split in two by the safe-area overlay sitting between them, and the five
  position presets read as a confused axis rather than the shortcuts they are.
  Three label conventions in one panel are now one.

- The projects list is out of the navbar and the brand mark while how past work
  should be presented is decided. The modal is untouched; this withholds the
  entry point rather than removing the feature.

### Removed

- **An ALL CAPS toggle that did nothing.** It wrote only `uppercase`, while the
  Capitalisation control beside it writes both that and `textCase` — which the
  renderer prefers. Once anyone had touched Capitalisation, the toggle was inert
  while still drawing itself as checked.

- **A PRO badge** on a button that works and gates nothing, promising a tier
  there is no way to buy.

## 0.4.0 — 2026-09-17

Accounts. Until now a project belonged to a random id the browser invented and
kept in local storage, which the code was honest about being separation rather
than authentication: it rode in a header anyone could edit, and clearing site
data lost every project with no way back.

Supabase holds the accounts now. It stores the users, hashes the passwords and
sends the mail; this backend never sees a password. Its only job is to verify an
access token and read the user id out of it, which then becomes the `owner`
string already stored on every project — so nothing about the stored data
changed shape.

**Projects on a deployment that had none of this are unreachable after
upgrading.** They carry no owner, and an unowned project now belongs to nobody
rather than to everybody. `scripts/backfill-owner.py` claims a data directory
for an account on purpose; there is no automatic version, because nothing can
tell whose those projects were.

### Added

- **Sign in, sign up, and password reset.** Confirmation by email is required
  before a new account works. Reset includes the screen that is easy to leave
  out — a reset link signs you in, so without somewhere to type the new password
  you land in the editor with the old one still set.
- **An account menu** in the top bar, and projects that follow the account
  instead of the browser.
- **Signed media URLs.** `<video src>` cannot send headers, so media has always
  carried credentials in the query string. It now carries a signature good for
  one project's media for fifteen minutes and nothing else, rather than an
  access token that is good for an hour and for everything and would end up in
  proxy logs and browser history.
- **A keepalive** for the Supabase project, which a free plan pauses after seven
  days idle. In GitHub Actions rather than the backend: a timer inside an
  ephemeral container dies quietly while still appearing to exist.
- `scripts/backfill-owner.py`, for claiming existing projects.

### Changed

- **`Authorization: Bearer` no longer satisfies the shared API key.** That
  header carries the signed-in user's token now, and one header cannot mean two
  credentials — a key sent that way would pass one gate and fail the other,
  answering a single request with two different 401s. The key keeps `X-API-Key`
  and `?key=`. Breaking for anyone scripting against the API with a bearer
  header.
- Token verification is **ES256 against Supabase's published key set**, not the
  legacy shared secret. That secret also signs service-role tokens, so a copy of
  it in a deployment's environment is a copy of full database access; what this
  holds instead can check signatures and cannot make them.
- Accounts are **off unless configured**, exactly as the API key is. A checkout
  with no Supabase project still runs with no setup at all.

### Fixed

- A form error on the sign-in screen stayed put while the reader corrected the
  field it was about, so "passwords need at least 8 characters" could sit above
  an eighteen-character password.

### Removed

- **The three "Or try a sample" cards on the upload screen.** They showed stock
  photographs captioned Mountain Ascent, Personal Story and City Skyline, with
  durations written into the source. None of it was real: clicking one opened
  the creator's own Nth most recent project — a different clip, a different
  length, behind a picture of a mountain — and with no projects yet, the case
  the cards exist for, it announced "Sample media ready." and did nothing.

## 0.3.0 — 2026-09-17

Captions became something you can style. Most of this release is control that
existed only as a template's opinion being handed over — typography, the size
of the highlighted word, where the block sits in the frame, whether a word is
enlarged at all — plus the deployment work that made the Hugging Face Space
actually run the app rather than a hollowed-out copy of it.

The theme from 0.2.0 continues: several of the fixes below are two parts of
the app that had each grown their own answer to the same question, and the fix
is one of them being deleted.

### Added

- **A Text panel** holding the caption typography: font, size, colour, fill,
  stroke and its weight, background, line height, letter spacing, alignment,
  underline, strikethrough, bold, italic, and buttons for uppercase, lowercase,
  sentence case and title case. Five of these settings were already read by the
  renderer and had no control anywhere, so the only way to change them was to
  edit a project file by hand.
- **A separate size for the highlighted word**, with a link button that holds
  its ratio to the caption size while either moves, and a reset beside each.
  Both sizes used to come from one number scaled by the template, so raising
  the caption size raised the highlight with it and the two could never be set
  apart.
- **Automatic highlighting can be turned off.** Asked as a picture — two
  captions, one with a word enlarged and one without — after the language
  question, and available afterwards in the caption panel. The emphasis is what
  a reel is for and what a lecture does not want, so it is a choice rather than
  a fixed style. A Clear highlights button takes back every highlight at once.
- **Move the captions from the preview.** Hovering the preview reveals a drag
  handle and a bar for alignment and vertical position; dragging snaps to nine
  anchors with a guide line showing which one has it. "This line only" applies
  the position to the caption line on screen rather than the whole project, so
  one line can step around something in the shot without moving the rest.
- **Add a word where one is missing.** Hover a word in the caption panel for a
  `+` on either side, or right-click for a menu. The hover target is reserved
  in the layout rather than inserted on hover, so nothing shifts under the
  pointer as you aim at it.
- **Drop a dragged word between two lines** to make it a line of its own,
  instead of having to drop it into a neighbour and split afterwards.
- **A workspace per browser.** Projects are scoped to the browser that made
  them, so a shared deployment stops showing everyone everyone else's uploads.
- **Disk usage in `/api/limits`**, so the app can say how much room is left
  rather than discovering it during an upload.
- **A model bench** (`scripts/compare-models.py`) that scores transcription
  candidates by word error rate through the app's own pipeline. It is what
  settled that `hi-hinglish-apex` stays: Whisper-turbo translates Hinglish into
  English instead of transcribing it, and the Trelis fine-tune writes Devanagari
  and takes 196s for a 45s clip.

### Changed

- **The timeline and the caption panel now open the same word inspector.**
  Clicking a word used to give two different editors depending on where it was
  clicked — the timeline's with a highlight icon pair, a textarea, an emoji
  affordance that did nothing and save/cancel buttons; the panel's with a field
  that commits on blur, a case menu, split and delete. The timeline gains the
  case menu and split it never had.
- **An upload no longer starts recognition before the creator has been asked.**
  The language question used to arrive after the work it was meant to decide
  had already begun.
- **The Style panel is now just the template picker**, its typography having
  moved to Text, and it no longer lives inside `main.tsx`.

### Fixed

- **Highlighting stayed on after being turned off.** Every caption line
  enlarged its first word while the caption panel showed nothing highlighted,
  because the renderer treated a stacked template as reason enough to build a
  hero lockup and defaulted the hero to word 0 when the page had none. A
  separate pass also wrote the flag that means "the creator chose this word"
  across the transcript on upload, so highlighting off still arrived with words
  already highlighted and nothing told them apart from a real choice.
- **Dragging a caption around the preview was glitchy.** Snapping was to a 5%
  grid — 441 landing spots, fine enough that the caption twitched to a new one
  on almost every pixel of mouse travel without ever helping anything line up.
  Every mousemove also pushed an undo entry, so one drag flushed the whole
  40-step history.
- **Touching the drag handle moved the caption.** The drag ignored where inside
  the handle the pointer came down, so the caption jumped to put its anchor
  under the cursor the instant the handle was pressed.
- **The three align icons set the horizontal position** rather than the text
  alignment they depict.
- **An upload was stored roughly three times.** The original, a normalised
  copy and a remux all survived; only one needs to.
- **Uploads no longer pass through Vercel's proxy**, which capped them at 50MB
  regardless of what the backend would have accepted.
- **The Hugging Face Space was serving the API with none of its middleware** —
  no key check, no workspace scoping, no CORS allowlist. Three separate causes:
  `include_router` copies routes without middleware, `demo.launch()` discarded
  the app the routes were attached to, and the Space installed a smaller
  dependency set than a checkout. The API gate also had to be narrowed to
  `/api/`, since it was blocking Gradio's own startup route and stopping the
  Space from booting.

### Removed

- **The on-screen text overlay.** Every setting in that panel was a caption
  setting; a second, separate text feature on top of the video was not
  something the app did.

## 0.2.1 — 2026-09-15

### Fixed

- **Caption frames were being composited on top of each other.** Exports came
  back with roughly one frame in twenty blank or missing its caption, scattered
  irregularly — 15 of 300 frames in a ten-second clip. Some showed a word
  sliced in half, and some showed less than the frame before them, so the
  animation appeared to run backwards.

  The frame dispatcher held out-of-order frames and drained them from inside
  each concurrent delivery. Frames were dispatched in the right order, which is
  what made it look correct, but the drain awaited the consumer inside its
  loop — so the moment one call awaited, the next delivery entered the same
  loop and started another. Eight ran at once. Since the consumer composites
  every frame onto a single shared canvas and awaits an image decode partway
  through, a second call reaching `clearRect` wiped a half-drawn frame.

  Anyone on 0.2.0 should upgrade before exporting.

### Removed

- Five controls in the generate panel that collected a value and had it
  dropped: Auto punctuation, Filter filler words, Detect multiple speakers,
  Maximum lines, and Automatic caption splitting. None of them reached the
  server. A control that looks like it works and does not is worse than not
  offering it.

## 0.2.0 — 2026-09-15

The first release since captions moved to Remotion. The theme running through
it is that several parts of the app had quietly grown their own answer to the
same question — where a line breaks, which word gets enlarged, how wide a page
may be — and the editor and the renderer had drifted apart. Much of what
follows is those answers being merged back into one.

### Added

- **Clause-aware line breaking.** Lines break on phrase joints rather than
  wherever the word ceiling happens to land. A short dynamic program scores
  every legal arrangement of a segment and keeps the cheapest: pulled towards
  pauses and finished clauses, pushed away from breaks that strand a word
  leaning on its neighbour. `"There is something in captions of"`, and a page
  holding only `"hain."`, are what this replaces.
- **Explicit line breaks.** A word now carries the creator's own line decision
  instead of the editor expressing it by appending a full stop and dragging the
  following timings backwards. Splitting a line no longer writes punctuation
  nobody spoke into the caption, and merging one no longer moves timings that
  were measured from the audio.
- **A language prompt after upload.** One question, three answers — Hinglish,
  Hindi, English — each showing what its output looks like, asked while the
  upload is still on screen rather than buried in two dropdowns several clicks
  away.
- **Emoji matched to words**, English captions only. A hand-written vocabulary
  supplies the taste and a small sentence encoder supplies the synonyms, so
  "cash" finds the money bag without anyone having listed it. One a page at
  most, and never on the word the template already enlarges.
- **Translation to English** using Whisper's own translate task — no extra
  model, no download, no network, and the English words keep their own
  timestamps. It decodes from the audio, so hand corrections and glossary
  spellings do not reach it; the run replaces the captions rather than
  annotating them.
- **Reels and Shorts interface overlay.** The strips each app reserves, drawn
  over the preview, with a warning when the vertical position has put captions
  behind one. Nothing is moved or clipped — the creator is told and decides.
- **A brand-word glossary.** Names, handles and domains the recogniser cannot
  know, respelled from a list the creator supplies. Only listed terms are
  touched; nothing else in the transcript is second-guessed.
- **Opt-in vocal isolation** before recognition, for clips with music or a room
  under the voice.
- **A caption font picker**, with Devanagari fallbacks on every stack.
- **An export length cap** for shared deployments, refused when the export is
  requested rather than an hour into a render. Unset — the local default —
  there is no limit.
- **A shared API key and a CORS allowlist**, both off by default for local use.
- **The nine Premiere text presets**, each with its own entrance and exit.

### Changed

- **Emphasize and Spotlight are now one Highlight.** They looked like two
  strengths of one thing and were not — see Fixed.
- **A caption page holds at most seven words.** Past that it stops being a
  caption and becomes a paragraph, and the hero word has nothing to stand out
  from. Enforced when pages are built rather than trusted from settings, so a
  project saved under the old bound reflows instead of drawing a wall of text.
- **A full stop is a hint, not a hard break.** Hinglish ASR punctuation is
  unreliable enough that weighing a stop against the pause on either side
  produces better lines than obeying it.
- **The upload prompt asks one thing.** Emoji and translation live in the
  Captions panel's advanced options, beside the brand words and noise cleanup
  they belong with.
- Vocal isolation separates from the original media at its own sample rate.
- The decode overlap widened from 0.6s to 2.5s.

### Fixed

- **Emphasize did nothing on most pages.** It added to the score that picks a
  hero only when nothing is spotlighted, and any explicit spotlight is honoured
  before that score is consulted — so on a page that already had one, clicking
  Emphasize changed a badge and nothing on screen.
- **The editor did not show which word the renderer would enlarge.** Stacked
  templates promote a word on every page whether or not one was highlighted;
  the panel badged a different flag entirely, so a word grew on the preview
  with nothing marking it. Both now read the hero set from the same call the
  renderer makes.
- **Lines could run far past the setting.** The generate panel's slider reached
  12 and wrote straight into `wordsPerLine`, while the editor's stopped at 8 and
  the API refused anything above 8. Dragging a word onto a full line widened the
  *global* chunk size to fit it, reflowing every other line in the project.
- **Vocal isolation made clean speech worse.** It separated the 16 kHz
  recognition copy upsampled to 44.1 kHz — nothing like the model's training
  data — so it invented artefacts, and the recogniser then hallucinated a word
  that was never spoken.
- **Two transcription paths sent stale settings.** Changing the language, or the
  emoji and translation options, and starting a run immediately sent the
  previous values — transcribing in the wrong language without saying so.
- **Confidence was reported as 0.0 when unknown**, which reads as "certainly
  wrong" rather than "not measured".
- **Captions came out all one shade.** Two colour pickers both wrote `accent`,
  while the supporting text colour had no control at all.
- **A hero word was forced onto every line**, including row layouts that read
  better quiet.
- The safe-area overlay could never be switched on — nothing in the interface
  set it — and drew one generic box matching neither app.
- Long exports wrote a PNG per frame to disk; a twenty-minute render reached
  about 5 GB of temporary files. Frames are streamed now.
- Every caption setting is validated on the way in. Colours, offsets and widths
  previously rode through unchecked.

### Upgrading

- `sentence-transformers` is a new optional dependency, behind emoji
  suggestion. Absent, the feature reports itself unavailable and does nothing.
  First use downloads roughly 90 MB and caches it.
- Projects whose line structure came from ASR full stops will reflow on open.
  That is the line-breaking fix working; structure set by hand from here on is
  recorded explicitly and is never overridden.
- Restart the backend after upgrading. The API gained fields the editor sends,
  and a server left running from before will reject saves it does not
  recognise.

## 0.1.0

Initial local Hinglish caption studio.
