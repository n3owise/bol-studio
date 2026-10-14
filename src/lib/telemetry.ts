import type { User } from '@supabase/supabase-js';
import type { PostHog } from 'posthog-js';

export const telemetryEnabled = import.meta.env?.PROD || import.meta.env?.VITE_TELEMETRY_DEV === '1';
let client: PostHog | null = null;
let starting: Promise<void> | null = null;
let monitoringStarted = false;
export const CONSENT_KEY = 'bol_analytics_consent_identified_v1';
let analyticsUser: User | null = null;
let identifiedUserId: string | null = null;
export function setAnalyticsUser(user: User | null) {
  analyticsUser = user;
  if (!client || localStorage.getItem(CONSENT_KEY) !== 'granted') return;
  if (identifiedUserId && identifiedUserId !== user?.id) client.reset();
  identifiedUserId = user?.id || null;
  if (user) {
    const name = user.user_metadata?.full_name;
    client.identify(user.id, { ...(typeof name === 'string' && name.trim() ? {name: name.trim()} : {}), ...(user.email ? {email: user.email} : {}) });
  }
}
export const telemetryEvents = ['studio_opened', 'signup_completed', 'panel_opened', 'upload_started', 'upload_completed', 'upload_failed', 'captions_started', 'captions_completed', 'captions_failed', 'export_started', 'export_completed', 'export_failed', 'preset_selected'] as const;
export type TelemetryEvent = typeof telemetryEvents[number];
const allowedProperties = new Set(['panel', 'preset', 'mode', 'resolution', 'fps', 'duration_seconds', 'elapsed_seconds', 'size_mb', 'media_type']);
export function cleanTelemetryProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => allowedProperties.has(key) &&
    (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value))));
}
export function trackEvent(event: TelemetryEvent, properties: Record<string, unknown> = {}) {
  if (!telemetryEnabled || localStorage.getItem(CONSENT_KEY) !== 'granted') return;
  client?.capture(event, cleanTelemetryProperties(properties));
}
export async function startProductAnalytics() {
  if (!telemetryEnabled || !import.meta.env.VITE_POSTHOG_KEY || localStorage.getItem(CONSENT_KEY) !== 'granted') return;
  if (client) { client.opt_in_capturing(); setAnalyticsUser(analyticsUser); if (import.meta.env.VITE_POSTHOG_REPLAY === '1') client.startSessionRecording(); return; }
  if (starting) return starting;
  starting = (async () => {
    const { default: posthog } = await import('posthog-js');
    if (localStorage.getItem(CONSENT_KEY) !== 'granted') return;
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_heatmaps: true,
      person_profiles: 'identified_only',
      disable_session_recording: import.meta.env.VITE_POSTHOG_REPLAY !== '1',
      session_recording: { maskAllInputs: true, maskTextSelector: '*', maskAllElementAttributes: true,
        blockSelector: 'img, video, canvas, input[type=hidden], input[type=file], .preview, .captions-list-container, .auth-screen, .profile-popup, .admin-analytics',
        captureJsonLd: false, recordCrossOriginIframes: false, recordHeaders: false, recordBody: false, maskCapturedNetworkRequestFn: () => null },
      property_denylist: ['$referrer', '$initial_referrer', '$initial_current_url', '$current_url', '$pathname', '$initial_pathname'],
      sanitize_properties: properties => {
        for (const key of Object.keys(properties)) if (/url|referrer/i.test(key)) delete properties[key];
        return properties;
      },
    });
    client = posthog;
    setAnalyticsUser(analyticsUser);
    posthog.capture('$pageview', { page: location.pathname === '/admin/analytics' ? 'admin' : 'studio' });
    trackEvent('studio_opened');
  })().catch(() => { /* Analytics must never interrupt editing. */ }).finally(() => { starting = null; });
  return starting;
}
export function stopProductAnalytics() { client?.opt_out_capturing(); client?.stopSessionRecording(); client?.reset(); identifiedUserId = null; }

export async function startErrorMonitoring() {
  if (!telemetryEnabled || !import.meta.env.VITE_SENTRY_DSN || monitoringStarted) return;
  monitoringStarted = true;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_RELEASE,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false }, tracesSampleRate: 0.1,
      integrations: defaults => defaults.filter(integration => !['Breadcrumbs', 'BrowserProfiling'].includes(integration.name)),
      beforeSend: event => {
        delete event.user; delete event.extra; delete event.breadcrumbs; delete event.request;
        if (event.exception?.values) for (const value of event.exception.values) value.value = 'Application error; inspect stack trace.';
        if (event.message) event.message = 'Application error';
        return event;
      },
    });
  } catch { monitoringStarted = false; /* Monitoring must never interrupt startup. */ }
}
