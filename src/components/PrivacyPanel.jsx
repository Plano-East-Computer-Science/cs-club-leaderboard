/**
 * G5, on the account page: show-my-full-name opt-in, data export, account
 * deletion, and the verified records an officer issued for this member (E7).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function PrivacyPanel({ user, refresh, signedOut }) {
  const [full, setFull] = useState(Boolean(user.show_full_name));
  const [confirmText, setConfirmText] = useState('');
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState([]);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    api.get('/me/records').then((r) => setCodes(r.codes)).catch(() => {});
  }, []);

  async function toggleFull(e) {
    const next = e.target.checked;
    setFull(next);
    try {
      await api.patch('/me', { show_full_name: next });
      await refresh();
    } catch (err) {
      setFull(!next);
      setError(err.message);
    }
  }

  async function remove(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.del('/me/account', { confirm: confirmText.trim().toLowerCase(), keep_history: keep });
      setGone(true);
      signedOut?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (gone) {
    return (
      <p role="status" className="text-sm">
        Your account is deleted and you are signed out. Everything is erased within two weeks.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="eyebrow">Privacy</p>
        <label className="mt-2 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={full} onChange={toggleFull} style={{ marginTop: 4 }} />
          <span>
            Show my full name on public pages. Off by default: the leaderboard, projects and your portfolio show only
            "{String(user.name).split(' ')[0]}".
          </span>
        </label>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
          Your email address is never shown to anyone but officers. <Link to="/privacy" className="underline">Read the privacy page</Link>.
        </p>
      </div>

      {codes.length > 0 && (
        <div>
          <p className="eyebrow">Verified records</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {codes.map((c) => (
              <li key={c.code}>
                <Link className="underline" to={`/verify/${c.code}`}>Open and print</Link>
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>issued by {c.issued_by_name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="eyebrow">Your data</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Download everything tied to your account as one JSON file.
        </p>
        <a className="btn btn-ghost mt-2" href="/api/me/export" download="cs-club-my-data.json" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Download my data
        </a>
      </div>

      <details>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>Delete my account</summary>
        <form onSubmit={remove} className="mt-3 grid gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            You are signed out at once and your name leaves every page. Within two weeks your account, progress, projects,
            ideas and settings are erased. This cannot be undone.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ marginTop: 4 }} />
            <span>Keep my points on the leaderboard as "Former member". Left unticked, your entry is removed.</span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm">Type <b>delete</b> to confirm</span>
            <input className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn btn-danger" disabled={busy || confirmText.trim().toLowerCase() !== 'delete'}>
            {busy ? 'Deleting...' : 'Delete my account'}
          </button>
        </form>
      </details>
      {error && <p role="alert" className="text-sm" style={{ color: '#c42e2e' }}>{error}</p>}
    </div>
  );
}
