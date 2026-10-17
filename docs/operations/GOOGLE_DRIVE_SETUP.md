# User-owned Google Drive projects

Implemented locally; activation requires the database migration and a Google OAuth application. No existing user is automatically connected and no Drive files are made public.

## Activate

1. In the existing Supabase project, open SQL Editor and run `supabase/migrations/20261017_drive_projects.sql`. It creates private, RLS-enabled connection, OAuth state, and project tables. Browser roles have no direct access. The server filters every operation by the verified Supabase user.
2. In Google Cloud Console, create/select a project and enable **Google Drive API**.
3. Configure Google Auth Platform branding, audience, support email and the verified `bol-studio.me` domain. Add the homepage, privacy and terms URLs.
4. Add only `https://www.googleapis.com/auth/drive.file` to Data Access. Do not add full-Drive or read-all scopes. This is per-file permission, not a Google-enforced folder sandbox. The server additionally enforces the Bol Studio folder for project file retrieval.
5. Create an OAuth client with application type **Web application**. Add this exact authorized redirect URI:

   `https://n3owise-bol-studio-backend.hf.space/api/cloud/google/callback`

   OAuth exchange is server-side; JavaScript origins are not needed by this implementation. Use a separate development client/redirect if testing locally.
6. Add these **HF Space secrets**, never frontend/VITE variables:

   - `BOL_GOOGLE_CLIENT_ID`: the OAuth client ID.
   - `BOL_GOOGLE_CLIENT_SECRET`: its client secret.
   - `BOL_GOOGLE_REDIRECT_URI`: the exact redirect above.
   - `BOL_STUDIO_URL`: `https://www.bol-studio.me/studio`.
   - `BOL_SUPABASE_SERVICE_ROLE_KEY`: Supabase's server-only service-role key, not the anon key. Prefer a dedicated backend deployment for this integration if stricter credential separation is required.
   - `BOL_DRIVE_ENCRYPTION_KEY`: generate once using `.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`. Store it securely; losing/changing it requires users to reconnect Drive.
   - Keep existing `BOL_SUPABASE_URL`, JWT verification and frontend credentials unchanged.
7. Deploy the Python backend and frontend. Until all required variables exist, the UI explains that Drive saving is unavailable and temporary mode continues to work. Presence of variables does not prove the SQL or Google application is configured correctly; complete the acceptance checks below.
8. While Google's OAuth app is in Testing, add explicit test users. Publish it and complete the applicable Google branding/verification steps before public launch. Testing refresh tokens normally expire after seven days for this Drive permission.

Do not paste any keys, passwords or refresh tokens into chat, source control, or browser-visible configuration.

## Data and processing

- Google creates a normal **Bol Studio** folder inside each connected user's My Drive. App-created file IDs are linked to the authenticated Bol Studio account. Files consume that user's available Google storage.
- Browser uploads the original directly to a server-created Drive resumable session, in 8 MiB chunks, with status checks and bounded retries. Session URLs are temporary bearer capabilities; do not log or persist them.
- For files at most 12 MiB and audio at most three minutes, browser audio decoding is attempted with a 12-second decode timeout. Mono 16 kHz PCM is sent separately to HF while the Drive upload runs. A successful audio session can generate captions before the original finishes uploading. Caption setup still asks the user's language choice before starting recognition.
- A decoded WAV is checked server-side for format and duration. Large/unsupported/failed local extraction falls back to authenticated retrieval of the original from Drive and the existing HF/FFmpeg extraction path. No public sharing links or refresh tokens are sent to the browser.
- The fast audio path hydrates the original into HF's working cache after Drive upload. Export is blocked until hydration succeeds. Local preview uses the original browser File, including while upload runs. The application still uses its existing server/Remotion export renderer.
- Supabase stores a versioned project snapshot: caption words/timings, settings, canvas layers, asset manifest and other editable state. Source video and imported overlay/audio/image media live in Drive. Supporting media is uploaded when saving and restored when reopening.
- Worker sessions, including Drive-backed sessions, retain temporary leases. Cleanup deletes only the working cache; the canonical Supabase snapshot and Drive media survive. Completed recognition attempts to save captions without needing the tab to remain open. Active browser uploads must finish before closing.
- Reopening downloads private source/supporting media to an isolated worker session, then uses existing authenticated, range-capable playback. It is not instantaneous streaming directly from a Drive share URL. First-open time depends on media size and connection. This version does not use persistent browser/OPFS caching.
- Revision compare-and-swap in Supabase prevents silent cross-device overwrites. On conflict, preserve any unsaved subtitles if wanted, then reopen the saved project. There is no automatic merge of simultaneous edits.
- Disconnect revokes the Google grant and removes encrypted connection credentials, leaving Drive files and saved project metadata intact. Reconnection restores access when the same Google account and folder are available. Removing a saved project removes its library entry only; it does not delete the user's Drive files.
- Existing temporary projects are not automatically migrated into Drive. Choose Drive mode for new uploads. Export-to-Drive is available for Drive-backed projects; temporary projects retain download export.

## Acceptance checks after configuring

1. Connect with a dedicated test account. Confirm Google's permission screen does not request all files, and a Bol Studio folder is created/reused.
2. Upload a short supported clip in Drive mode. Preview/play it locally during upload; generate captions. Verify the original, caption data, and saved status before leaving.
3. Upload a larger/unsupported clip to exercise HF extraction. Check caption generation and export after private original retrieval.
4. Change captions, colours, timing and add an overlay. Reopen on a second device using the same Bol Studio account; verify all edits, assets and playback.
5. Edit the same saved project on two devices; confirm the second conflicting save is rejected with instructions instead of replacing the first.
6. Test both download and Drive export. For a Drive transfer failure, retry saving the finished render without rendering again.
7. Test Drive storage-full, revoked Google access, moved/deleted source, interrupted upload, and browser close during processing. Confirm failures do not show Saved.
8. Verify a second Bol Studio user cannot list, restore, save or export the first user's projects. Verify DB browser/anon roles cannot read credentials or snapshots.
9. Disconnect and verify Google access is revoked while files remain in Drive. Reconnect with the same Google account.
10. Keep existing temporary-mode upload, captions, export and lease-cleanup checks passing.

## Limits and remaining activation work

- The free storage belongs to the user; HF compute, Supabase quotas, Google API quotas and transfer time still apply.
- Up to 100 project entries per account in the initial library; source uploads retain the existing 1 GiB and 20-minute limits. Supporting media is bounded by the worker's existing quotas. Snapshots are capped at 5 MiB.
- Local font files licensed to the development machine are not uploaded; use shipped production fonts for cross-device parity.
- Live Google OAuth, browser-to-Google CORS/session behaviour and real two-device flows cannot be verified until the operator provides/configures the OAuth client, secrets and database migration. Automated tests mock the external providers and exercise real media handling locally.
