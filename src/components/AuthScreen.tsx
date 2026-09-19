import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, User } from 'lucide-react';
import { authErrorMessage, MIN_PASSWORD_LENGTH, passwordProblem, supabase } from '../lib/auth';
import { CaptionDemo } from './CaptionDemo';

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'recover';

/**
 * Terms and Privacy, when this deployment has them.
 *
 * Configured-on, the same bargain auth itself makes. The acknowledgment is
 * shown either way — it is a statement about what creating an account means,
 * not about whether a URL is set — but it only becomes a link when there is
 * something real on the end of it. A hyperlink to a 404 on a legal line is
 * worse than plain text saying the same thing.
 */
const TERMS_URL = (import.meta.env.VITE_TERMS_URL || '').trim();
const PRIVACY_URL = (import.meta.env.VITE_PRIVACY_URL || '').trim();

/**
 * Which demo to mount. Rendering both and hiding one with CSS would leave a
 * second animation loop running behind `display: none` for the life of the
 * screen, burning a frame budget nobody can see.
 */
function useWideLayout(): boolean {
  const [wide, setWide] = useState(
    () => window.matchMedia?.('(min-width: 980px)').matches ?? true,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 980px)');
    if (!query) return;
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/** Deliberately permissive: the server and the mailbox are the real validators. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Advice, not a rule. The only requirement the backend enforces is a length,
 * so this never blocks a submission and never claims a character class is
 * needed — inventing requirements is how people end up with a password they
 * cannot remember and a product they blame for it.
 */
function strengthOf(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (password.length < MIN_PASSWORD_LENGTH) return { score: 0, label: 'Too short' };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 14 && variety >= 3) return { score: 3, label: 'Strong' };
  if (password.length >= 11 || variety >= 3) return { score: 2, label: 'Good' };
  return { score: 1, label: 'Fair' };
}

const COPY: Record<Mode, { title: string; lede: string; action: string; working: string }> = {
  signin: {
    title: 'Welcome back',
    lede: 'Your captions are ready to move.',
    action: 'Sign in',
    working: 'Signing in',
  },
  signup: {
    title: 'Create your account',
    lede: 'Captions that sound natural and move beautifully.',
    action: 'Create account',
    working: 'Creating your account',
  },
  forgot: {
    title: 'Reset your password',
    lede: 'We will email you a link to set a new one.',
    action: 'Send reset link',
    working: 'Sending reset link',
  },
  recover: {
    title: 'Choose a new password',
    lede: 'Almost done — pick something you will remember.',
    action: 'Save and continue',
    working: 'Saving',
  },
  sent: { title: 'Check your inbox', lede: '', action: '', working: '' },
};

