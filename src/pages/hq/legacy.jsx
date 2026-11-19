/**
 * Officer screens moved here unchanged from the old console (src/pages/Officer.jsx)
 * when Officer HQ replaced it in Wave 5: the officer sign-in gate and the
 * Gateway settings. HQ hosts them inside its own layout.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../../components/bits.jsx';

const HOURS = [1, 2, 3, 6, 12];

/** Timestamps may arrive as ms numbers or SQLite "YYYY-MM-DD HH:MM:SS" (UTC). */
function when(v) {
  if (v == null) return '';
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  return (
    <button type="button" className="btn btn-ghost" onClick={copy}>
      {done ? 'Copied' : label}
    </button>
  );
}

export function Login({ user, onIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [glass, setGlass] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/login', { password });
      onIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="si">
      <div className="si-card">
        <header className="si-head">
          <h1 className="si-title">Officer HQ</h1>
        </header>
        {user ? (
          <p className="si-lede">
            You are signed in as <b>{user.name}</b>, which is not an officer account. Ask a club lead to give you the
            officer role.
          </p>
        ) : (
          <div className="si-form">
            <p className="si-lede" style={{ marginTop: 0 }}>
              Officers use their own club account. Sign in, then come back here.
            </p>
            <Link to="/signin" className="btn btn-primary si-go" style={{ textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        )}

        <div className="si-foot">
          {!glass ? (
            <button type="button" className="si-link" onClick={() => setGlass(true)}>
              Use the shared password (break-glass)
            </button>
          ) : (
            <form onSubmit={submit} className="si-form" style={{ width: '100%' }}>
              <p className="si-field">
                <small>For when no officer account works, or to make the first lead. Everything you do is logged as shared login.</small>
              </p>
              <label className="si-field">
                <span>Shared password</span>
                <input
                  className="field"
                  type="password"
                  value={password}
                  autoFocus
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <p role="alert" className="si-err">{error}</p>}
              <button className="btn btn-ghost si-go" disabled={busy || !password}>
                {busy ? 'Checking' : 'Sign in with the shared password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, children }) {
  return (
    <div className="mb-4">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-1 text-2xl font-bold">{title}</h2>
      {children && (
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          {children}
        </p>
      )}
    </div>
  );
}

/* -------------------------------- gateway -------------------------------- */

function codeStatus(c) {
  if (c.revoked) return ['revoked', '#c42e2e'];
  if (c.active) return ['active', '#2f8f5b'];
  return ['expired', 'var(--ink-faint)'];
}

const NL = String.fromCharCode(10);

function HostEditor({ hosts, onSaved }) {
  const [text, setText] = useState(hosts.join(NL));
  const [msg, setMsg] = useState('');
  const save = async (value) => {
    setMsg('');
    try {
      const d = await api.put('/admin/hub/gateway/hosts', { hosts: value });
      setText(d.hosts.join(NL));
      setMsg('Saved.');
      onSaved();
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <div className="grid gap-2">
      <p className="eyebrow">Approved hosts, one per line</p>
      <textarea className="field mono" rows={Math.min(14, Math.max(4, text.split(NL).length))} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => save(text)}>Save hosts</button>
        <button className="btn btn-ghost" onClick={() => save('')}>Reset to defaults</button>
        {msg && <span className="mono text-xs" style={{ color: msg === 'Saved.' ? 'var(--up)' : 'var(--down)' }}>{msg}</span>}
      </div>
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Add a docs site or search engine here and it works for every live code. Keep it to sites the district approved.
      </p>
    </div>
  );
}

/**
 * H1: the presets a host can turn on per meeting. Each is a slice of the
 * approved list; a host must be approved before it can go in a preset.
 */
function PresetEditor({ presets, approved, onSaved }) {
  const [drafts, setDrafts] = useState({});
  const [note, setNote] = useState(null);
  const save = async (id) => {
    setNote(null);
    try {
      await api.put(`/admin/hub/gateway/presets/${id}`, { hosts: drafts[id] ?? '' });
      setDrafts((d) => ({ ...d, [id]: undefined }));
      setNote({ id, ok: true, text: 'Saved.' });
      onSaved();
    } catch (err) {
      setNote({ id, text: err.message });
    }
  };
  return (
    <div className="mt-6 grid gap-3">
      <p className="eyebrow">Presets the host turns on per meeting</p>
      <p className="max-w-2xl text-xs" style={{ color: 'var(--ink-faint)' }}>
        A preset can only hold sites already on the approved list above. Practice and Data start empty: sites
        like usaco.guide or cses.fi need district approval before they go on the approved list.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {presets.map((p) => {
          const text = drafts[p.id] ?? p.hosts.join('\n');
          const missing = p.hosts.filter((h) => !approved.includes(h));
          return (
            <li key={p.id} className="card grid gap-2 p-4">
              <p className="text-sm font-semibold">{p.name}{p.fixed ? ' (always on)' : ''}</p>
              {p.fixed ? (
                <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>{p.hosts.join(', ')}</p>
              ) : (
                <>
                  <label className="sr-only" htmlFor={`preset-${p.id}`}>{p.name} sites, one per line</label>
                  <textarea id={`preset-${p.id}`} className="field mono text-xs" rows={4} value={text} spellCheck={false} placeholder="Empty" onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-ghost" disabled={drafts[p.id] === undefined} onClick={() => save(p.id)}>Save {p.name}</button>
                    {note?.id === p.id && <span className="mono text-xs" role="status" style={{ color: note.ok ? 'var(--up)' : 'var(--down)' }}>{note.text}</span>}
                  </div>
                </>
              )}
              {missing.length > 0 && <p className="mono text-xs" style={{ color: 'var(--down)' }}>Off until approved: {missing.join(', ')}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


export function Gateway() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/hub/gateway').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api.post('/admin/hub/gateway', { label: label.trim(), hours }));
      setLabel('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (code) => {
    try {
      await api.post(`/admin/hub/gateway/${code}/revoke`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <SectionHead eyebrow="Gateway" title="GitHub for school machines">
        Every meeting room now gets its own gateway code: members who check in see it on /gateway,
        and the host picks which presets are on. Make a code here only for something outside a room.
      </SectionHead>

      <form onSubmit={create} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="grid min-w-48 flex-1 gap-1.5">
          <span className="eyebrow">New gateway code</span>
          <input
            className="field"
            value={label}
            maxLength={60}
            placeholder="Label, e.g. Thursday meeting"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="eyebrow">Lasts</span>
          <select className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h} hour{h === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Making' : 'Make code'}
        </button>
      </form>

      {made && (
        <div className="card mb-4 p-5">
          <p className="eyebrow">{made.label || 'Gateway code'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="mono text-[clamp(2rem,8vw,3.25rem)] leading-none font-bold tracking-[0.2em]">
              {made.code}
            </span>
            <CopyButton text={made.code} />
          </div>
          <p className="mono mt-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
            Expires {when(made.expires_at)}. Students enter it at /gateway.
          </p>
        </div>
      )}

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!data && !error && <Spinner label="Loading codes" />}
      {data && data.codes.length === 0 && <Empty title="No codes yet">Make one when a meeting needs GitHub.</Empty>}

      {data && data.codes.length > 0 && (
        <ul className="card divide-y">
          {data.codes.map((c) => {
            const [status, color] = codeStatus(c);
            return (
              <li key={c.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <span className="mono text-sm font-bold tracking-widest">{c.code}</span>
                <span className="min-w-32 flex-1 text-sm">{c.label || 'Unlabeled'}</span>
                <span className="mono text-xs font-semibold" style={{ color }}>{status}</span>
                <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {c.requests} request{c.requests === 1 ? '' : 's'} · until {when(c.expires_at)}
                </span>
                {c.active && (
                  <button className="btn btn-danger" onClick={() => revoke(c.code)}>
                    Revoke
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && (
        <div className="mt-4">
          <HostEditor hosts={data.hosts} onSaved={load} />
          <p className="mt-2 max-w-2xl text-xs" style={{ color: 'var(--ink-faint)' }}>
            Deliberately not an open proxy: every request needs a live code, only these hosts are
            reachable, sign-in pages are blocked, and no cookies are relayed.
          </p>
        </div>
      )}
      {data?.presets && <PresetEditor presets={data.presets} approved={data.hosts} onSaved={load} />}
    </section>
  );
}
