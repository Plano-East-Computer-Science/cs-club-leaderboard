/**
 * Sign in, and the account settings behind it.
 *
 * Signed out: why the wall exists and the one button through it.
 * Signed in: the personal email for club updates, and nothing else -- there is
 * no profile to fill in, because the roster already lives in the database.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Spinner } from '../components/bits.jsx';

const ERRORS = {
  state: 'That sign-in link expired or was tampered with. Try again.',
  unconfigured: 'Google sign-in is not switched on yet. Ask an officer.',
  exchange: 'Google would not complete the sign-in. Try again.',
  token: 'Google sent something we could not read. Try again.',
  unverified: 'That Google account has an unverified email address.',
  domain: 'Use your school account — the one ending in @mypisd.net.',
};

/**
 * The wall itself. Rendered in place of any gated page, so the reason is
 * always attached to the thing the person was trying to reach.
 */
export function SignInPrompt({ what = 'this page' }) {
  const { loading, configured, devLogin } = useAuth();
  const [params] = useSearchParams();
  const error = ERRORS[params.get('error')];

  if (loading) return <Spinner label="Checking your sign-in" />;

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="eyebrow">Members only</p>
      <h1 className="display mt-2 text-2xl font-extrabold">Sign in to see {what}.</h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
        The standings name real students, so they are not open to the internet. Anyone with a Plano
        ISD <span className="mono">@mypisd.net</span> account can get in — one click, no password to
        make up.
      </p>

      {error && (
        <p className="mono mt-4 text-xs" style={{ color: '#c42e2e' }}>
          {error}
        </p>
      )}

      {configured && (
        <a className="btn btn-primary mt-6" href="/api/auth/start" style={{ textDecoration: 'none' }}>
          Continue with school Google
        </a>
      )}
      {!configured && !devLogin && (
        <p className="mono mt-6 text-xs" style={{ color: '#c42e2e' }}>
          Sign-in is not switched on yet. An officer needs to add the Google client ID.
        </p>
      )}
      {devLogin && <DevSignIn />}

      <p className="mono mt-6 border-t pt-4 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
        Still open to everyone:{' '}
        <Link to="/join" style={{ color: 'var(--flag)' }}>
          Join
        </Link>
        ,{' '}
        <Link to="/about" style={{ color: 'var(--flag)' }}>
          About
        </Link>
        ,{' '}
        <Link to="/curriculum" style={{ color: 'var(--flag)' }}>
          Curriculum
        </Link>
        ,{' '}
        <Link to="/competitions" style={{ color: 'var(--flag)' }}>
          Competitions
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Only appears when Google sign-in is unconfigured, which is only ever true
 * locally. The endpoint behind it 404s unless DEV_LOGIN_SECRET is set, and
 * that variable exists only in the gitignored .dev.vars -- so this is inert
 * even if it somehow rendered on the live site.
 */
function DevSignIn() {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', secret: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/dev-login', form);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 grid gap-2 text-left">
      <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
        Local testing only:
      </p>
      <input
        className="field"
        type="email"
        placeholder="you@mypisd.net"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className="field"
        type="password"
        placeholder="DEV_LOGIN_SECRET"
        value={form.secret}
        onChange={(e) => setForm({ ...form, secret: e.target.value })}
        required
      />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in locally'}
      </button>
      {error && (
        <p className="mono text-xs" style={{ color: '#c42e2e' }}>
          {error}
        </p>
      )}
    </form>
  );
}

/* -------------------------------- account --------------------------------- */

export default function SignIn() {
  const { loading, authed, member, refresh } = useAuth();

  if (loading) return <Spinner label="Checking your sign-in" />;
  if (!authed) return <SignInPrompt what="the members' side" />;
  return <Account member={member} refresh={refresh} />;
}

function Account({ member, refresh }) {
  const [personal, setPersonal] = useState(member.personal_email || '');
  const [optIn, setOptIn] = useState(member.email_opt_in);
  const [state, setState] = useState({ busy: false, saved: false, error: null });

  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, saved: false, error: null });
    try {
      await api.put('/auth/prefs', { personal_email: personal, email_opt_in: optIn });
      await refresh();
      setState({ busy: false, saved: true, error: null });
    } catch (err) {
      setState({ busy: false, saved: false, error: err.message });
    }
  };

  const signOut = async () => {
    await api.post('/auth/logout');
    await refresh();
  };

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-8">
        <p className="eyebrow">Your account</p>
        <h1 className="display mt-2 text-[clamp(2rem,5vw,3rem)] leading-[0.95] font-extrabold">
          Signed in.
        </h1>
        <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {member.school_email}
        </p>
      </header>

      <form onSubmit={save} className="card grid gap-4 p-6">
        <div>
          <h2 className="display text-base font-bold">Club updates</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            One email a week, only when something actually happened: points awarded, new
            opportunities, deadlines inside two weeks. Unsubscribe is one click in every message.
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="mono text-[0.7rem] font-semibold" style={{ color: 'var(--ink-soft)' }}>
            Personal email
          </span>
          <input
            className="field"
            type="email"
            placeholder="you@gmail.com"
            value={personal}
            onChange={(e) => setPersonal(e.target.value)}
          />
          <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
            Not your school address — the district's filter blocks club mail before it arrives.
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          Email me the weekly club update.
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={state.busy}>
            {state.busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
          {state.saved && (
            <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
              Saved.
            </span>
          )}
          {state.error && (
            <span className="mono text-xs" style={{ color: '#c42e2e' }}>
              {state.error}
            </span>
          )}
        </div>
      </form>

      <p className="mono mt-4 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
        Your private calendar feed lives on the{' '}
        <Link to="/calendar" style={{ color: 'var(--flag)' }}>
          calendar page
        </Link>
        .
      </p>
    </div>
  );
}
