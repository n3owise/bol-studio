# Hinglish caption studio: model, timing, and rendering decisions

Research checked 9 September 2026. This document separates verified provider capabilities from the design proposed for this app. No real creator corpus has been evaluated yet, so there is no justified accuracy percentage for this implementation.

## What Kalakar does

Kalakar positions itself around South Asian creators. Its public site advertises customizable caption templates, audio enhancement, Premiere Pro and DaVinci Resolve plugins, video rendering, SRT/VTT exports, green/blue background renders, and alpha-channel exports. Audio-only uploads and some export features are plan-dependent. Its advertised accuracy is a vendor claim; the public page does not give a Hinglish test set and scoring protocol sufficient to independently verify it. [Kalakar product page](https://www.kalakar.io/)

Its guides describe word editing, keeping Hindi-English mixed speech intact, and choosing Roman or native script. Roman means Hindi written in Latin letters; it does not mean translating Hindi into English. Their Roman guide currently says to select English for Hinglish and says changing script requires regeneration. This is product-specific guidance, not a setting to copy into Whisper: forcing an English recognizer on Hindi can lose Hindi speech. [Hinglish guide](https://www.kalakar.io/blogs/hinglish-captions-why-they-break), [Roman/native guide](https://www.kalakar.io/blogs/roman-vs-native)

The reviewed public pages do **not** identify Kalakar's exact speech model, alignment engine, training data, emphasis detector, or rendering backend. A pipeline involving transcription, a timed text representation, an editor, and a renderer is our architectural inference from the visible features. It is not evidence that Kalakar uses Whisper, Sarvam, Remotion, or any particular supplier. Build original template designs rather than copying their visual assets.

The installed macOS app was also inspected read-only. It is an Electron 1.0.2 shell whose main process points at `https://app.kalakar.io`; its package includes `@remotion/renderer` and no speech-model weights. The editor is behind sign-in, so no account credentials or user media were accessed. This confirms that the desktop bundle does not reveal Kalakar's ASR model; its model and processing service remain on the vendor side.

### What the running Kalakar editor exposes

The open editor confirms a few pipeline boundaries even though it does not expose the proprietary implementation. The project has a word-level timeline, while the visible caption blocks are grouped separately. The captions panel exposes a maximum-character setting (24 in the inspected project), one-line layout, caption delay, and independent actions for removing punctuation, gaps, or emphasis. Each word can be edited and has its own options, and each caption line can override the selected template. This is consistent with a timed word list feeding a grouping/layout layer, then a per-word style layer and a template renderer.

The local Electron feature flags include `enable-captions-emphasis`, `enable-multiple-templates`, `enable-client-side-rendering`, and `enable-desktop-local-rendering`. The app's local package includes Remotion's renderer. Together these indicate that Kalakar supports emphasis as editable metadata and can render at least some projects on the client/desktop; the backend and CDN connections visible from the process are evidence of a hybrid product, not proof of which service runs ASR. No model files or public model identifier were present in the installed bundle.

The most plausible emphasis implementation is a prosody pass after word alignment: calculate loudness, voiced pitch movement, speaking-rate/duration, and pause/phrase-boundary features for each timed word; normalize them against nearby words from the same speaker; combine them into a prominence score; and store a suggestion that the editor can accept, remove, or override. Loudness alone is too brittle for music-backed reels, changing microphone distance, and compression. A production implementation should keep active-word karaoke state, acoustic prominence, and creator-selected emphasis as separate fields.

## The local model choice

| Route | What it provides | Fit and limitations |
| --- | --- | --- |
| **Whisper-Hindi2Hinglish Swift via sherpa-onnx** | A 72.6M Whisper-base fine-tune exported to int8 ONNX; emits Romanized Hinglish directly and exposes token-level DTW timestamps | Browser/free-worker candidate. About 120–150 MB, practical for a client-side download or a small worker, but less accurate than Apex on noisy audio. |
| **Whisper-Hindi2Hinglish Apex via sherpa-onnx** | An 807M pruned Large-V3 fine-tune exported to int8 ONNX; direct Roman Hinglish and token-level DTW timestamps | Accuracy-first upgrade for a local worker; about 1 GB and too heavy for an initial browser download on many devices. |
| **Srota Qwen3-ASR-0.6B** | A recent Hinglish fine-tune that keeps English Latin and Hindi Devanagari in mixed output | Promising reported WER improvement, but its current public integration is Transformers/PyTorch oriented and its output is not the Roman Hinglish format this editor needs. Keep it as a later benchmark candidate rather than replacing the timestamped ONNX path. |
| **MLX Whisper, large-v3-turbo** | Multilingual transcription on Apple Silicon; word timestamps via `word_timestamps=True` | Local development default on this Mac. Download weights once, then process media locally. Timestamp quality and Hinglish spelling still require review. |
| **faster-whisper, large-v3 or turbo** | Whisper inference on CPU or NVIDIA GPU, word timestamps, optional VAD | Portable worker route for Linux deployment. CPU can use int8; GPU configuration depends on CTranslate2/CUDA compatibility. Benchmark target hardware before promising turnaround. |
| **WhisperX alignment upgrade** | Separate audio/text forced alignment and optional speaker diarization | Useful when Whisper word boundaries need refinement. Needs suitable language alignment models; mixed scripts, unsupported characters, numerals, and overlapping voices need careful handling. |
| **Sarvam Saaras API** | Indian-language recognition with `translit`, `codemix`, `verbatim`, and other output modes | Worth a controlled comparison for Roman Hinglish, but its documented timestamps are sentence/phrase chunks, not individual words. A word-alignment stage remains necessary for accurate karaoke timing. |

MLX explicitly supports local model paths, Hugging Face model identifiers, and word timestamps. The selected checkpoint is a community MLX conversion of large-v3-turbo. Its listed download is approximately 1.61 GB; process memory is a separate concern. [MLX Whisper API](https://github.com/ml-explore/mlx-examples/tree/main/whisper), [checkpoint](https://huggingface.co/mlx-community/whisper-large-v3-turbo)

The current worker chooses the Apex specialist when its three public ONNX files are prepared and otherwise uses Swift. The model card reports direct Romanized Hinglish output, per-token timestamps from cross-attention DTW, and benchmark WER values of 38.7% on Common Voice, 35.1% on FLEURS, and 65.2% on Indic-Voices for Swift. The larger Apex export reports 36.0%, 29.8%, and 47.6% on the same sets. Those figures come from the community model card and are not a guarantee for a creator's microphone, accent, or background music; the specialist still needs a held-out evaluation set. [IndicConformer sherpa-onnx model card](https://huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx)

For longer recordings, the local worker decodes the specialist in overlapping windows because the sherpa Whisper wrapper has a sub-30-second stream limit. It removes duplicate words in the overlap and preserves the absolute timestamps. Roman Hinglish jobs can also run a cached MLX large-v3-turbo companion pass on Apple Silicon. That pass is an English verifier only: it may repair an aligned word such as `capsules` to `captions`, but it is prevented from replacing known Hindi words with a translated paraphrase. If MLX is unavailable, the specialist result remains usable and the verifier is skipped.

The Swift model is the practical candidate for browser-local inference because it is roughly 120–150 MB and uses ONNX runtime. The current website still runs inference in the local Python worker so the browser editor stays simple and the same code can later move to a durable worker. A future browser build can use the same ONNX files with a WebAssembly sherpa-onnx binding, but that should be treated as an engineering phase after measuring memory and download time across mobile Safari, Chrome, and low-end Android. The Apex model is better suited to an opt-in desktop or server worker because its download is about 1 GB.

Srota is worth comparing on real conversational recordings because its authors report a 36% relative WER reduction against the Qwen base model on their conversational test split. Its public examples intentionally preserve Hindi in Devanagari, so it would need a separate, context-aware Romanization stage and a timestamp integration before it could be the app's main engine. [Srota Hinglish ASR](https://github.com/Suraj-gameramp/qwen-0.6b-hinglish)

Whisper is multilingual; the `turbo` model is a faster variant of large-v3. OpenAI notes that performance varies substantially by language and hardware, so its published general benchmarks are not Hinglish performance guarantees. Use the transcription task to preserve the spoken language rather than translating the recording. [Whisper repository](https://github.com/openai/whisper)

faster-whisper documents int8 CPU inference, GPU inference, word-level timestamps, and Silero VAD. We should compare models under matching decoding settings and the same dataset. [faster-whisper](https://github.com/SYSTRAN/faster-whisper)

Sarvam's current model documentation lists v4 as latest and v3 as the default recommended model. `translit` produces Roman script; `codemix` keeps English words in Latin and Indian-language words in native script. `verbatim` preserves fillers and spoken number forms. Neither the current general response description nor the batch guide promises per-word timing; both explicitly describe chunk timing. This matters because splitting a sentence duration evenly among words creates guessed timestamps. [Saaras models](https://docs.sarvam.ai/api/getting-started/models/saaras), [batch timestamp limits](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/batch-api)

Saaras is an optional future comparison, not required for the local workflow. No provider key is needed to run the installed local model, and this prototype does not silently send uploaded media to a hosted provider.

## How transcription becomes usable Roman Hinglish

The app should retain a canonical word list containing a stable word ID, source text, displayed text, start/end seconds, model probability when available, and user-editable emphasis. A script or spelling edit must not quietly reorder the word IDs or move their timestamps.

1. Inspect the media and extract one 16 kHz mono analysis track with FFmpeg, preserving the original media for export.
2. Run multilingual speech recognition with word timestamps. A Hindi language hint and a small relevant vocabulary can help in some recordings; neither guarantees correct English switches. Short clips are especially prone to wrong language detection.
3. Keep Hindi in the original recognized script as well as its Roman display. Apply consistent Hindi spellings and known English vocabulary mappings, then use a generic romanizer as a fallback. Existing English words stay English.
4. Let the user correct text, time boundaries, and emphasis while listening. Probability is a model signal, not a calibrated promise that a word is correct.
5. Group consecutive words at pauses, punctuation, readable line widths, and template-specific limits. Keep true silence free of invented captions.

The local fallback uses uroman, a Unicode-to-Latin romanizer. It solves script conversion, not every contextual spelling decision. For instance, automatically deciding whether a Hindi-script token is a borrowed English word, a name, or a Hindi word needs context; common-word dictionaries only cover known cases. Generic transliteration may produce readable but unnatural spellings. [uroman project](https://github.com/isi-nlp/uroman)

For a later contextual correction stage, supply an LLM the original source, the audio-derived words, and a strict ID mapping. Allow spelling/transliteration corrections; reject missing, extra, or reordered IDs. A fluent paraphrase is unsuitable for captions intended to reproduce speech. Personal names, brands, colloquialisms, and preferred spellings belong in a project vocabulary.

If adding WhisperX, align original text with an appropriate language model first, then attach the Roman display to the same word IDs. WhisperX documents failures for characters outside an alignment model's dictionary, overlapping speech, and imperfect diarization. Code-switching may require language-aware spans or a separately validated multilingual aligner; running an English aligner over Romanized Hindi is not a general solution. Mark any fallback boundary as estimated. [WhisperX limitations](https://github.com/m-bain/whisperX)

## Spoken emphasis and visual emphasis are different controls

There are three useful signals:

- **Active word:** the audio playhead is within that word's time interval. This drives karaoke highlighting and is independent of whether the speaker stresses it.
- **Acoustic prominence suggestion:** an engineering heuristic from local loudness, pitch movement where measurable, and duration relative to surrounding speech. Background music, mic distance, sentence position, word length, and compression can distort these cues.
- **Editorial emphasis:** a creator intentionally marks an important word or phrase for a larger size, accent color, or extra movement. Meaning and style influence this choice; it may differ from acoustic prominence.

The local prototype can estimate prominence from the audio and offer manual overrides. It should say “suggested emphasis,” not claim to detect the speaker's intention. Whisper word probabilities represent recognition confidence, not stress. Keep “follow the active word” and “make emphasized words larger” separate so one or two selected words can stay larger while the rest of the phrase stays small.

For improved prominence, collect human labels with multiple raters and evaluate both speech-only audio and common music-backed reels. Normalize acoustic cues within a speaker or local window, ignore unvoiced pitch estimates, and avoid selecting every long Hindi word just because of its duration. Evaluate suggestions separately from transcription and timing.

## How the animated captions and exports should work

The template receives the same saved transcript, style settings, frame size, and absolute timestamp in preview and export. It computes colors, text sizes, positions, opacity, and transforms from that timestamp. Use one shared layout/rendering implementation wherever possible, with the same bundled fonts. This avoids an attractive browser preview exporting with different word wraps or timing.

Words should animate with short entrance/exit easing, a subtle active-word pop or accent, and a stronger scale for explicitly emphasized words. Templates can vary typography, grouping, background treatment, and motion, rather than merely swapping colors. Keep readable contrast and safe margins for social app controls. Reserve layout width for the maximum emphasized size or intentionally animate the whole phrase; accidental reflow on every active word looks unstable.

| Output | Content and expected behavior |
| --- | --- |
| Burned-in MP4 | Original video plus the caption layer, with source audio. For audio-only input, generate a chosen visual background. |
| Green-screen MP4 | Caption animation over flat chroma green for an editor to key out. Match duration and frame rate; avoid using the key color inside the caption artwork. |
| Transparent video, later | A container and codec that preserve alpha, verified in target editors. Ordinary H.264 MP4 is not a transparent-video deliverable. |
| SRT/VTT | Timed text for subtitle tools. These cannot carry the full canvas typography and animation. |
| Editable project JSON | Words, source/display scripts, timings, emphasis, template, and style settings so a render can be reproduced. |

Compositing is a media operation, not another speech model. A local renderer produces caption frames; FFmpeg encodes them and combines them with video/audio. Production performance needs measured limits for output duration, resolution, frame rate, font handling, and concurrent renders.

## Accuracy validation before making product claims

Prepare a consented evaluation set of real Hinglish creators, including Hindi-heavy and English-heavy clips, frequent switch points, accents, names/brands, numbers, rapid speech, pauses, outdoor noise, music, and overlapping speakers. Separate a development set from a held-out test set. The same speaker should not appear in both when measuring generalization.

Use human-reviewed source transcripts, explicit Roman spelling conventions, manually checked word boundaries, and separately labeled prominence. Preserve a verbatim reference including meaningful fillers and repetitions. Score:

- Word error rate on normalized references, plus strict display spelling error rate and English token/name accuracy. Report the normalization rules so spelling variants do not hide real omissions.
- Word-boundary absolute error at the median and high percentiles, plus missing/zero-duration words and visible late highlights. Inspect switch points separately.
- Emphasis suggestion agreement and precision/recall against human labels; report rater disagreement. It is a different metric from word recognition.
- User correction time per minute, real elapsed processing time, peak memory, and export success rate. These measure whether the product actually saves an editor time.

Compare turbo, full large-v3, and any hosted candidate on that same corpus. Keep decoding settings and hardware recorded. Do not present synthetic speech smoke tests or a vendor's headline percentage as real creator accuracy.

## Local development and the Vercel deployment path

The current shape is a browser editor plus a local Python transcription/media API. A local development server can persist jobs and uploads on this machine. This is useful for product validation but does not by itself provide public SaaS authentication, billing, tenant isolation, resilient job queues, or durable shared storage.

For hosting later:

1. Deploy the web UI and lightweight authenticated API routes from GitHub to Vercel.
2. Authenticate the user and issue a scoped upload token; upload media directly from the browser to private object storage.
3. Store project metadata and ownership in a database. Enqueue a durable job with the object's key, never a trusted client-supplied arbitrary filesystem path.
4. Run ASR and rendering in a separate long-lived CPU/GPU worker or managed container, with retries, job status, cancellation, resource limits, and temporary-file cleanup.
5. Upload the final render to private storage and return a short-lived authorized download. Add usage accounting and billing once job costs are measured.

Vercel Functions currently limit request/response payloads to 4.5 MB and have memory/duration limits. The large model and media workload make a separate worker the appropriate architecture for this implementation. Direct client upload avoids routing large video bodies through a Function. Vercel's Blob guide requires authenticating and authorizing users before generating upload tokens. [Function limits](https://vercel.com/docs/functions/limitations), [Blob client uploads](https://vercel.com/docs/vercel-blob/client-upload)

The Apex ONNX files are roughly 1 GB on disk, so they should not be bundled into a Vercel Function. Vercel's current Python bundle limit is 500 MB, and a serverless function has no reliable warm model cache for a media queue. Vercel is suitable for the UI, authentication, project metadata, and direct Blob uploads; run ASR and video rendering in a persistent worker/container with the model mounted or cached. A paid Vercel plan raises memory and request-duration limits, but it does not turn a 1 GB offline ASR bundle into a good serverless workload. The smaller Swift export is a possible lightweight worker/browser candidate, not an accuracy-first replacement for Apex.

Before public release, implement authenticated project ownership on every operation, private media access, quotas/rate limits, file and duration validation, durable job recovery, deletion/retention policies, abuse controls, and observability. Keep model caches and user uploads out of Git. These are remaining public-service requirements, not features implied by a polished local interface.

## Reproducible local preparation and fixtures

From the repository root, after installing backend requirements:

```sh
.venv/bin/python scripts/prepare-model.py
.venv/bin/python scripts/prepare-model.py --offline
.venv/bin/python scripts/make-test-media.py
```

The model preparation script caches model weights with Hugging Face and prints the resolved revision. `--revision` can pin it for a reproducible deployment. The fixture script writes to ignored `data/test-fixtures/`: deterministic silence, a tone, a short test-pattern video, and synthetic speech/video using available macOS Hindi and Indian English voices. `manifest.json` records reference text and synthesis provenance. The script deliberately does not invent reference word timestamps. These files test ingestion, local model execution, timeline structure, and media exports; they do not establish real Hinglish accuracy.

### Observed local smoke result

On 9 September 2026, model revision `a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb` downloaded successfully and passed the offline cache check. A direct MLX transcription of the 12.45-second synthetic Hindi/English WAV returned 30 words with start/end times in 8.398 seconds elapsed, including model loading. This is one run on this machine, not a performance promise. The 360 × 640 fixture video was also verified as H.264/AAC with a 12.5-second container duration.

The quantized Swift specialist was then tested on the same fixture. It returned 29 Roman-script words with token-aligned intervals in about 2.5 seconds after the model was cached. It kept the full sentence in Latin script (`Namaste doston, aaj ham sikhenge...`) and avoided the previous all-Devanagari English borrowings. The fixture still contains a semantic recognition error (`actions` where the synthetic voice intended `captions`), so this is evidence that the script problem improved, not a claim that the transcript is now perfect.

The smoke transcript contained errors: synthetic “captions” was recognized as “का अक्शन्स,” and “शानदार” became “शांदार.” Other English borrowings were recognized in Devanagari, such as “अपलोड” and “एनिमेशन.” The full result is kept locally in `data/test-fixtures/hinglish-mlx-result.json`. This confirms model execution and word timestamp output while demonstrating why contextual vocabulary, script conversion, and listening-based edits remain necessary. No manually labeled boundaries or real creator recordings were used, so timing precision and Hinglish accuracy are not established by this test.
