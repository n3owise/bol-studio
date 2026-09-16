import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Accounts, when this build has them.
 *
 * Unset — the local default — there is no client, no sign-in screen, and the app
 * falls back to the random workspace id the browser keeps in localStorage. Auth
 * switches on by being configured, the same bargain the API key makes, so
 * `npm run dev` needs no Supabase project to run the studio.
 *
 * Both values are public by design. The anon key is what supabase-js is built to
 * ship with; it identifies the project and authorises nothing on its own. The
 * service role key is a different thing entirely and must never appear in this
 * bundle or in any VITE_ variable, because Vite inlines those into public
 * JavaScript.
 */
const URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const AUTH_ENABLED = Boolean(URL && ANON_KEY);

export const supabase: SupabaseClient | null = AUTH_ENABLED
  ? createClient(URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/**
 * The current access token, kept here rather than read when needed.
 *
 * `supabase.auth.getSession()` is async, and the place that needs the token —
 * authHeaders in api.ts — is called synchronously from inside an XHR setup and
 * from JSX. Mirroring the token out of onAuthStateChange, which also fires when
 * supabase-js refreshes it in the background, is what lets that stay synchronous.
 */
let accessToken = '';
let userId = '';

export function currentAccessToken(): string {
  return accessToken;
}

/** The signed-in user's id, which is the owner the server will resolve to. */
export function currentUserId(): string {
  return userId;
}

export function rememberSession(session: Session | null): void {
  accessToken = session?.access_token ?? '';
  userId = session?.user?.id ?? '';
}

/**
 * Turn a Supabase error into something a person can act on.
 *
 * Their messages are written for developers — "Invalid login credentials",
 * "User already registered" — and a couple of them describe the wrong problem:
 * an unconfirmed account fails as though the password were wrong, which sends
 * people off to reset a password that was correct all along.
 */
export function authErrorMessage(error: { message?: string; code?: string } | null): string {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'That email and password do not match. Check both, or reset your password.';
  }
  if (code === 'email_not_confirmed' || /not confirmed/i.test(message)) {
    return 'Please open the confirmation link we emailed you before signing in.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'There is already an account with that email. Try signing in instead.';
  }
  if (code === 'weak_password' || /at least 6 characters/i.test(message)) {
    return 'Please choose a password of at least 8 characters.';
  }
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return 'Too many emails just now. Please wait a minute and try again.';
  }
  if (code === 'validation_failed' || /invalid.*email/i.test(message)) {
    return 'That does not look like an email address.';
  }
  if (/fetch|network/i.test(message)) {
    return 'Could not reach the sign-in service. Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

/** Long enough to be worth having, short enough that people will use it. */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return '';
}
