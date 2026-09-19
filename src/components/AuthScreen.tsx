import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { authErrorMessage, MIN_PASSWORD_LENGTH, passwordProblem, supabase } from '../lib/auth';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';

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
    title: 'Log in',
    lede: 'Your captions are ready to move.',
    action: 'Let’s go',
    working: 'Signing in',
  },
  signup: {
    title: 'Sign up',
    lede: 'Captions that sound natural and move beautifully.',
    action: 'Create account',
    working: 'Creating your account',
  },
  forgot: {
    title: 'Reset password',
    lede: 'We will email you a link to set a new one.',
    action: 'Send reset link',
    working: 'Sending reset link',
  },
  recover: {
    title: 'New password',
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
 * One card, centred, in the flat-bordered style with hard offset shadows —
 * after uiverse.io/andrew-demchenk0/afraid-cougar-9, MIT, rebuilt on our own
 * tokens rather than its greys so it stays bol.studio in both themes.
 *
 * Log in and sign up are two faces of a card that turns between them, because
 * they are the same decision seen from two sides. The other three states are
 * not: reset, "check your inbox" and choosing a new password are places you go,
 * so they replace the card and the toggle goes away with them.
 *
 * 'recover' is the state that is easy to leave out: a password-reset link signs
 * the user in, so without a screen that asks for the new password they land in
 * the app with the old one still set and no way to reach the thing they clicked
 * the link for.
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
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  // The guard that actually prevents a double submission. `busy` is React
  // state, so two Enter presses inside one frame both read the stale `false`
  // and both fire; a ref is written synchronously and the second one sees it.
  const submitting = useRef(false);

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const clearErrors = () => {
    setNameError(''); setEmailError(''); setPasswordError(''); setFormError('');
  };

  // Clearing on a mode change stops "that password is too short" hanging over
  // the form the user turned the card to. The reveal resets too — leaving a
  // password on screen because the other face was showing one is not a decision
  // the reader made.
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

  async function submit(event: React.FormEvent, formMode: Mode) {
    event.preventDefault();
    if (!supabase || submitting.current) return;
    clearErrors();

    const wantsEmail = formMode !== 'recover';

    // Validated here rather than left to the browser so the message is ours and
    // sits in the same place as every other error on this form.
    if (formMode === 'signup' && !name.trim()) {
      setNameError('Please tell us what to call you.');
      return;
    }
    if (wantsEmail && !LOOKS_LIKE_EMAIL.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (formMode === 'signup' || formMode === 'recover') {
      const problem = passwordProblem(password);
      if (problem) { setPasswordError(problem); return; }
    }

    submitting.current = true;
    setBusy(true);
    try {
      if (formMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setFormError(authErrorMessage(error));
        // Success needs no branch: onAuthStateChange swaps this screen for the app.
      } else if (formMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // The name rides along in user metadata, which is where Supabase
          // puts anything the app asks for beyond the credentials. The account
          // button and the settings panel read it, falling back to the email
          // for accounts made before this field existed.
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
      } else if (formMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        // Whether an address has an account is not something to confirm to
        // whoever typed it, so this says the same thing either way.
        if (error && !/user not found/i.test(error.message)) setFormError(authErrorMessage(error));
        else go('sent');
      } else if (formMode === 'recover') {
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

  const strength = strengthOf(password);
  const flipped = mode === 'signup';
  const onCard = mode === 'signin' || mode === 'signup';

  /**
   * The turning card needs a height, because both faces are taken out of flow —
   * otherwise it collapses. Measuring the face that is showing, rather than
   * fixing a number, is what lets an error message or the strength meter push
   * the card open instead of being clipped by it.
   */
  const front = useRef<HTMLDivElement | null>(null);
  const back = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState<number>(0);

  useLayoutEffect(() => {
    if (!onCard) return;
    const measure = () => {
      const el = flipped ? back.current : front.current;
      if (el) setCardHeight(el.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    if (front.current) observer.observe(front.current);
    if (back.current) observer.observe(back.current);
    return () => observer.disconnect();
  }, [onCard, flipped]);

  /** Every form on this screen is the same handful of parts in a different order. */
  function renderForm(formMode: Mode) {
    const copy = COPY[formMode];
    const wantsEmail = formMode !== 'recover';
    const wantsPassword = formMode !== 'forgot';
    // Ids have to differ between the two faces of the card: both are mounted at
    // once, and a duplicate id points every label at whichever came first.
    const id = (part: string) => `auth-${formMode}-${part}`;

    return (
      <form className="auth-form" onSubmit={(e) => submit(e, formMode)} noValidate>
        <h1 className="auth-title">{copy.title}</h1>
        <p className="auth-lede">{copy.lede}</p>

        {formMode === 'signup' && (
          <div className="auth-field">
            <label htmlFor={id('name')}>Your name</label>
            <input
              id={id('name')}
              className={`auth-input${nameError ? ' has-error' : ''}`}
              type="text"
              value={name}
              autoComplete="name"
              required
              placeholder="Aman Verma"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? id('name-error') : undefined}
              onChange={edit(setName, setNameError)}
            />
            {nameError && (
              <p className="auth-field-error" id={id('name-error')}>
                <AlertCircle size={13} aria-hidden="true" />{nameError}
              </p>
            )}
          </div>
        )}

        {wantsEmail && (
          <div className="auth-field">
            <label htmlFor={id('email')}>Email</label>
            <input
              id={id('email')}
              className={`auth-input${emailError ? ' has-error' : ''}`}
              type="email"
              inputMode="email"
              value={email}
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? id('email-error') : undefined}
              onChange={edit(setEmail, setEmailError)}
            />
            {/* Icon as well as colour, and the text carries the whole message:
                somebody who cannot tell the red border from the ordinary one
                still gets told what is wrong. */}
            {emailError && (
              <p className="auth-field-error" id={id('email-error')}>
                <AlertCircle size={13} aria-hidden="true" />{emailError}
              </p>
            )}
          </div>
        )}

        {wantsPassword && (
          <div className="auth-field">
            <label htmlFor={id('password')}>Password</label>
            <div className="auth-secret">
              <input
                id={id('password')}
                className={`auth-input${passwordError ? ' has-error' : ''}`}
                type={reveal ? 'text' : 'password'}
                value={password}
                autoComplete={formMode === 'signin' ? 'current-password' : 'new-password'}
                required
                placeholder={formMode === 'signin' ? 'Your password' : `At least ${MIN_PASSWORD_LENGTH} characters`}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={
                  passwordError ? id('password-error')
                    : formMode !== 'signin' && touchedPassword ? id('strength')
                    : undefined
                }
                onFocus={() => setTouchedPassword(true)}
                onChange={edit(setPassword, setPasswordError)}
              />
              {/* Labelled by what pressing it does, not by what is on screen
                  now — a screen reader announcing "hide" on a masked field
                  describes the wrong state. */}
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
              <p className="auth-field-error" id={id('password-error')}>
                <AlertCircle size={13} aria-hidden="true" />{passwordError}
              </p>
            )}

            {/* Only once they have engaged with the field, and only where a new
                password is being chosen — there is nothing useful to say about
                a password that already exists. */}
            {formMode !== 'signin' && touchedPassword && !passwordError && (
              <p className="auth-strength" id={id('strength')}>
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

        {formMode === 'signin' && (
          <div className="auth-aside">
            <button type="button" onClick={() => go('forgot')}>Forgot your password?</button>
          </div>
        )}

        {/* Inline and persistent. notify() is a single-slot toast that clears
            itself after a few seconds, which is wrong for something the reader
            has to act on while they retype a field. */}
        {formError && (
          <p className="auth-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />{formError}
          </p>
        )}

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="auth-spinner" aria-hidden="true" />
              {copy.working}<span className="auth-ellipsis" aria-hidden="true">…</span>
            </>
          ) : (
            <>{copy.action}<ArrowRight size={16} aria-hidden="true" /></>
          )}
        </button>

        {formMode === 'forgot' && (
          <button type="button" className="auth-btn ghost" onClick={() => go('signin')}>
            Back to log in
          </button>
        )}

        {formMode === 'signup' && (
          <p className="auth-legal">
            By continuing, you agree to our{' '}
            {TERMS_URL ? <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> : <span>Terms</span>}{' '}
            and{' '}
            {PRIVACY_URL ? <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> : <span>Privacy Policy</span>}.
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="auth-screen">
      {/* The same control the navbar uses, left uncontrolled: in that mode it
          owns the whole switch — the data-theme attribute, both classes, the
          meta colour and the bol_theme key the boot script in index.html reads
          back on the next load. Nothing here reimplements any of that.

          It lives on this screen because the navbar's copy is inside App, which
          only mounts after sign-in: until now, somebody whose machine is set to
          dark had no way to reach light mode without signing in first. */}
      <AnimatedThemeToggler className="auth-theme-toggle" />

      <div className="auth-stage">
        <div className="auth-brand">
          {/* The real wordmark, in the same two-file light/dark pair the navbar
              uses. This was hand-set type that only looked like the logo — the
              letterforms were the app's display face, not the drawn mark. The
              second copy carries no alt text: two images of one wordmark would
              otherwise be announced twice, and only one of them is ever shown. */}
          <img
            src="/bol.studio.svg"
            alt="bol.studio"
            className="auth-logo logo-light-only"
            width={145}
            height={34}
          />
          <img
            src="/bol.studio-white.svg"
            alt=""
            aria-hidden="true"
            className="auth-logo logo-dark-only"
            width={145}
            height={34}
          />
          <span className="auth-tagline">Motion captions for creators.</span>
        </div>

        {onCard && (
          <div className="auth-switch">
            <span className={mode === 'signin' ? 'is-on' : ''}>Log in</span>
            <label className="auth-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={flipped}
                aria-label="Sign up instead"
                onChange={(e) => go(e.target.checked ? 'signup' : 'signin')}
              />
              <span className="auth-slider" aria-hidden="true" />
            </label>
            <span className={mode === 'signup' ? 'is-on' : ''}>Sign up</span>
          </div>
        )}

        {onCard ? (
          <div className="auth-flip" style={cardHeight ? { height: cardHeight } : undefined}>
            <div className={`auth-flip-inner${flipped ? ' is-flipped' : ''}`}>
              {/* The face that is turned away is still in the document, so it is
                  still tabbable and still read aloud unless it is made inert.
                  Without this, tabbing off the log-in password lands in a sign-up
                  form nobody can see. */}
              <div className="auth-face front" ref={front} inert={flipped || undefined}>
                {renderForm('signin')}
              </div>
              <div className="auth-face back" ref={back} inert={!flipped || undefined}>
                {renderForm('signup')}
              </div>
            </div>
          </div>
        ) : mode === 'sent' ? (
          <div className="auth-card auth-sent">
            <MailCheck size={26} className="auth-sent-icon" aria-hidden="true" />
            <h1 className="auth-title">{COPY.sent.title}</h1>
            <p className="auth-lede">
              If an account exists for <strong>{email.trim()}</strong>, we have sent it a link.
              Open it to finish, then come back here.
            </p>
            <p className="auth-hint">It can take a minute, and it sometimes lands in spam.</p>
            <button type="button" className="auth-btn ghost" onClick={() => go('signin')}>
              Back to log in
            </button>
          </div>
        ) : (
          <div className="auth-card">{renderForm(mode)}</div>
        )}
      </div>
    </div>
  );
};
