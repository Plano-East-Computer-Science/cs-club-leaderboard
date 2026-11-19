import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote, Empty } from '../components/bits.jsx';
import Problems from './officer/Problems.jsx';
import Sets from './officer/Sets.jsx';
import Announce from './officer/Announce.jsx';
import Team from './officer/Team.jsx';
import Claims from './officer/Claims.jsx';
import Merge from './officer/Merge.jsx';
import Raffle from './officer/Raffle.jsx';
import Squads from './officer/Squads.jsx';
import DailyAdmin from './officer/Daily.jsx';
import Board from './officer/Board.jsx';
import Reports from './officer/Reports.jsx';
import Records from './officer/Records.jsx';
import Signoffs from './officer/Signoffs.jsx';
import Cycles from './officer/Cycles.jsx';
import CtfAdmin from './officer/Ctf.jsx';
import CompetitionAdmin from './officer/Competition.jsx';
import Analytics from './officer/Analytics.jsx';
import TemplatePicker from './officer/TemplatePicker.jsx';
import { DEFAULT_LENGTH, endWarning } from '../../shared/session-templates.js';
import DataAdmin from './officer/Data.jsx';
import Planner from './officer/Planner.jsx';
import EditorialsAdmin from './officer/Editorials.jsx';
import ReaderAdmin from './officer/Reader.jsx';
import Handoff from './officer/Handoff.jsx';
import AlumniAdmin from './officer/Alumni.jsx';
import ResearchAdmin from './officer/Research.jsx';
import QuantAdmin from './officer/Quant.jsx';
import {
  PointsTab,
  MembersTab,
  BadgesTab,
  OpportunitiesTab,
  QueueTab,
  OfficersTab,
  CurriculumTab,
  CompetitionsTab,
  PuzzlesTab,
  EmailTab,
  TextTab,
  BackupTab,
} from './officer/AdminScreens.jsx';

const HOURS = [1, 2, 3, 6, 12];

/**
 * Every officer tool, grouped by job. One screen shows at a time and the URL
 * holds it (?s=<id>), so a link to any tool is shareable. `titled` screens
 * draw no heading of their own (they came from the old /admin panel), so the
 * shell draws one. Add a screen here.
 */
const GROUPS = [
  {
    label: 'Meeting',
    screens: [
      { id: 'rooms', label: 'Run a meeting', C: Rooms },
      { id: 'planner', label: 'Plan sessions', C: Planner },
      { id: 'points', label: 'Award points', C: PointsTab, titled: true },
    ],
  },
  {
    label: 'Review',
    screens: [
      { id: 'claims', label: 'Claims', C: Claims },
      { id: 'editorials', label: 'Editorials', C: EditorialsAdmin },
      { id: 'reports', label: 'Reports', C: Reports },
      { id: 'links', label: 'Link requests', C: LinkRequests },
      { id: 'queue', label: 'Opportunity queue', C: QueueTab, titled: true },
      { id: 'merge', label: 'Merge entries', C: Merge },
    ],
  },
  {
    label: 'Members',
    screens: [
      { id: 'members', label: 'Member list', C: MembersTab, titled: true },
      { id: 'team', label: 'Officer roles', C: Team },
      { id: 'badges', label: 'Badges', C: BadgesTab, titled: true },
      { id: 'records', label: 'Verified records', C: Records },
      { id: 'signoffs', label: 'Signed lines', C: Signoffs },
      { id: 'squads', label: 'Squads', C: Squads },
      { id: 'raffle', label: 'Raffle', C: Raffle },
      { id: 'analytics', label: 'Season stats', C: Analytics },
      { id: 'handoff', label: 'Handoff', C: Handoff },
      { id: 'alumni', label: 'Alumni', C: AlumniAdmin },
    ],
  },
  {
    label: 'Content',
    screens: [
      { id: 'problems', label: 'Problem bank', C: Problems },
      { id: 'sets', label: 'Duel packs and contest sets', C: Sets },
      { id: 'daily', label: 'Daily problem', C: DailyAdmin },
      { id: 'board', label: 'The Board', C: Board },
      { id: 'puzzles', label: 'Puzzles', C: PuzzlesTab, titled: true },
      { id: 'competitions', label: 'Competitions', C: CompetitionsTab, titled: true },
      { id: 'prep', label: 'Prep plans and results', C: CompetitionAdmin },
      { id: 'ctf', label: 'CTF', C: CtfAdmin },
      { id: 'data', label: 'Data challenges', C: DataAdmin },
      { id: 'quant', label: 'Quant rounds', C: QuantAdmin },
      { id: 'cycles', label: 'Build cycles', C: Cycles },
      { id: 'research', label: 'Research', C: ResearchAdmin },
      { id: 'opportunities', label: 'Opportunities', C: OpportunitiesTab, titled: true },
      { id: 'curriculum', label: 'Curriculum', C: CurriculumTab, titled: true },
    ],
  },
  {
    label: 'Club',
    screens: [
      { id: 'announce', label: 'Announcements', C: Announce },
      { id: 'email', label: 'Weekly digest', C: EmailTab, titled: true },
      { id: 'ideas', label: 'Ideas board', C: IdeasAdmin },
      { id: 'gateway', label: 'Gateway', C: Gateway },
      { id: 'reader', label: 'Reader sites', C: ReaderAdmin },
    ],
  },
  {
    label: 'Site',
    screens: [
      { id: 'officers', label: 'Officers on About', C: OfficersTab, titled: true },
      { id: 'text', label: 'Page text', C: TextTab, titled: true },
      { id: 'backup', label: 'Backup', C: BackupTab, titled: true },
    ],
  },
];
const SCREENS = GROUPS.flatMap((g) => g.screens);
// Links from before the merge: the old tab names land on the first screen of their group.
const OLD_TABS = { meeting: 'rooms', review: 'claims', members: 'members', content: 'problems', club: 'announce' };

