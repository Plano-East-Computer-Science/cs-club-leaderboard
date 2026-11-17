import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';

const HOURS = [1, 2, 3, 6, 12];

/** Timestamps may arrive as ms numbers or SQLite "YYYY-MM-DD HH:MM:SS" (UTC). */
function when(v) {
  if (v == null) return '';
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

export default function Officer() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    api.get('/admin/session').then((d) => setAuthed(d.authed)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <Spinner label="Checking session" />;
  if (!authed) return <Login onIn={() => setAuthed(true)} />;

  return (
    <div className="grid gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Officers</p>
          <h1 className="display mt-1 text-3xl font-extrabold">Meeting console</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/admin" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Full admin panel
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => api.post('/admin/logout').then(() => setAuthed(false))}
          >
            Sign out
          </button>
        </div>
      </header>
      <Rooms />
      <LinkRequests />
      <IdeasAdmin />
      <Gateway />
    </div>
  );
}

function Login({ onIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
    <div className="mx-auto max-w-sm py-16">
      <p className="eyebrow">Officers</p>
      <h1 className="display mt-2 mb-1 text-3xl font-extrabold">Meeting console</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
        Officers only. Same password as the admin panel.
      </p>
      <form onSubmit={submit} className="card grid gap-3 p-5">
        <label className="grid gap-1.5">
          <span className="eyebrow">Password</span>
          <input
            className="field"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="mono text-xs" style={{ color: '#c42e2e' }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || !password}>
          {busy ? 'Signing in' : 'Sign in'}
        </button>
      </form>
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

/* ----------------------------- link requests ----------------------------- */

function LinkRequests() {
  const [reqs, setReqs] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    api.get('/admin/hub/links').then((d) => setReqs(d.requests)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (userId, verb) => {
    setError(null);
    try {
      await api.post(`/admin/hub/links/${userId}/${verb}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <SectionHead eyebrow="Accounts" title="Leaderboard link requests">
        A student asked to connect their account to a leaderboard entry. Approve only if you know it is really them.
      </SectionHead>
      {error && <p className="mono mb-3 text-xs" style={{ color: 'var(--down)' }}>{error}</p>}
      {!reqs ? (
        <Spinner />
      ) : reqs.length === 0 ? (
        <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No pending requests.</p>
      ) : (
        <ul className="grid gap-2">
          {reqs.map((r) => (
            <li key={r.user_id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span>
                <b>{r.user_name}</b> <span style={{ color: 'var(--ink-soft)' }}>({r.email})</span> wants to be{' '}
                <b style={{ color: 'var(--flag)' }}>{r.student_name}</b>
              </span>
              <span className="flex gap-2">
                <button className="btn btn-primary" onClick={() => act(r.user_id, 'approve')}>Approve</button>
                <button className="btn btn-ghost" onClick={() => act(r.user_id, 'reject')}>Reject</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------- ideas --------------------------------- */

function IdeasAdmin() {
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    api.get('/ideas').then((d) => setIdeas(d.ideas)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const set = (id, status) =>
    api.post(`/admin/hub/ideas/${id}/status`, { status }).then(load).catch((e) => setError(e.message));

  return (
    <section>
      <SectionHead eyebrow="Ideas board" title="What members asked for">
        Mark an idea planned when it is on the schedule and done once it has run. Hide anything that should not be public.
      </SectionHead>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!ideas && !error && <Spinner label="Loading ideas" />}
      {ideas && ideas.length === 0 && <Empty title="No ideas yet">Point members at /ideas during a meeting.</Empty>}
      {ideas && ideas.length > 0 && (
        <ul className="card divide-y">
          {ideas.slice(0, 30).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <span className="mono w-10 text-sm font-bold">{i.votes}</span>
              <span className="min-w-40 flex-1 text-sm">
                {i.body}
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{i.kind} · {i.author}</span>
              </span>
              <select className="field" style={{ width: 'auto' }} value={i.status} onChange={(e) => set(i.id, e.target.value)} aria-label={`Status of: ${i.body}`}>
                <option value="open">open</option>
                <option value="planned">planned</option>
                <option value="done">done</option>
                <option value="hidden">hide</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------- rooms --------------------------------- */

function Rooms() {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const [open, setOpen] = useState(null);
  const [attendees, setAttendees] = useState({});
  const [awardMsg, setAwardMsg] = useState({});
  const [pts, setPts] = useState(5);

  const load = useCallback(() => {
    api.get('/admin/hub/rooms').then((d) => setRooms(d.rooms)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api.post('/admin/hub/rooms', { title: title.trim() }));
      setTitle('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const close = async (code) => {
    try {
      await api.post(`/admin/hub/rooms/${code}/close`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const award = async (code) => {
    try {
      const d = await api.post(`/admin/hub/rooms/${code}/award`, { points: pts });
      setAwardMsg((m) => ({
        ...m,
        [code]: `Awarded ${pts} points to ${d.awarded} member${d.awarded === 1 ? '' : 's'}` +
          (d.alreadyHad ? `, ${d.alreadyHad} already had them` : '') +
          (d.unlinked ? `. ${d.unlinked} joined without a linked leaderboard entry.` : '.'),
      }));
    } catch (err) {
      setAwardMsg((m) => ({ ...m, [code]: err.message }));
    }
  };

  const toggle = async (code) => {
    if (open === code) return setOpen(null);
    setOpen(code);
    try {
      const d = await api.get(`/admin/hub/rooms/${code}/attendance`);
      setAttendees((a) => ({ ...a, [code]: d.attendees }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <SectionHead eyebrow="Live rooms" title="Run a meeting">
        Open a room, share the code, and attendance is taken as people join.
      </SectionHead>

      <form onSubmit={create} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="grid min-w-56 flex-1 gap-1.5">
          <span className="eyebrow">Open a room</span>
          <input
            className="field"
            value={title}
            maxLength={80}
            placeholder="Title, e.g. Week 12 meeting"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Opening' : 'Open room'}
        </button>
      </form>

      {made && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <span className="mono font-bold tracking-widest">{made.code}</span> · {made.title} is open.
          </p>
          <Link to={`/host/${made.code}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Run it
          </Link>
        </div>
      )}

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!rooms && !error && <Spinner label="Loading rooms" />}
      {rooms && rooms.length === 0 && <Empty title="No rooms yet">Open one above to start a meeting.</Empty>}

      {rooms && rooms.length > 0 && (
        <ul className="card divide-y">
          {rooms.map((r) => {
            const isOpen = !r.closed_at;
            return (
              <li key={r.code} className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="mono text-sm font-bold tracking-widest">{r.code}</span>
                  <span className="min-w-40 flex-1 text-sm font-medium">{r.title}</span>
                  <span className="mono text-xs" style={{ color: isOpen ? '#2f8f5b' : 'var(--ink-faint)' }}>
                    {isOpen ? 'open' : 'closed'}
                  </span>
                  <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {when(r.created_at)}
                  </span>
                  <button className="btn btn-ghost" onClick={() => toggle(r.code)} aria-expanded={open === r.code}>
                    {r.attendees} attended
                  </button>
                  <Link to={`/host/${r.code}`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                    Host
                  </Link>
                  {isOpen && (
                    <button className="btn btn-danger" onClick={() => close(r.code)}>
                      Close
                    </button>
                  )}
                </div>
                {open === r.code && (
                  <div className="mt-3 border-t pt-3">
                    {!attendees[r.code] ? (
                      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>Loading</p>
                    ) : attendees[r.code].length === 0 ? (
                      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>Nobody joined.</p>
                    ) : (
                      <ul className="grid gap-1">
                        {attendees[r.code].map((a, i) => (
                          <li key={i} className="flex flex-wrap gap-x-3 text-sm">
                            <span className="font-medium">{a.name}</span>
                            <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                              {a.email} · {when(a.joined_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {attendees[r.code]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                          points each{' '}
                          <input
                            className="field"
                            style={{ width: 70, display: 'inline-block' }}
                            type="number"
                            min="1"
                            max="100"
                            value={pts}
                            onChange={(e) => setPts(e.target.value)}
                          />
                        </label>
                        <button className="btn btn-primary" onClick={() => award(r.code)}>Award attendance points</button>
                        {awardMsg[r.code] && <span className="mono text-xs" style={{ color: 'var(--up)' }}>{awardMsg[r.code]}</span>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

function Gateway() {
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
        A code that lets students reach GitHub through this site for a few hours.
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
    </section>
  );
}
