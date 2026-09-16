import React, { useEffect, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { authErrorMessage, passwordProblem, supabase } from '../lib/auth';

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'recover';

/**
 * The sign-in gate.
 *
 * Deliberately not a Modal: a modal is something you dismiss back to what is
 * behind it, and there is nothing behind this. The classes are borrowed from
 * the modal styles so it reads as the same family of surface.
 *
 * Five states rather than three. 'sent' exists because "we emailed you" is a
 * real place a person waits, and showing it as a toast over an empty form
 * invites them to keep typing. 'recover' is the one that is easy to leave out:
 * a password-reset link signs the user in, so without a screen that asks for
 * the new password they land in the app with the old one still set and no way
 * to reach the thing they clicked the link for.
 */
export const AuthScreen: React.FC<{ initialMode?: Mode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<Mode>(initialMode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  // Clearing on a mode change stops "that password is too short" hanging over
  // the sign-in form the user switched to.
  const go = (next: Mode) => { setMode(next); setError(''); };

  // And clearing as they type stops it hanging over the field they are fixing.
  // An error that outlives the mistake reads as a second, unrelated failure —
  // "passwords need at least 8 characters" sitting above an eighteen-character
  // password is worse than no message at all.
  const edit = (set: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    set(event.target.value);
    if (error) setError('');
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setError('');

    if (mode === 'signup' || mode === 'recover') {
      const problem = passwordProblem(password);
      if (problem) { setError(problem); return; }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(authErrorMessage(error));
        // Success needs no branch: onAuthStateChange swaps this screen for the app.
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setError(authErrorMessage(error));
        else go('sent');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        // Whether an address has an account is not something to confirm to
        // whoever typed it, so this says the same thing either way.
        if (error && !/user not found/i.test(error.message)) setError(authErrorMessage(error));
        else go('sent');
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setError(authErrorMessage(error));
      }
    } catch (thrown) {
      setError(authErrorMessage(thrown as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'sent') {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card-sent">
          <MailCheck size={30} className="auth-sent-icon" />
          <h1>Check your email</h1>
          <p className="auth-lede">
            We sent a link to <strong>{email}</strong>. Open it to finish, then come back here.
          </p>
          <p className="auth-footnote">
            Nothing yet? It can take a minute, and it sometimes lands in spam.
          </p>
          <button type="button" className="button secondary full" onClick={() => go('signin')}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const copy = {
    signin: { title: 'Sign in', action: 'Sign in', lede: 'Your captions, wherever you left them.' },
    signup: { title: 'Create an account', action: 'Create account', lede: 'Captions for Hinglish, Hindi and English video.' },
    forgot: { title: 'Reset your password', action: 'Send the link', lede: 'We will email you a link to set a new one.' },
    recover: { title: 'Choose a new password', action: 'Save and continue', lede: 'Almost done — pick something you will remember.' },
  }[mode];

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">bol<span>.studio</span></div>
        <h1>{copy.title}</h1>
        <p className="auth-lede">{copy.lede}</p>

        {mode !== 'recover' && (
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              onChange={edit(setEmail)}
            />
          </label>
        )}

        {mode !== 'forgot' && (
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              autoFocus={mode === 'recover'}
              required
              placeholder={mode === 'signin' ? '' : 'At least 8 characters'}
              onChange={edit(setPassword)}
            />
          </label>
        )}

        {/* Inline and persistent. notify() is a single-slot toast that clears
            itself after a few seconds, which is wrong for something the reader
            has to act on while they retype a field. */}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="button primary full" disabled={busy}>
          {busy ? <Loader2 size={14} className="auth-spinner" /> : null}
          {busy ? 'Working…' : copy.action}
        </button>

        <div className="auth-switch">
          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => go('forgot')}>Forgot your password?</button>
              <span>
                New here? <button type="button" onClick={() => go('signup')}>Create an account</button>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span>
              Already have one? <button type="button" onClick={() => go('signin')}>Sign in</button>
            </span>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => go('signin')}>Back to sign in</button>
          )}
        </div>

        {/* Said here rather than discovered later. Accounts persist; the clips
            do not yet, and someone who signs in expecting to find last week's
            upload should hear it from us first. */}
        {mode !== 'recover' && (
          <p className="auth-footnote">
            Projects are saved to your account. Cloud storage is temporary for now —
            export anything you want to keep.
          </p>
        )}
      </form>
    </div>
  );
};