/** Pending work per review queue, from the same endpoints the screens use. */
function useReviewCounts(refreshKey) {
  const [n, setN] = useState({});
  useEffect(() => {
    if (refreshKey == null) return;
    const len = (path, key) => api.get(path).then((d) => d[key].length).catch(() => 0);
    Promise.all([
      len('/admin/hub/claims?status=pending', 'claims'),
      len('/admin/hub/editorials?status=pending', 'editorials'),
      len('/admin/hub/reports?status=open', 'reports'),
      len('/admin/hub/links', 'requests'),
    ]).then(([claims, editorials, reports, links]) => setN({ claims, editorials, reports, links }));
  }, [refreshKey]);
  return n;
}

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
  const [session, setSession] = useState(null);
  const [params, setParams] = useSearchParams();
  const [flash, setFlash] = useState(null);
  const id = params.get('s') || OLD_TABS[params.get('tab')] || 'rooms';
  const screen = SCREENS.find((s) => s.id === id) || SCREENS[0];
  const counts = useReviewCounts(session?.authed ? screen.id : null);

  const check = useCallback(() => {
    api.get('/admin/session').then(setSession).catch(() => setSession({ authed: false }));
  }, []);
  useEffect(check, [check]);

  // The old admin screens report through one status line.
  const say = useCallback((message, tone = 'ok') => {
    setFlash({ message, tone });
    setTimeout(() => setFlash(null), 4000);
  }, []);
  useEffect(() => setFlash(null), [screen.id]);

  if (session === null) return <Spinner label="Checking session" />;
  if (!session.authed) return <Login user={session.user} onIn={check} />;

  const { officer } = session;
  const signOut = async () => {
    await api.post('/admin/logout');
    if (officer.userId) await api.post('/auth/logout');
    check();
  };
  const go = (next) => setParams({ s: next });
  const pending = (s) => counts[s.id] || 0;
  const groupPending = (g) => g.screens.reduce((n, s) => n + pending(s), 0);
  const Screen = screen.C;

  return (
    <div className="ofc">
      <header className="ofc-head">
        <div>
          <p className="eyebrow">Officers</p>
          <h1 className="ofc-title">Officer tools</h1>
        </div>
        <div className="ofc-who">
          <span>
            {officer.name} <i>{officer.role}</i>
          </span>
          <button type="button" className="si-link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="ofc-shell">
        <nav className="ofc-side" aria-label="Officer tools">
          {GROUPS.map((g) => (
            <section key={g.label}>
              <p className="ofc-g">
                {g.label}
                {groupPending(g) > 0 && <span className="ofc-n">{groupPending(g)}</span>}
              </p>
              {g.screens.map((s) => (
                <Link key={s.id} to={`?s=${s.id}`} aria-current={s.id === screen.id ? 'page' : undefined}>
                  {s.label}
                  {pending(s) > 0 && <span className="ofc-n">{pending(s)}</span>}
                </Link>
              ))}
            </section>
          ))}
        </nav>

        <label className="ofc-pick">
          <span>Tool</span>
          <select className="field" value={screen.id} onChange={(e) => go(e.target.value)}>
            {GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {pending(s) > 0 ? ` (${pending(s)})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="ofc-main" id="officer-screen">
          <div className={`ofc-flash${flash ? ` ${flash.tone === 'ok' ? 'ok' : 'bad'}` : ''}`} role="status">
            {flash?.message}
          </div>
          {screen.titled && <h2 className="ofc-h">{screen.label}</h2>}
          <Screen key={screen.id} say={say} actionsUrl={session.actions_url} />
        </div>
      </div>
    </div>
  );
}

function Login({ user, onIn }) {
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
          <p className="eyebrow">Officers</p>
          <h1 className="si-title">Officer tools</h1>
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

/** Attendance is paid by the ledger when a room closes (A2); this reports what happened. */
const paid = (d) =>
  `Paid attendance to ${d.awarded} member${d.awarded === 1 ? '' : 's'}` +
  (d.alreadyHad ? `, ${d.alreadyHad} already paid` : '') +
  (d.noExit ? `, ${d.noExit} did nothing else, so no bonus` : '') +
  (d.unlinked ? `. ${d.unlinked} still waiting on a link request.` : '.');

function Rooms() {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('build');
  const [minutes, setMinutes] = useState(DEFAULT_LENGTH);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const [open, setOpen] = useState(null);
  const [attendees, setAttendees] = useState({});
  const [awardMsg, setAwardMsg] = useState({});
  const [closing, setClosing] = useState(null); // V3-A: the room whose in-page close confirm is showing

  const load = useCallback(() => {
    api.get('/admin/hub/rooms').then((d) => setRooms(d.rooms)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api.post('/admin/hub/rooms', { title: title.trim(), template, minutes }));
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
      const d = await api.post(`/admin/hub/rooms/${code}/close`);
      setAwardMsg((m) => ({ ...m, [code]: paid(d) }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const award = async (code) => {
    try {
      const d = await api.post(`/admin/hub/rooms/${code}/award`);
      setAwardMsg((m) => ({ ...m, [code]: paid(d) }));
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
        Open a room, share the code, and attendance is taken as people join. Closing the room pays attendance
        points by the club's rules.
      </SectionHead>

      <form onSubmit={create} className="card mb-4 grid gap-4 p-4">
        <TemplatePicker value={template} onChange={setTemplate} minutes={minutes} onMinutes={setMinutes} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-56 flex-1 gap-1.5">
            <span className="eyebrow">Title</span>
            <input
              className="field"
              value={title}
              maxLength={80}
              placeholder={template === 'dropin' ? 'Panther Pause, Tuesday' : 'Title, e.g. Week 12 meeting'}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy || !title.trim()}>
            {busy ? 'Opening' : 'Open room'}
          </button>
        </div>
        <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
          You can change the blocks on the host screen, before and during the meeting.
        </p>
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
                    {r.attendees} checked in, {r.eligible ?? 0} did something
                  </button>
                  <Link to={`/host/${r.code}`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                    Host
                  </Link>
                  {isOpen && (
                    <button className="btn btn-danger" onClick={() => setClosing(r.code)} aria-expanded={closing === r.code}>
                      Close
                    </button>
                  )}
                </div>
                {isOpen && closing === r.code && (
                  <div className="ses-end mt-3 border p-3" role="alertdialog" aria-label={`Close room ${r.code}?`}>
                    {endWarning({ joined: r.attendees, exits: r.eligible ?? 0, dropin: r.kind === 'dropin' }).map((l) => (
                      <p key={l} className="text-sm">{l}</p>
                    ))}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="btn btn-danger" autoFocus onClick={() => { setClosing(null); close(r.code); }}>Close and pay</button>
                      <button className="btn btn-ghost" onClick={() => setClosing(null)}>Keep it open</button>
                    </div>
                  </div>
                )}
                {awardMsg[r.code] && (
                  <p className="mono mt-2 text-xs" role="status" style={{ color: 'var(--up)' }}>{awardMsg[r.code]}</p>
                )}
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
                              {a.email} · {when(a.joined_at)} · {a.exit_kind ? `bonus (${a.exit_kind})` : 'checked in only'}
                            </span>
                            {a.exit_note && <span className="w-full text-xs" style={{ color: 'var(--ink-soft)' }}>{a.exit_note}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {attendees[r.code]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button className="btn btn-ghost" onClick={() => award(r.code)}>Re-run attendance points</button>
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
