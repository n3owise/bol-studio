## Hosting split (October 2026)

Private `/api/admin/access` and `/api/admin/analytics` run in Vercel Node Functions.
They verify the Supabase bearer token before checking `BOL_ADMIN_USER_IDS`.
Accounts and database remain in Supabase. AI, media uploads and export jobs remain
on HF and the production client continues calling that worker directly.

Set reporting secrets and the `BOL_` analytics variables on **Vercel Production**,
not HF. In particular, migrate `BOL_POSTHOG_PERSONAL_API_KEY` to Vercel as a secret;
HF cannot disclose an existing secret for automatic copying. No `VITE_` prefix.
The function can use the existing public `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` for server-side verification (no service-role key needed).
The local Vite server uses the same handlers with gitignored `.env` settings.
Existing HF admin routes remain temporarily available for old clients; remove
the HF reporting credentials after the Vercel deployment is verified.

# Bol Studio production analytics

Implemented: Vercel page views, opt-in PostHog product events / optional masked replay, Sentry browser errors and backend transcription/export failures, and a private `/admin/analytics` overview with provider links. No sample traffic or fake counters are displayed. Tracking is disabled on localhost unless `VITE_TELEMETRY_DEV=1` is explicitly set.

## Activation

Create projects in your own PostHog and Sentry accounts. The Vercel team currently has neither integration installed. Marketplace discovery confirms both providers are available. Their setup requires completing the provider account connection; no accounts, subscription upgrades, or tokens have been created on your behalf.

1. Vercel project → Analytics → Enable Web Analytics.
2. PostHog → create a project → copy its public project API key and ingestion host. Set up an admin personal API key with only the project / query read permissions required by its query API. Find the numeric project ID in its URL.
3. Sentry → create a React project and a Python/FastAPI project. Copy each DSN. Create a reporting token with project/event read access. A separate build token with source-map upload permissions belongs only in Vercel build settings.
4. Add frontend, build and analytics reporting variables to Vercel. Keep the Python worker Sentry DSN on HF. Redeploy the changed services. Do not paste reporting tokens into the app or commit them.
5. Open your profile → Admin analytics. Verify each provider changes from Setup needed to Connected. Test a consented upload → generation → export and an intentional non-private test error in staging. Confirm the events/issues in the actual provider dashboards before calling tracking live.

## Vercel frontend public settings

- `VITE_POSTHOG_KEY`: public project ingestion key.
- `VITE_POSTHOG_HOST`: e.g. `https://us.i.posthog.com` or `https://eu.i.posthog.com` (use your project's provided host).
- `VITE_POSTHOG_REPLAY=1`: optional masked replay; leave unset to disable.
- `VITE_SENTRY_DSN`: public React/browser DSN.
- `VITE_APP_RELEASE`: build commit SHA, matching the Sentry release used for source maps.

## Vercel build-only secrets (never VITE_)

- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`: upload original source maps during the build. Maps are removed after upload. Builds without these settings ship no source maps.

## Backend secrets/configuration

- `BOL_ADMIN_USER_IDS`: comma-separated approved Supabase user UUIDs. Only JWT-verified identities are accepted. A workspace header, editable user metadata, or an email typed in the browser cannot grant access. Your current verified account is configured locally; production needs the same allowlist explicitly configured.
- `BOL_VERCEL_ANALYTICS_TOKEN`, `BOL_VERCEL_PROJECT_ID`, `BOL_VERCEL_TEAM_ID`: read Vercel Web Analytics. Project ID: `prj_cqKEr1liHnyyAH3hzmfxMddzN9X0`; team ID: `team_kuEY5MRcvscM6iPPY1sWAFTm`.
- `BOL_POSTHOG_PERSONAL_API_KEY`, `BOL_POSTHOG_PROJECT_ID`, `BOL_POSTHOG_API_HOST`: reporting API; API host is `https://us.posthog.com` / `https://eu.posthog.com`, separate from the ingestion host.
- `BOL_SENTRY_READ_TOKEN`, `BOL_SENTRY_ORG`, `BOL_SENTRY_PROJECT`: read up to 20 recent unresolved project issues. This is not a total crash counter.
- `BOL_SENTRY_DSN`: Python backend DSN; `BOL_ENVIRONMENT` and `BOL_APP_RELEASE` describe its environment/release.
- Optional `BOL_VERCEL_DASHBOARD_URL`, `BOL_POSTHOG_DASHBOARD_URL`, `BOL_SENTRY_DASHBOARD_URL`: direct project dashboard URLs. Defaults link to Vercel's project and the PostHog/Sentry account home until project URLs are configured. Supabase's link comes from its configured project URL. Links cannot carry secrets/query strings.

## Data and privacy

Vercel page views are anonymous and URLs lose query strings/hashes. PostHog waits for explicit analytics consent and has a preferences control for withdrawal. Automatic DOM-text event capture is off. Product event properties use a narrow allowlist: no filenames, captions, emails, account names, passwords, tokens, or uploaded file contents. Replay is off by default; when enabled, all inputs, text and attributes are masked; images, hidden/file inputs, auth/profile/admin screens, captions and media canvases are blocked. Network replay payloads are dropped. This deliberately reduces recording detail to protect private editing data.

Sentry removes request data, breadcrumbs, user data, extras and exception message values; stack traces remain for debugging. Backend errors also strip local variables. No Sentry replay is installed. Reported errors are not automatically crashes, and anonymous error monitoring is not an exact count of people affected.

Events: studio_opened, signup_completed (immediately authenticated signups only), upload_started/completed/failed, captions_started/completed/failed, export_started/completed/failed, panel_opened, preset_selected. PostHog funnels can be built from these; the admin overview displays counts, not a falsely deduplicated conversion funnel. Confirmed signups that finish through email are not yet counted as signup_completed.

Provider APIs use fixed/allowlisted hosts, bounded responses, eight-second timeouts, parallel queries and a 60-second cache. Secret tokens stay server-side. Errors show Unavailable without exposing upstream responses. Admin responses use `Cache-Control: private, no-store`.

## Dashboard structure and alternatives

The built-in overview has period selection, integration status, metrics/tables, and links to Vercel, PostHog, Sentry and Supabase. It summarizes APIs; it does not embed all session recordings, debugger UI, or database tools. Live API response shapes and plan access must be validated once reporting credentials exist.

Grafana with the Infinity datasource can query REST APIs and combine monitoring sources. It requires separate hosting/access control and the same provider credentials. Retool is an alternative for a broader internal operations/admin application. For Bol Studio, the built-in authenticated overview avoids maintaining a second admin application. Do not expose provider API tokens in a public Grafana/Retool dashboard.

References:
- https://vercel.com/docs/analytics/web-analytics-api
- https://posthog.com/docs/api
- https://posthog.com/docs/session-replay/privacy
- https://docs.sentry.io/api/events/list-a-projects-issues/
- https://grafana.com/docs/plugins/yesoreyeram-infinity-datasource/latest/
