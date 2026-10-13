import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CONSENT_KEY, startErrorMonitoring, startProductAnalytics, stopProductAnalytics, telemetryEnabled } from '../lib/telemetry';

export function AnalyticsPrivacy() {
  const [choice, setChoice] = useState(() => localStorage.getItem(CONSENT_KEY));
  useEffect(() => { void startErrorMonitoring(); }, []);
  useEffect(() => { if (choice === 'granted') void startProductAnalytics(); else stopProductAnalytics(); }, [choice]);
  if (!telemetryEnabled) return null;
  const choose = (value: string) => { localStorage.setItem(CONSENT_KEY, value); setChoice(value); };
  return <>
    <Analytics beforeSend={event => {
      const url = new URL(event.url); url.search = ''; url.hash = '';
      return { ...event, url: url.toString() };
    }} />
    {import.meta.env.VITE_POSTHOG_KEY && !choice && <div className="analytics-consent" role="region" aria-label="Optional analytics">
      <p>Allow anonymous usage analytics to help improve Bol Studio? Inputs, captions and media previews are masked in recordings.</p>
      <button type="button" className="button secondary" onClick={() => choose('declined')}>No thanks</button>
      <button type="button" className="button primary" onClick={() => choose('granted')}>Allow analytics</button>
    </div>}
    {import.meta.env.VITE_POSTHOG_KEY && choice && <button type="button" className="analytics-preferences"
      onClick={() => { stopProductAnalytics(); localStorage.removeItem(CONSENT_KEY); setChoice(null); }}>Analytics preferences</button>}
  </>;
}
