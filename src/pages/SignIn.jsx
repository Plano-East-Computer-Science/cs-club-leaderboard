import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { Spinner } from '../components/bits.jsx';
import CodeforcesPanel from '../components/CodeforcesPanel.jsx';
import PrivacyPanel from '../components/PrivacyPanel.jsx';

/** Seconds between sign-in emails to one address; the server enforces the same. */
const RESEND_S = 60;

export default function SignIn() {
  const { user, loading, refresh, signOut } = useUser();

  return (
    <div className="si">
      {loading ? <Spinner /> : user ? (
        <>
          <header className="si-head">
            <p className="eyebrow">Your account</p>
            <h1 className="si-title">Signed in</h1>
          </header>
          <Account user={user} refresh={refresh} signOut={signOut} />
        </>
      ) : (
        <SignInFlow refresh={refresh} />
      )}
    </div>
  );
}

/**
 * One flow: Google if it is switched on, else (or as well) an email with a
 * 6-digit code and a link. The code finishes sign-in here, on the device that
 * asked; the link signs in whichever device opens it.
 */
function SignInFlow({ refresh }) {
  const [sent, setSent] = useState(null); // { email, name, devCode?, devLink?, retryIn }

  // The link may be opened in another tab of this browser: notice when this tab comes back.
  useEffect(() => {
    if (!sent) return undefined;
    const back = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [sent, refresh]);

  return (
    <div className="si-card">
      {sent ? (
        <CheckEmail sent={sent} onResent={(r) => setSent({ ...sent, ...r })} onBack={() => setSent(null)} />
      ) : (
        <>
          <header className="si-head">
            <p className="eyebrow">Members</p>
            <h1 className="si-title">Sign in</h1>
            <p className="si-lede">New here? Same steps. Your account is made the first time you sign in.</p>
          </header>
          <GoogleButton />
          <RequestEmail onSent={setSent} />
        </>
      )}
    </div>
  );
}

/**
 * Google's own button. Only drawn when GOOGLE_CLIENT_ID is set on the Worker;
 * otherwise the page is just the email form.
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
      const width = Math.min(400, slot.current.offsetWidth || 320);
      window.google.accounts.id.renderButton(slot.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width });
    };
    if (window.google?.accounts?.id) return void draw();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = draw;
    s.onerror = () => setError('Google sign-in did not load on this network. Use email below.');
    document.head.appendChild(s);
    return undefined;
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="si-google">
      <div ref={slot} className="si-gslot" />
      {error && <p role="alert" className="si-err">{error}</p>}
      <p className="si-or"><span>or use email</span></p>
    </div>
  );
}

function RequestEmail({ onSent }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const addr = email.trim();
      const res = await api.post('/auth/request', { email: addr, ...(name.trim() && { name: name.trim() }) });
      onSent({ email: addr, name: name.trim(), ...res, retryIn: res?.retryIn ?? RESEND_S });
    } catch (err) {
      // A new address comes back as a 400 asking for a name: show the name box, not an error.
      if (err.data?.needName) setNeedName(true);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="si-form">
      <label className="si-field">
        <span>Email</span>
        <input
          className="field"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setNeedName(false); }}
          aria-describedby="si-email-hint"
        />
        <small id="si-email-hint">A personal address. School <span className="mono">@mypisd.net</span> mail blocks club email.</small>
      </label>

      {needName && (
        <label className="si-field si-new">
          <span>Display name</span>
          <input
            className="field"
            required
            autoFocus
            minLength={2}
            maxLength={40}
            autoComplete="name"
            placeholder="Shown on leaderboards"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <small>First time with this address. Pick the name classmates will see.</small>
        </label>
      )}

      {error && <p role="alert" className="si-err">{error}</p>}
      <button className="btn btn-primary si-go" disabled={busy}>
        {busy ? 'Sending...' : needName ? 'Create account and email me' : 'Email me a sign-in code'}
      </button>
    </form>
  );
}

function CheckEmail({ sent, onResent, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [wait, setWait] = useState(sent.retryIn);
  const [note, setNote] = useState('');
  const input = useRef(null);

  useEffect(() => setWait(sent.retryIn), [sent]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(value) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/code', { email: sent.email, code: value });
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setExpired(Boolean(err.data?.expired));
      setCode('');
      input.current?.focus();
      setBusy(false);
    }
  }

  function type(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  }

  async function resend() {
    setNote('');
    setError('');
    try {
      const res = await api.post('/auth/request', { email: sent.email, ...(sent.name && { name: sent.name }) });
      setExpired(false);
      setNote(res?.cooldown ? 'The last email is still on its way.' : 'New email sent. Use the newest code.');
      onResent({ ...res, retryIn: res?.retryIn ?? RESEND_S });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="si-check" aria-live="polite">
      <header className="si-head">
        <p className="eyebrow">Step 2 of 2</p>
        <h1 className="si-title">Check your email</h1>
        <p className="si-lede">
          We sent a code to <b>{sent.email}</b>. It can take a minute. Look in spam if it is not there.
        </p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); verify(code); }} className="si-form">
        <label className="si-field">
          <span>6-digit code</span>
          <input
            ref={input}
            className="field si-code"
            autoFocus
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={7}
            placeholder="000000"
            value={code}
            onChange={type}
            readOnly={busy}
          />
        </label>
        {error && <p role="alert" className="si-err">{error}</p>}
        <button className="btn btn-primary si-go" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="si-alt">
        Email open on another device? Type the code here to sign in on this screen. The button in the email signs in
        whichever device you tap it on.
      </p>

      {sent.devCode && (
        <p className="si-dev mono">
          Dev only: code <b>{sent.devCode}</b> or <a href={sent.devLink}>open the link</a>
        </p>
      )}

      <div className="si-foot">
        <button type="button" className={`btn ${expired ? 'btn-primary' : 'btn-ghost'}`} onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Resend in ${wait}s` : 'Send a new code'}
        </button>
        <button type="button" className="si-link" onClick={onBack}>
          Use a different address
        </button>
      </div>
      {note && <p className="si-note">{note}</p>}
    </div>
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
        <Link className="btn btn-ghost" to="/arena" style={{ textDecoration: 'none' }}>
          Arena
        </Link>
        <Link className="btn btn-ghost" to="/projects" style={{ textDecoration: 'none' }}>
          Projects
        </Link>
      </div>

      <div className="border-t pt-4">
        <CodeforcesPanel />
      </div>

      <div className="border-t pt-4">
        <PrivacyPanel user={user} refresh={refresh} />
      </div>

      <div className="border-t pt-4">
        <button className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