/**
 * The sign-in gate.
 *
 * Deliberately not a Modal: a modal is something you dismiss back to what is
 * behind it, and there is nothing behind this.
 *
 * Two columns on a desktop — form left, a running demonstration of the product
 * right. The right panel is not decoration: somebody who has never used this
 * should learn what it makes while they are typing their password.
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);

  // Three separate places an error can live, because they are three different
  // problems. A field error belongs beside the field; a form error belongs
  // above the button; and they must not overwrite each other, or fixing the
  // email silently erases "we could not reach the server".
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  // The guard that actually prevents a double submission. `busy` is React
  // state, so two Enter presses inside one frame both read the stale `false`
  // and both fire; a ref is written synchronously and the second one sees it.
  const submitting = useRef(false);
  const wide = useWideLayout();

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const clearErrors = () => { setEmailError(''); setPasswordError(''); setFormError(''); };

  // Clearing on a mode change stops "that password is too short" hanging over
  // the sign-in form the user switched to. The reveal resets too — leaving a
  // password on screen because a different form was showing one is not a
  // decision the reader made.
  const go = (next: Mode) => {
    setMode(next);
    clearErrors();
    setReveal(false);
    setTouchedPassword(false);
  };

  // And clearing as they type stops an error hanging over the field they are
  // fixing. An error that outlives the mistake reads as a second, unrelated
  // failure — "passwords need at least 8 characters" sitting above an
  // eighteen-character password is worse than no message at all.
  const edit = (set: (value: string) => void, clear: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      set(event.target.value);
      clear('');
      if (formError) setFormError('');
    };

  const strength = strengthOf(password);
  const wantsPassword = mode !== 'forgot';
  const wantsEmail = mode !== 'recover';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || submitting.current) return;
    clearErrors();

    // Validated here rather than left to the browser so the message is ours and
    // sits in the same place as every other error on this form.
    if (wantsEmail && !LOOKS_LIKE_EMAIL.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (mode === 'signup' || mode === 'recover') {
      const problem = passwordProblem(password);
      if (problem) { setPasswordError(problem); return; }
    }

    submitting.current = true;
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setFormError(authErrorMessage(error));
        // Success needs no branch: onAuthStateChange swaps this screen for the app.
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // The name rides along in user metadata, which is where Supabase puts
          // anything beyond the credentials. It is optional: the account button
          // and the settings panel show it when it is there and fall back to the
          // email when it is not, so asking for it costs nobody a signup.
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim() },
          },
        });
        if (error) setFormError(authErrorMessage(error));
        // Whether a confirmation email is coming is a Supabase setting, not
        // something this screen can assume. With confirmation required, signUp
        // returns no session and the link is the next step; with it switched
        // off, it returns one and the account is already usable — announcing an
        // email then would promise something that never arrives. The session
        // itself is the signal, so this reads correctly either way and the
        // setting can be changed without touching the code.
        else if (!data.session) go('sent');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        // Whether an address has an account is not something to confirm to
        // whoever typed it, so this says the same thing either way.
        if (error && !/user not found/i.test(error.message)) setFormError(authErrorMessage(error));
        else go('sent');
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setFormError(authErrorMessage(error));
      }
    } catch (thrown) {
      setFormError(authErrorMessage(thrown as { message?: string }));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const copy = COPY[mode];

  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <div className="auth-pane">
          <div className="auth-brand">
            <span className="auth-wordmark">bol<span>.studio</span></span>
            <span className="auth-tagline">Motion captions for creators.</span>
          </div>

          {/* On a phone the demo moves above the form as a compact strip: small
              enough that the form is still the first thing in reach, present
              enough that the product introduces itself. */}
          {!wide && <div className="auth-demo-compact"><CaptionDemo compact /></div>}

          {mode === 'sent' ? (
            <div className="auth-sent">
              <MailCheck size={26} className="auth-sent-icon" aria-hidden="true" />
              <h1>{copy.title}</h1>
              <p className="auth-lede">
                If an account exists for <strong>{email.trim()}</strong>, we have sent it a link.
                Open it to finish, then come back here.
              </p>
              <p className="auth-hint">It can take a minute, and it sometimes lands in spam.</p>
              <button type="button" className="auth-submit ghost" onClick={() => go('signin')}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              <h1>{copy.title}</h1>
              <p className="auth-lede">{copy.lede}</p>

              {mode === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-name">Full name <span className="auth-optional">optional</span></label>
                  <div className="auth-control">
                    <User size={15} className="auth-control-icon" aria-hidden="true" />
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      autoComplete="name"
                      autoFocus
                      placeholder="Aman Verma"
                      onChange={edit(setName, () => {})}
                    />
                  </div>
                </div>
              )}

              {wantsEmail && (
                <div className="auth-field">
                  <label htmlFor="auth-email">Email</label>
                  <div className={`auth-control${emailError ? ' has-error' : ''}`}>
                    <Mail size={15} className="auth-control-icon" aria-hidden="true" />
                    <input
                      id="auth-email"
                      type="email"
                      inputMode="email"
                      value={email}
                      autoComplete="email"
                      autoFocus={mode !== 'signup'}
                      required
                      placeholder="you@example.com"
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? 'auth-email-error' : undefined}
                      onChange={edit(setEmail, setEmailError)}
                    />
                  </div>
                  {/* Icon as well as colour, and the text carries the whole
                      message: somebody who cannot tell the red border from the
                      grey one still gets told what is wrong. */}
                  {emailError && (
                    <p className="auth-field-error" id="auth-email-error">
                      <AlertCircle size={13} aria-hidden="true" />{emailError}
                    </p>
                  )}
                </div>
              )}

              {wantsPassword && (
                <div className="auth-field">
                  <label htmlFor="auth-password">Password</label>
                  <div className={`auth-control${passwordError ? ' has-error' : ''}`}>
                    <Lock size={15} className="auth-control-icon" aria-hidden="true" />
                    <input
                      id="auth-password"
                      type={reveal ? 'text' : 'password'}
                      value={password}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      autoFocus={mode === 'recover'}
                      required
                      placeholder={mode === 'signin' ? '' : `At least ${MIN_PASSWORD_LENGTH} characters`}
                      aria-invalid={passwordError ? true : undefined}
                      aria-describedby={
                        passwordError ? 'auth-password-error'
                          : mode !== 'signin' && touchedPassword ? 'auth-password-strength'
                          : undefined
                      }
                      onFocus={() => setTouchedPassword(true)}
                      onChange={edit(setPassword, setPasswordError)}
                    />
                    {/* Labelled by what pressing it does, not by what is on
                        screen now — a screen reader announcing "hide" on a
                        masked field describes the wrong state. */}
                    <button
                      type="button"
                      className="auth-reveal"
                      onClick={() => setReveal((on) => !on)}
                      aria-label={reveal ? 'Hide password' : 'Show password'}
                      aria-pressed={reveal}
                      title={reveal ? 'Hide password' : 'Show password'}
                    >
                      {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {passwordError && (
                    <p className="auth-field-error" id="auth-password-error">
                      <AlertCircle size={13} aria-hidden="true" />{passwordError}
                    </p>
                  )}

                  {/* Only once they have engaged with the field, and only where
                      a new password is being chosen — there is nothing useful to
                      say about a password that already exists. */}
                  {mode !== 'signin' && touchedPassword && !passwordError && (
                    <p className="auth-strength" id="auth-password-strength">
                      <span className="auth-strength-bars" aria-hidden="true">
                        {[1, 2, 3].map((step) => (
                          <span key={step} className={step <= strength.score ? 'is-on' : ''} />
                        ))}
                      </span>
                      {password ? strength.label : `At least ${MIN_PASSWORD_LENGTH} characters`}
                    </p>
                  )}
                </div>
              )}

              {mode === 'signin' && (
                <div className="auth-aside">
                  <button type="button" onClick={() => go('forgot')}>Forgot your password?</button>
                </div>
              )}

              {/* Inline and persistent. notify() is a single-slot toast that
                  clears itself after a few seconds, which is wrong for something
                  the reader has to act on while they retype a field. */}
              {formError && (
                <p className="auth-error" role="alert">
                  <AlertCircle size={15} aria-hidden="true" />{formError}
                </p>
              )}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={15} className="auth-spinner" aria-hidden="true" />
                    {copy.working}<span className="auth-ellipsis" aria-hidden="true">…</span>
                  </>
                ) : (
                  <>{copy.action}<ArrowRight size={16} aria-hidden="true" /></>
                )}
              </button>

              <div className="auth-switch">
                {mode === 'signin' && (
                  <span>
                    New here? <button type="button" onClick={() => go('signup')}>Create an account</button>
                  </span>
                )}
                {mode === 'signup' && (
                  <span>
                    Already have an account? <button type="button" onClick={() => go('signin')}>Sign in</button>
                  </span>
                )}
                {mode === 'forgot' && (
                  <span>
                    Remembered it? <button type="button" onClick={() => go('signin')}>Back to sign in</button>
                  </span>
                )}
              </div>

              {mode === 'signup' && (
                <p className="auth-legal">
                  By continuing, you agree to our{' '}
                  {TERMS_URL
                    ? <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a>
                    : <span>Terms</span>}{' '}
                  and{' '}
                  {PRIVACY_URL
                    ? <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>
                    : <span>Privacy Policy</span>}.
                </p>
              )}
            </form>
          )}
        </div>

        {wide && (
          <div className="auth-demo-panel">
            <CaptionDemo />
          </div>
        )}
      </div>
    </div>
  );
};
