import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { Spinner } from '../components/bits.jsx';

export default function SignIn() {
  const { user, loading, refresh, signOut } = useUser();

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-8">
        <p className="eyebrow">Members</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">Sign in</h1>
      </header>
      {loading ? <Spinner /> : user ? <Account user={user} refresh={refresh} signOut={signOut} /> : (
        <>
          <GoogleButton />
          <RequestLink />
        </>
      )}
    </div>
  );
}

/**
 * Google's own button. Only drawn when an officer has set GOOGLE_CLIENT_ID;
 * otherwise the page is just the email form, as before.
 */
function GoogleButton() {
  const slot = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/config').then((r) => setClientId(r.googleClientId)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    const draw = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            await api.post('/auth/google', { credential });
            window.location.assign('/');
          } catch (err) {
            setError(err.message);
          }
        },
      });
      window.google.accounts.id.renderButton(slot.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 });
    };
    if (window.google?.accounts?.id) return void draw();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = draw;
    s.onerror = () => setError('Could not load Google sign-in on this network. Use the email link below.');
    document.head.appendChild(s);
    return undefined;
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="card mb-4 grid gap-3 p-6">
      <p className="eyebrow">Fastest</p>
      <div ref={slot} style={{ minHeight: 44, colorScheme: 'light' }} />
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Any Google account works, school or personal. We only read your name and email address.
      </p>
      {error && <p role="alert" className="text-sm" style={{ color: '#c42e2e' }}>{error}</p>}
      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>or get a link by email:</p>
    </div>
  );
}

function RequestLink() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // { devLink? }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/request', { email: email.trim(), ...(name.trim() && { name: name.trim() }) });
      if (res?.needName) setNeedName(true);
      else setSent(res ?? {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6">
        <h2 className="display text-xl font-bold">Check your inbox</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          We sent a sign-in link to <b style={{ color: 'var(--ink)' }}>{email}</b>. It works once and expires soon. Check
          spam if it does not show up in a minute.
        </p>
        {sent.devLink && (
          <p className="mono mt-4 rounded border p-3 text-xs" style={{ borderStyle: 'dashed' }}>
            Dev only:{' '}
            <a href={sent.devLink} style={{ color: 'var(--flag)', textDecoration: 'underline' }}>
              sign in now
            </a>
          </p>
        )}
        <button className="btn btn-ghost mt-5" onClick={() => setSent(null)}>
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card grid gap-4 p-6">
      <label className="grid gap-1.5">
        <span className="eyebrow">Email</span>
        <input
          className="field"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          Use a personal address. School <span className="mono">@mypisd.net</span> addresses are refused because the
          district blocks club mail.
        </span>
      </label>

      {needName && (
        <label className="grid gap-1.5">
          <span className="eyebrow">Display name</span>
          <input
            className="field"
            required
            autoFocus
            maxLength={40}
            autoComplete="name"
            placeholder="Shown on leaderboards"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            First time here. Pick the name you want classmates to see.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: '#c42e2e' }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Sending...' : needName ? 'Create account and send link' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}

function Account({ user, refresh, signOut }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch('/me', { name: name.trim() });
      await refresh();
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card grid gap-5 p-6">
      <div>
        <p className="eyebrow">Signed in as</p>
        {editing ? (
          <form onSubmit={save} className="mt-2 flex flex-wrap gap-2">
            <input
              className="field"
              style={{ flex: '1 1 12rem', width: 'auto' }}
              required
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Display name"
            />
            <button className="btn btn-primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <p className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="display text-2xl font-bold">{user.name}</span>
            <button className="mono text-xs underline" style={{ color: 'var(--ink-soft)' }} onClick={() => setEditing(true)}>
              rename
            </button>
          </p>
        )}
        {user.email && (
          <p className="mono mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
            {user.email}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm" style={{ color: '#c42e2e' }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-primary" to="/room" style={{ textDecoration: 'none' }}>
          Join a live room
        </Link>
        <Link className="btn btn-ghost" to="/learn" style={{ textDecoration: 'none' }}>
          Learn
        </Link>
        <Link className="btn btn-ghost" to="/projects" style={{ textDecoration: 'none' }}>
          Projects
        </Link>
      </div>

      <div className="border-t pt-4">
        <button className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
