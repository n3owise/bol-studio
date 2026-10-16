import { supabase } from '../lib/auth';
import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CONSENT_KEY, setAnalyticsUser, startErrorMonitoring, startProductAnalytics, stopProductAnalytics, telemetryEnabled } from '../lib/telemetry';

export function AnalyticsPrivacy() {
  const [choice, setChoice] = useState(() => localStorage.getItem(CONSENT_KEY));
  // Once the page is idle rather than on first paint: the error reporter is a
  // large download and nothing on screen needs it to draw.
  useEffect(() => {
    const start = () => void startErrorMonitoring();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authChanged = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      setAnalyticsUser(session?.user || null);
    });
    void supabase.auth.getSession().then(({data: sessionData}) => {
      if(active && !authChanged) setAnalyticsUser(sessionData.session?.user || null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (choice === 'granted') void startProductAnalytics(); else stopProductAnalytics(); }, [choice]);
  if (!telemetryEnabled) return null;
  const choose = (value: string) => { localStorage.setItem(CONSENT_KEY, value); setChoice(value); };
  return <>
    <Analytics beforeSend={event => {
      const url = new URL(event.url); url.search = ''; url.hash = '';
      return { ...event, url: url.toString() };
    }} />
    {import.meta.env.VITE_POSTHOG_KEY && !choice && <div className="analytics-consent" role="region" aria-label="Optional analytics">
      <p>Allow usage analytics linked to your account name and email to help improve Bol Studio? Inputs, captions and media previews are masked in recordings.</p>
      <button type="button" className="button secondary" onClick={() => choose('declined')}>No thanks</button>
      <button type="button" className="button primary" onClick={() => choose('granted')}>Allow analytics</button>
    </div>}
    {import.meta.env.VITE_POSTHOG_KEY && choice && <button type="button" className="analytics-preferences"
      onClick={() => { stopProductAnalytics(); localStorage.removeItem(CONSENT_KEY); setChoice(null); }}>Analytics preferences</button>}
  </>;
}
