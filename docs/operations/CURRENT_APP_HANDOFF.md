# Current application handoff — 2026-10-17

Source review at commit `2892d47`. Working tree was clean before this note. This is a source-based handoff, not a live deployment or acceptance-test report.

## Routes and entry points

- `/` is now the public marketing landing page, not the editor.
- `/studio` is the editor; `studio.html` loads `src/main.tsx`.
- `src/main.tsx` is now a small auth/admin wrapper that lazy-loads `src/Studio.tsx` after authentication.
- `/admin/analytics` continues to use the editor entry and the existing access checks.
- Landing auth callback detection forwards the query/hash to `/studio` so confirmation/reset links sent to `/` still reach authentication handling.

## Editor organization

`src/Studio.tsx` owns editor state and orchestration. Rendering has been extracted into `PreviewStage`, `StudioTimeline`, `UploadDropzone`, and `ExportModal`. Theme handling is in `src/lib/useStudioTheme.ts`; stage-file handling, caption anchors, and timecode helpers also have their own modules.

Recent mobile portrait editing, draggable panel/timeline edges, FolderFloat upload, TargetCursor, and FuseButton remain in the committed tree. Settings no longer exposes Worker diagnostics or Project ID. Do not assume the old monolithic `src/main.tsx` still contains editor implementation.

## Public site

`src/landing/` owns the public site, its separate stylesheet, shared sections, content, and React/Remotion animation examples. Home includes before/after caption previews, workflow, styles, features, use cases, FAQ, contact, and calls to open the studio.

Public search pages:

- `/hinglish-captions`
- `/hindi-subtitles`
- `/reels-captions`
- `/youtube-shorts-subtitles`
- `/caption-styles`

Build now produces client bundles, an SSR landing bundle, then prerendered HTML through `scripts/prerender-landing.mjs`. Metadata includes canonicals, structured data, share images, robots and sitemap files. Vercel routes explicitly serve the studio and public pages, redirect the bare domain to `www`, remove trailing slashes, and allow unknown paths to return the custom pixel-ghost 404.

## Authentication, theme, analytics, contact

- Auth now uses two labelled Log in / Sign up segments instead of the previous switch.
- Default theme is light; an explicit saved dark preference is respected, including the auth screen.
- Google tag `G-BMKXG00R6M` is installed in both HTML entries. Analytics storage defaults to granted; advertising storage/user-data/personalization remain denied. PostHog's consent remains separate.
- The contact form posts to FormSubmit's AJAX endpoint for `hello@bol-studio.me`, not Resend. It has client validation, a honeypot, success/error states and email fallback. FormSubmit requires inbox activation; actual activation/delivery was not verified in this review.
- Resend/Supabase authentication email setup is a separate existing system; the contact form change does not establish a change to auth email transport.

## Session messaging

A dismissible per-tab notice explains that projects are temporary, not saved to the account, and should be exported before refresh/close. The notice calls the session “local only”; this is user-facing copy, not proof that media processing happens exclusively in-browser. Existing backend upload/transcription/export and temporary cleanup architecture still applies.

## Scope of review

Read recent commits, route/build configuration, extracted editor files, landing content, auth changes, analytics setup, contact delivery code, and temporary-session notice. No site changes, deployments, email submissions, or full functional tests were performed for this knowledge-sync request.

## Subsequent local implementation: optional Google Drive storage (2026-10-17)

The editor now has temporary/Drive modes, limited `drive.file` OAuth, private encrypted connection storage, resumable original uploads, bounded local audio extraction with secure HF fallback, local File previews, versioned Supabase editing snapshots, cross-device recovery with supporting media, and Drive/download export destinations. Worker files remain lease-cleaned caches. This is local code, not a verified live deployment. Google OAuth credentials and the private Supabase migration are not configured locally. See `GOOGLE_DRIVE_SETUP.md` for activation and verification. The old “local only” notice is replaced with accurate temporary-processing language.
