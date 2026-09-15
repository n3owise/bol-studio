# Changelog

Notable changes to Bol Studio.

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
