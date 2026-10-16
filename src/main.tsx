import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './styles.css';
import './mobile.css';
import { AnalyticsPrivacy } from './components/AnalyticsPrivacy';
import { TargetCursor } from './components/TargetCursor';
import { AdminAnalytics } from './components/AdminAnalytics';
import { AuthScreen } from './components/AuthScreen';
import { AUTH_ENABLED, rememberSession, supabase } from './lib/auth';
import { forgetMediaTokens } from './lib/api';
import type { Session } from '@supabase/supabase-js';

/**
 * The editor, fetched only once someone is through the sign-in gate, so the
 * login screen does not download the video engine and the whole studio first.
 */
const App = lazy(() => import('./Studio'));

/**
 * Sign-in, before the studio exists.
 *
 * A wrapper rather than a branch inside App, because App's startup effects run
 * on mount whatever the render returns — it fetches limits, health and the
 * project list, then polls every seven seconds. Returning a login form from
 * inside it would leave all of that running against a backend that answers 401.
 *
 * Unconfigured, this is not in the way at all: no client, no gate, straight to
 * the studio with the browser's own workspace id, exactly as before.
 */
function Root() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [ready, setReady] = React.useState(!AUTH_ENABLED);
  // A password-reset link signs the user in and then needs to ask for the new
  // password. Without catching this the reset lands them in the editor with the
  // old password still set and nothing to show for the link they clicked.
  const [recovering, setRecovering] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      rememberSession(data.session);
      setSession(data.session);
      setReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      rememberSession(next);
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'USER_UPDATED') setRecovering(false);
      if (event === 'SIGNED_OUT') forgetMediaTokens();
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="auth-screen" aria-busy="true" />;
  if (AUTH_ENABLED && !session) return <AuthScreen/>;
  if (recovering) return <AuthScreen initialMode="recover"/>;
  // Keyed on the account so signing in as someone else builds a new editor.
  // Without it the previous user's project, words and media stay mounted, and
  // one person's clip renders under another person's session.
  if (window.location.pathname === '/admin/analytics') return <AdminAnalytics/>;
  return <Suspense fallback={<div className="auth-screen" aria-busy="true" />}>
    <App key={session?.user?.id ?? 'local'}/>
    {/* The bracket cursor is an editor flourish; the sign-in form goes without it. */}
    <TargetCursor/>
  </Suspense>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/><AnalyticsPrivacy/></React.StrictMode>);
