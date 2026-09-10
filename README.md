# Bol

Bol is a local Hinglish caption studio. Drop in a video or audio file, review the timed transcript, correct Roman spelling, mark words for emphasis, choose a motion template, and export a captioned MP4, a silent green-screen overlay, or SRT/VTT/JSON timings.

## Run it locally

The first setup downloads a small quantized Roman-Hinglish specialist once. After that, transcription runs on this Mac without uploading media to a provider. It keeps Hindi words romanized while leaving spoken English words such as `come`, `video`, `upload`, and `AI` in Latin script. Native Devanagari output remains available through the multilingual fallback.

If the larger Apex variant is also prepared, the local worker selects it automatically for the accuracy-first desktop path; the smaller Swift variant remains the practical browser/free-worker choice.

```sh
npm install
.venv/bin/pip install -r server/requirements.txt
.venv/bin/python scripts/prepare-hinglish-model.py
# Optional: the larger, more accurate local variant (about 1 GB)
# .venv/bin/python scripts/prepare-hinglish-model.py --variant apex
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local API runs on port 8765 and the Vite proxy keeps the browser flow same-origin. FFmpeg is required for media inspection, browser previews, and exports.

For a CPU or CUDA worker, install `server/requirements-cpu.txt` and set `BOL_ENGINE=faster-whisper` plus the model/device settings shown in `.env.example`. To select the specialist explicitly, set `BOL_ENGINE=sherpa-hinglish` and `BOL_HINGLISH_MODEL_DIR` to the prepared model folder. The local worker accepts files up to 1 GB and 20 minutes; these are intentionally conservative development limits.

## What the pipeline does

1. FFmpeg probes the file and extracts a temporary 16 kHz mono analysis track. The original media is kept separately for preview and export.
2. The Roman Hinglish specialist emits mixed vocabulary in Latin script directly and returns DTW-aligned token timings that are grouped into spoken words. Hindi source text is retained as `original`; Roman Hinglish is the editable `text` display field.
3. MLX Whisper `large-v3-turbo` remains available as the multilingual fallback for native Devanagari output and environments without the specialist. It applies a small common-word spelling map plus uroman for remaining Hindi script. This is transliteration, not translation.
4. Emphasis is a measured suggestion from local loudness, pitch where voiced, and word duration. The creator can toggle any word, so the model never decides the editorial meaning of a caption by itself.
5. The browser preview and Node/Canvas renderer share the same caption layout and motion function. FFmpeg combines rendered frames with the original source audio or produces a silent green-screen overlay.

## Validation

```sh
npm run build
npm run test
```

The test suite covers transcript grouping, SRT/VTT timestamps, font rendering, canvas layout, export validation, atomic project updates, ordered word edits, measured emphasis, silence handling, and restart recovery. `scripts/make-test-media.py` creates synthetic media for integration checks; synthetic speech is not an accuracy benchmark.

The model’s practical Hinglish quality still needs evaluation on consented creator recordings. Names, slang, rapid code-switching, background music, overlapping voices, and preferred Roman spellings should be reviewed in the editor. See [docs/RESEARCH.md](docs/RESEARCH.md) for the Kalakar comparison, model tradeoffs, accuracy plan, and the later Vercel worker architecture.

## Deploying later

Vercel is a good home for the frontend and lightweight authenticated API. Large media uploads should go directly to private object storage, while transcription and rendering run in a separate durable worker. The local Python/FFmpeg process is deliberately not bundled into a Vercel function. Add authentication, ownership checks, private media URLs, quotas, retention, and job recovery before making the editor public.
