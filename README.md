---
title: Bol Studio Backend
emoji: 🎙️
colorFrom: green
colorTo: green
sdk: gradio
sdk_version: 6.26.0
python_version: '3.12'
app_file: app.py
pinned: false
license: apache-2.0
---

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

## Accounts

Optional, and off unless configured. With no Supabase project set up, the studio
opens straight to the editor and keeps projects under a random id the browser
stores — which is what lets `npm run dev` work with nothing to configure, and is
separation rather than authentication.

Configured, people sign in and their projects follow the account rather than the
browser.

### Setting it up

1. Create a Supabase project. **Authentication → Providers → Email**: turn on
   *Confirm email*.
2. **Authentication → URL Configuration**: set the Site URL to your deployed
   origin and add `http://localhost:5173` to the redirect URLs. Confirmation and
   reset links bounce to the wrong place otherwise.
3. Frontend (Vercel, or `.env` locally):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
4. Backend (the Space, or your shell):
   ```
   BOL_SUPABASE_URL=https://<ref>.supabase.co
   BOL_MEDIA_SECRET=<a long random string>
   ```

The anon key is meant to ship in the bundle — it identifies the project and
authorises nothing by itself. **The service role key is never needed here**: the
backend verifies signatures with Supabase's public keys and never calls the
Supabase API. Anything named `VITE_*` is inlined into public JavaScript, so a
service key there would publish full database access to every visitor.

### What the backend actually does

It verifies the access token and reads the user id out of it. That id becomes the
`owner` already stored on every project, so nothing else about the data model
changes. Passwords, confirmation mail and reset links are Supabase's; the backend
never sees a password.

`<video src>` cannot send headers, so media URLs carry a short-lived signed token
that opens one project's media for two hours and nothing else — rather than
an access token, which is good for an hour and for everything and would end up in
proxy logs and browser history.

### Existing projects

Turning accounts on makes a project with no owner belong to nobody rather than to
everyone. Every project created before accounts existed has no owner, so claim
them deliberately:

```
python scripts/backfill-owner.py --owner <supabase-user-id> --dry-run
```

There is no automatic version, because nothing can tell whose those projects
were — and "the first account to sign in gets them" would hand one person
everyone else's work.

### Two things to know

Supabase's built-in mail sender allows **2 emails per hour** and is not meant for
production. Configure custom SMTP before real users sign up, or their first
experience is a confirmation link that never arrives.

A free Supabase project **pauses after 7 days idle**, and paused means nobody can
sign in. `.github/workflows/supabase-keepalive.yml` pings it every three days;
it needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets.

## Deploying later

Vercel is a good home for the frontend and lightweight authenticated API. Large media uploads should go directly to private object storage, while transcription and rendering run in a separate durable worker. The local Python/FFmpeg process is deliberately not bundled into a Vercel function. Add authentication, ownership checks, private media URLs, quotas, retention, and job recovery before making the editor public.

### Job admission and storage mode

The JSON project store supports one server process per data directory on macOS/Linux. Startup takes an OS file lock and refuses a second process before recovery or project writes. Do not configure multiple Uvicorn workers against the same directory. Keep `.bol-process.lock` in place; its lock is released automatically when the process exits.

`BOL_MAX_WORKERS` controls running jobs. `BOL_MAX_QUEUED_JOBS` defaults to 8 additional admitted jobs, and `BOL_MAX_OWNER_JOBS` defaults to 3 running/queued jobs per workspace. Capacity includes an autostart upload while it is being prepared. A full server queue returns 503; the workspace limit returns 429. Both provide `Retry-After: 30`. Rejected admissions do not save queued state. Uploads without autostart remain available when the compute queue is full.

Accepted work is committed to `.bol-jobs.sqlite3` before submitting it to a worker. Graceful shutdown waits for running writers and retains pending journal entries. After a restart, the journal replays unfinished work through the same workspace and global limits, using the frozen export snapshot. Cancelled generations, deleted projects and already completed outputs are skipped. Older jobs without a journal entry become explicit errors with retry instructions. A crash before journal submission can therefore require manual retry; a successful API response occurs after journal submission. Keep the journal with the project data when making backups.

This is durable delivery for the supported single-process store. Multiple hosts/processes still require transactional project storage and distributed leases. A persistent volume and tested backup/restore procedure are required on hosted installations; a journal cannot recover media removed by ephemeral storage.

Uploads and derived outputs have workspace storage reservations, upload concurrency and media limits. Export files and renderer diagnostics are watched for quota overruns. Render admission also limits visual assets, simultaneous video decoders and decoded frame pixels. Limits are configurable; watchdogs have sampling overshoot, and frame-pixel budgets do not bound all codec/browser memory. See [current operations](docs/project-brain/CURRENT_OPERATIONS.md) and [render resource limits](docs/audit/render-resource-fixes.md).

### Current capability limits

Safe Area guides are approximate visual references; they do not constrain caption placement or guarantee that platform controls will never cover captions. Check exports on the target platform. Projects are stored on the configured backend filesystem, not in the browser; account ownership applies when authentication is enabled. A hosted backend requires persistent storage and an operational backup/retention policy. CSV downloads prefix formula-like text with an apostrophe for spreadsheet safety; use JSON when exact text round trips matter.
