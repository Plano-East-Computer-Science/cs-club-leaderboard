import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate, relativeDate, TYPE_LABELS, FORMAT_LABELS } from '../lib/format.js';
import { Avatar, TierMark, Spinner } from '../components/bits.jsx';

const TABS = [
  { id: 'points', label: 'Award points' },
  { id: 'members', label: 'Members' },
  { id: 'badges', label: 'Badges' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'queue', label: 'Pending' },
  { id: 'officers', label: 'Officers' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'competitions', label: 'Competitions' },
  { id: 'puzzles', label: 'Puzzles' },
  { id: 'signins', label: 'Sign-ins' },
  { id: 'text', label: 'Page text' },
  { id: 'backup', label: 'Backup' },
];

export default function Admin() {
  const [authed, setAuthed] = useState(null);
  const [actionsUrl, setActionsUrl] = useState('');
  const [tab, setTab] = useState('points');
  const [flash, setFlash] = useState(null);

  const say = useCallback((message, tone = 'ok') => {
    setFlash({ message, tone });
    setTimeout(() => setFlash(null), 4000);
  }, []);

  useEffect(() => {
    api
      .get('/admin/session')
      .then((d) => {
        setAuthed(d.authed);
        setActionsUrl(d.actions_url ?? '');
      })
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <Spinner label="Checking session" />;
  if (!authed) return <Login onIn={() => setAuthed(true)} />;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="display mt-1 text-3xl font-extrabold">Club control panel</h1>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => api.post('/admin/logout').then(() => setAuthed(false))}
        >
          Sign out
        </button>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1.5 border-b pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="mono rounded px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              color: tab === t.id ? 'light-dark(#fff, #0d1017)' : 'var(--ink-soft)',
              background: tab === t.id ? 'var(--flag)' : 'transparent',
            }}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {flash && (
        <p
          className="mono mb-5 rounded border px-3 py-2 text-xs"
          role="status"
          style={{
            color: flash.tone === 'ok' ? '#2f8f5b' : '#c42e2e',
            borderColor: `color-mix(in srgb, ${flash.tone === 'ok' ? '#2f8f5b' : '#c42e2e'} 35%, transparent)`,
            background: `color-mix(in srgb, ${flash.tone === 'ok' ? '#2f8f5b' : '#c42e2e'} 8%, transparent)`,
          }}
        >
          {flash.message}
        </p>
      )}

      {tab === 'points' && <PointsTab say={say} />}
      {tab === 'members' && <MembersTab say={say} />}
      {tab === 'badges' && <BadgesTab say={say} />}
      {tab === 'opportunities' && <OpportunitiesTab say={say} />}
      {tab === 'queue' && <QueueTab say={say} actionsUrl={actionsUrl} />}
      {tab === 'officers' && <OfficersTab say={say} />}
      {tab === 'curriculum' && <CurriculumTab say={say} />}
      {tab === 'competitions' && <CompetitionsTab say={say} />}
      {tab === 'puzzles' && <PuzzlesTab say={say} />}
      {tab === 'signins' && <SignInsTab say={say} />}
      {tab === 'text' && <TextTab say={say} />}
      {tab === 'backup' && <BackupTab say={say} />}
    </div>
  );
}

/* -------------------------------- login -------------------------------- */

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
      <p className="eyebrow">Admin</p>
      <h1 className="display mt-2 mb-1 text-3xl font-extrabold">Sign in</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
        Officers only. The password is the ADMIN_PASSWORD secret set on the site.
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
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function Section({ title, hint, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="display text-base font-bold">{title}</h2>
      {hint && (
        <p className="mt-1 mb-4 text-[0.82rem]" style={{ color: 'var(--ink-soft)' }}>
          {hint}
        </p>
      )}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
      {hint && (
        <span className="text-[0.72rem]" style={{ color: 'var(--ink-faint)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * Wraps an async handler so every tab reports failures the same way.
 * `onSuccess` runs only when the request actually succeeded -- clearing a form
 * after a failed save would throw away what the user typed.
 */
function useAction(say, reload) {
  return useCallback(
    async (fn, okMessage, onSuccess) => {
      try {
        await fn();
        if (okMessage) say(okMessage);
        onSuccess?.();
        reload?.();
      } catch (err) {
        say(err.message, 'bad');
      }
    },
    [say, reload]
  );
}

/* ------------------------------ award points ------------------------------ */

const PRESETS = [
  { amount: 3, reason: 'Meeting attendance' },
  { amount: 10, reason: 'Helped run a club event' },
  { amount: 20, reason: 'Taught a workshop' },
  { amount: 25, reason: 'Finished and demoed a project' },
  { amount: 30, reason: 'Entered a competition' },
  { amount: 50, reason: 'Placed in a competition' },
];

function PointsTab({ say }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('one');
  const [studentId, setStudentId] = useState('');
  const [picked, setPicked] = useState([]);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const reasonRef = useRef(null);

  const load = useCallback(() => {
    api.get('/admin/students').then(setData).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!data) return <Spinner />;
  const active = data.students.filter((s) => s.active);

  const applyPreset = (p) => {
    setDelta(String(p.amount));
    setReason(p.reason);
    reasonRef.current?.focus();
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'one') {
      act(
        () => api.post('/admin/points', { student_id: Number(studentId), delta: Number(delta), reason }),
        `Awarded ${delta} points.`,
        () => {
          setDelta('');
          setReason('');
        }
      );
    } else {
      act(
        () => api.post('/admin/points/bulk', { student_ids: picked, delta: Number(delta), reason }),
        `Awarded ${delta} points to ${picked.length} members.`,
        () => {
          setPicked([]);
          setDelta('');
          setReason('');
        }
      );
    }
  };

  const recent = data.leaderboard;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Section
        title="Award points"
        hint="Every award is logged with its reason and shows on the member's profile. Use a negative number to take points back."
      >
        <div className="mb-4 flex gap-1.5">
          {[
            ['one', 'One member'],
            ['many', 'Several at once'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className="mono rounded border px-3 py-1.5 text-xs font-semibold"
              style={{
                color: mode === id ? 'light-dark(#fff, #0d1017)' : 'var(--ink-soft)',
                background: mode === id ? 'var(--flag)' : 'transparent',
                borderColor: mode === id ? 'var(--flag)' : 'var(--rule)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="grid gap-4">
          {mode === 'one' ? (
            <Field label="Member">
              <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">Choose a member…</option>
                {active.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.grade ? ` — grade ${s.grade}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={`Members (${picked.length} selected)`} hint="Handy for marking attendance after a meeting.">
              <div className="grid max-h-64 gap-1 overflow-y-auto rounded border p-2">
                <button
                  type="button"
                  className="mono self-start text-[0.7rem]"
                  style={{ color: 'var(--flag)' }}
                  onClick={() => setPicked(picked.length === active.length ? [] : active.map((s) => s.id))}
                >
                  {picked.length === active.length ? 'Clear all' : 'Select everyone'}
                </button>
                {active.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(s.id)}
                      onChange={(e) =>
                        setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Points">
              <input
                className="field mono"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="25"
                required
              />
            </Field>
            <Field label="Reason">
              <input
                ref={reasonRef}
                className="field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Won district hackathon"
                required
              />
            </Field>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Quick fills</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.reason}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="mono rounded-full border px-2.5 py-1 text-[0.7rem]"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  +{p.amount} {p.reason}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary justify-self-start">Award points</button>
        </form>
      </Section>

      <Section title="Standings right now">
        <ol className="grid gap-2">
          {recent.slice(0, 12).map((s) => (
            <li key={s.id} className="flex items-center gap-2.5">
              <span className="mono w-6 text-xs" style={{ color: 'var(--ink-faint)' }}>
                {String(s.rank).padStart(2, '0')}
              </span>
              <Avatar name={s.name} seed={s.avatar_seed} points={s.points} size={26} ring={false} />
              <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
              <span className="mono text-sm font-bold">{s.points}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/* -------------------------------- members -------------------------------- */

function MembersTab({ say }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [openId, setOpenId] = useState(null);
  const [events, setEvents] = useState([]);

  const load = useCallback(() => {
    api.get('/admin/students').then(setData).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  const openHistory = async (id) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    const d = await api.get(`/admin/points/${id}`);
    setEvents(d.events);
  };

  if (!data) return <Spinner />;
  const byId = new Map(data.leaderboard.map((s) => [s.id, s]));

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
      <Section title="Add a member" hint="Only a name is required.">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api.post('/admin/students', { name, grade }), `Added ${name}.`, () => {
              setName('');
              setGrade('');
            });
          }}
        >
          <Field label="Name">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Grade">
            <select className="field" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Not set</option>
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn btn-primary">Add member</button>
        </form>
      </Section>

      <Section title={`Members (${data.students.length})`} hint="Hide a member to keep their history but drop them off the public board.">
        <ul className="grid gap-1">
          {data.students.map((s) => {
            const stats = byId.get(s.id);
            return (
              <li key={s.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={s.name} seed={s.avatar_seed} points={stats?.points ?? 0} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.name}
                      {!s.active && (
                        <span className="mono ml-2 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                          hidden
                        </span>
                      )}
                    </p>
                    <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                      {s.grade ? `Grade ${s.grade}` : 'No grade'} · {stats?.points ?? 0} points
                    </p>
                  </div>
                  <button className="btn btn-ghost" onClick={() => openHistory(s.id)}>
                    {openId === s.id ? 'Hide history' : 'History'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      act(
                        () => api.patch(`/admin/students/${s.id}`, { active: !s.active }),
                        s.active ? `${s.name} hidden from the board.` : `${s.name} is back on the board.`
                      )
                    }
                  >
                    {s.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (confirm(`Delete ${s.name} and every point they have earned? This cannot be undone.`)) {
                        act(() => api.del(`/admin/students/${s.id}`), `Deleted ${s.name}.`);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>

                {openId === s.id && (
                  <ul className="mt-3 grid gap-1 border-t pt-3">
                    {events.length === 0 && (
                      <li className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                        No points awarded yet.
                      </li>
                    )}
                    {events.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 text-sm">
                        <span
                          className="mono w-12 text-right font-bold"
                          style={{ color: e.delta >= 0 ? '#2f8f5b' : '#c42e2e' }}
                        >
                          {e.delta > 0 ? '+' : ''}
                          {e.delta}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{e.reason}</span>
                        <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                          {relativeDate(e.created_at)}
                        </span>
                        <button
                          className="btn btn-danger"
                          onClick={() =>
                            act(() => api.del(`/admin/points/${e.id}`), 'Award removed.', () => {
                              setOpenId(null);
                            })
                          }
                        >
                          Undo
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/* -------------------------------- badges -------------------------------- */

const BADGE_COLOR_NAMES = ['amber', 'emerald', 'violet', 'sky', 'rose', 'orange', 'teal', 'lime'];

function BadgesTab({ say }) {
  const [badges, setBadges] = useState(null);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: '', emoji: '🏅', description: '', color: 'violet' });
  const [award, setAward] = useState({ student_id: '', badge_id: '' });

  const load = useCallback(() => {
    Promise.all([api.get('/admin/badges'), api.get('/admin/students')])
      .then(([b, s]) => {
        setBadges(b);
        setStudents(s.students.filter((x) => x.active));
      })
      .catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!badges) return <Spinner />;
  const holders = (badgeId) =>
    badges.awarded.filter((a) => a.badge_id === badgeId).map((a) => students.find((s) => s.id === a.student_id)).filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
      <div className="grid gap-6">
        <Section title="Create a badge">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.post('/admin/badges', form), `Created "${form.name}".`, () =>
                setForm({ name: '', emoji: '🏅', description: '', color: 'violet' })
              );
            }}
          >
            <div className="grid grid-cols-[4.5rem_1fr] gap-3">
              <Field label="Emoji">
                <input
                  className="field text-center"
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                />
              </Field>
              <Field label="Name">
                <input
                  className="field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                className="field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What earns this badge"
              />
            </Field>
            <Field label="Colour">
              <select
                className="field"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              >
                {BADGE_COLOR_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary">Create badge</button>
          </form>
        </Section>

        <Section title="Give a badge to someone">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () =>
                  api.post('/admin/badges/award', {
                    student_id: Number(award.student_id),
                    badge_id: Number(award.badge_id),
                  }),
                'Badge awarded.'
              );
            }}
          >
            <Field label="Member">
              <select
                className="field"
                value={award.student_id}
                onChange={(e) => setAward({ ...award, student_id: e.target.value })}
                required
              >
                <option value="">Choose a member…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Badge">
              <select
                className="field"
                value={award.badge_id}
                onChange={(e) => setAward({ ...award, badge_id: e.target.value })}
                required
              >
                <option value="">Choose a badge…</option>
                {badges.badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.emoji} {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary">Award badge</button>
          </form>
        </Section>
      </div>

      <Section title={`Badges (${badges.badges.length})`}>
        <ul className="grid gap-2">
          {badges.badges.map((b) => (
            <li key={b.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl" aria-hidden="true">
                  {b.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{b.name}</p>
                  <p className="text-[0.75rem]" style={{ color: 'var(--ink-soft)' }}>
                    {b.description || 'No description'}
                  </p>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm(`Delete the "${b.name}" badge everywhere it has been awarded?`)) {
                      act(() => api.del(`/admin/badges/${b.id}`), 'Badge deleted.');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {holders(b.id).length === 0 ? (
                  <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                    Not awarded yet
                  </span>
                ) : (
                  holders(b.id).map((s) => (
                    <button
                      key={s.id}
                      className="mono rounded border px-2 py-0.5 text-[0.65rem]"
                      style={{ color: 'var(--ink-soft)' }}
                      title="Click to take this badge back"
                      onClick={() =>
                        act(
                          () => api.post('/admin/badges/revoke', { student_id: s.id, badge_id: b.id }),
                          `Took "${b.name}" back from ${s.name}.`
                        )
                      }
                    >
                      {s.name} ✕
                    </button>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ----------------------------- opportunities ----------------------------- */

const BLANK_OPP = {
  title: '', org: '', description: '', url: '', type: 'program',
  deadline: '', cost: 'free', format: 'online', location: '',
  age_min: 14, age_max: 17, status: 'live',
};

function OpportunityForm({ value, onChange, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Field label="Title">
        <input className="field" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} required />
      </Field>
      <Field label="Organisation">
        <input className="field" value={value.org} onChange={(e) => onChange({ ...value, org: e.target.value })} />
      </Field>
      <Field label="Link">
        <input className="field" type="url" value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://" />
      </Field>
      <Field label="Description">
        <textarea className="field" rows={3} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <select className="field" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Cost">
          <select className="field" value={value.cost} onChange={(e) => onChange({ ...value, cost: e.target.value })}>
            <option value="free">Free</option>
            <option value="paid">Costs money</option>
            <option value="stipend">Pays the student</option>
          </select>
        </Field>
        <Field label="Where">
          <select className="field" value={value.format} onChange={(e) => onChange({ ...value, format: e.target.value })}>
            <option value="online">Online</option>
            <option value="local">In person, near Plano</option>
            <option value="residential">Residential (houses you)</option>
          </select>
        </Field>
      </div>
      {value.format === 'local' && (
        <Field label="Address" hint="Checked against the 15-mile limit when you save. A full street address works best.">
          <input className="field" value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Deadline" hint="Leave blank for rolling.">
          <input className="field" type="date" value={value.deadline ?? ''} onChange={(e) => onChange({ ...value, deadline: e.target.value })} />
        </Field>
        <Field label="Youngest age">
          <input className="field mono" type="number" value={value.age_min} onChange={(e) => onChange({ ...value, age_min: e.target.value })} />
        </Field>
        <Field label="Oldest age">
          <input className="field mono" type="number" value={value.age_max} onChange={(e) => onChange({ ...value, age_max: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">{submitLabel}</button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function OpportunitiesTab({ say }) {
  const [items, setItems] = useState(null);
  const [draft, setDraft] = useState(BLANK_OPP);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/opportunities').then((d) => setItems(d.opportunities)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!items) return <Spinner />;
  const live = items.filter((o) => o.status === 'live');

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] lg:items-start">
      <Section
        title={editing ? 'Edit opportunity' : 'Add an opportunity'}
        hint="In-person entries are rejected if they geocode to more than 15 miles from school."
      >
        <OpportunityForm
          value={editing ?? draft}
          onChange={editing ? setEditing : setDraft}
          submitLabel={editing ? 'Save changes' : 'Add to the board'}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) {
              act(() => api.patch(`/admin/opportunities/${editing.id}`, editing), 'Saved.', () =>
                setEditing(null)
              );
            } else {
              act(() => api.post('/admin/opportunities', draft), 'Added to the board.', () =>
                setDraft(BLANK_OPP)
              );
            }
          }}
        />
      </Section>

      <Section title={`Live on the board (${live.length})`}>
        <ul className="grid gap-2">
          {live.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.title}</p>
                <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                  {TYPE_LABELS[o.type] ?? o.type} · {FORMAT_LABELS[o.format] ?? o.format}
                  {o.distance_mi != null && ` · ${o.distance_mi} mi`}
                  {o.deadline && ` · due ${formatDate(o.deadline)}`}
                  {o.source !== 'manual' && ` · from ${o.source}`}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditing({ ...o, deadline: o.deadline ?? '' })}>
                Edit
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm(`Remove "${o.title}" from the board?`)) {
                    act(() => api.del(`/admin/opportunities/${o.id}`), 'Removed.');
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* -------------------------------- queue -------------------------------- */

function QueueTab({ say, actionsUrl }) {
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    api
      .get('/admin/opportunities')
      .then((d) => setItems(d.opportunities.filter((o) => o.status === 'pending')))
      .catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!items) return <Spinner />;

  return (
    <div className="grid gap-6">
      <Section
        title="Where these come from"
        hint="A scraper runs automatically once a week and drops anything it finds here. Nothing goes public until you approve it below."
      >
        <p className="text-[0.85rem]" style={{ color: 'var(--ink-soft)' }}>
          The search runs on GitHub, not on this site, because reading and parsing whole web pages
          is heavier than the free site plan allows. To run it right now instead of waiting for the
          weekly run, open the workflow and press <strong>Run workflow</strong>.
        </p>
        {actionsUrl ? (
          <a
            className="btn btn-primary mt-4"
            href={actionsUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'none' }}
          >
            Open the scraper on GitHub ↗
          </a>
        ) : (
          <p className="mono mt-4 text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
            Set ACTIONS_URL in wrangler.toml to link straight to it from here.
          </p>
        )}
      </Section>

      <Section title={`Waiting for approval (${items.length})`} hint="Approve what fits the club. Reject the rest and it will not come back.">
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Nothing waiting. Run a refresh above to look for more.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((o) => (
              <li key={o.id} className="rounded border p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      className="text-sm font-semibold no-underline"
                      style={{ color: 'var(--flag)' }}
                      href={o.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {o.title} ↗
                    </a>
                    <p className="mt-0.5 text-[0.78rem]" style={{ color: 'var(--ink-soft)' }}>
                      {o.description || 'No description supplied.'}
                    </p>
                    <p className="mono mt-1 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                      {o.org || 'Unknown source'} · {FORMAT_LABELS[o.format] ?? o.format}
                      {o.distance_mi != null && ` · ${o.distance_mi} mi`}
                      {o.deadline && ` · due ${formatDate(o.deadline)}`}
                      {o.needs_review === 1 && ' · address could not be checked'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        act(() => api.patch(`/admin/opportunities/${o.id}`, { status: 'live' }), 'Published.')
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => act(() => api.del(`/admin/opportunities/${o.id}`), 'Rejected.')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* -------------------------------- officers -------------------------------- */

const BLANK_OFFICER = { name: '', role: '', note: '', committee: 'main', sort_order: 0 };

function OfficersTab({ say }) {
  const [officers, setOfficers] = useState(null);
  const [form, setForm] = useState(BLANK_OFFICER);

  const load = useCallback(() => {
    api.get('/admin/officers').then((d) => setOfficers(d.officers)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!officers) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
      <Section title="Add an officer" hint="Shown on the About page.">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api.post('/admin/officers', form), `Added ${form.name}.`, () =>
              setForm({ ...BLANK_OFFICER, sort_order: officers.length })
            );
          }}
        >
          <Field label="Name">
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Role">
            <input className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="President" />
          </Field>
          <Field label="Note">
            <input className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Main CS Club" />
          </Field>
          <Field label="Committee">
            <select className="field" value={form.committee} onChange={(e) => setForm({ ...form, committee: e.target.value })}>
              <option value="main">Main CS Club</option>
              <option value="cyber">Cybersecurity Committee</option>
            </select>
          </Field>
          <button className="btn btn-primary">Add officer</button>
        </form>
      </Section>

      <Section title={`Officers (${officers.length})`}>
        {officers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No officers listed yet.</p>
        ) : (
          <ul className="grid gap-2">
            {officers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{o.name}</p>
                  <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                    {o.role}{o.note && ` · ${o.note}`} · {o.committee === 'cyber' ? 'Cyber' : 'Main'}
                  </p>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => act(() => api.del(`/admin/officers/${o.id}`), `Removed ${o.name}.`)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------- curriculum ------------------------------- */

function CurriculumTab({ say }) {
  const [topics, setTopics] = useState(null);
  const [form, setForm] = useState({ track: 'fall', title: '' });

  const load = useCallback(() => {
    api.get('/admin/curriculum').then((d) => setTopics(d.topics)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!topics) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
      <Section title="Add a topic" hint="Check topics off as covered from the list once they've actually been taught.">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const sort_order = topics.filter((t) => t.track === form.track).length;
            act(() => api.post('/admin/curriculum', { ...form, sort_order }), `Added "${form.title}".`, () =>
              setForm({ ...form, title: '' })
            );
          }}
        >
          <Field label="Track">
            <select className="field" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}>
              <option value="fall">Fall — Beginner</option>
              <option value="spring">Spring — Advanced</option>
            </select>
          </Field>
          <Field label="Topic">
            <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <button className="btn btn-primary">Add topic</button>
        </form>
      </Section>

      <Section title={`Curriculum (${topics.length} topics)`}>
        {topics.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No topics posted yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded border p-2.5">
                <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(t.covered)}
                    onChange={(e) => act(() => api.patch(`/admin/curriculum/${t.id}`, { covered: e.target.checked }))}
                  />
                  <span className="min-w-0 flex-1 text-sm" style={{ color: t.covered ? 'var(--ink-faint)' : 'var(--ink)' }}>
                    {t.title}
                  </span>
                </label>
                <span className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                  {t.track}
                </span>
                <button
                  className="btn btn-danger"
                  onClick={() => act(() => api.del(`/admin/curriculum/${t.id}`), 'Removed.')}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------ competitions ------------------------------ */

const BLANK_COMPETITION = {
  name: '', description: '', result: '', event_date: '', url: '', status: 'upcoming', sort_order: 0,
};

function CompetitionsTab({ say }) {
  const [competitions, setCompetitions] = useState(null);
  const [form, setForm] = useState(BLANK_COMPETITION);

  const load = useCallback(() => {
    api.get('/admin/competitions').then((d) => setCompetitions(d.competitions)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!competitions) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <Section title="Add a competition">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () => api.post('/admin/competitions', { ...form, sort_order: competitions.length }),
              `Added "${form.name}".`,
              () => setForm(BLANK_COMPETITION)
            );
          }}
        >
          <Field label="Name">
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Description">
            <textarea className="field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Result" hint="Leave blank until there is one.">
            <input className="field" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="2nd place, 2025-26" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" hint="Leave blank if TBD.">
              <input className="field" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="upcoming">Upcoming / ongoing</option>
                <option value="past">Past</option>
              </select>
            </Field>
          </div>
          <Field label="Link" hint="Optional.">
            <input className="field" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" />
          </Field>
          <button className="btn btn-primary">Add competition</button>
        </form>
      </Section>

      <Section title={`Competitions (${competitions.length})`}>
        {competitions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>None posted yet.</p>
        ) : (
          <ul className="grid gap-2">
            {competitions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                    {c.result || 'No result yet'}{c.event_date && ` · ${formatDate(c.event_date)}`}
                  </p>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => act(() => api.del(`/admin/competitions/${c.id}`), `Removed ${c.name}.`)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* --------------------------------- puzzles --------------------------------- */

const BLANK_PUZZLE = {
  title: '', prompt: '', answer: '', source: 'club', posted_at: '', revealed: true,
  hints: '', difficulty: '', is_current: false,
};

function PuzzlesTab({ say }) {
  const [puzzles, setPuzzles] = useState(null);
  const [form, setForm] = useState(BLANK_PUZZLE);

  const load = useCallback(() => {
    api.get('/admin/puzzles').then((d) => setPuzzles(d.puzzles)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  if (!puzzles) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] lg:items-start">
      <Section title="Add a puzzle" hint="Leave the answer blank and 'revealed' off to post this week's opener without spoiling it, then come back and fill in the answer after the meeting.">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api.post('/admin/puzzles', form), `Added "${form.title}".`, () => setForm(BLANK_PUZZLE));
          }}
        >
          <Field label="Title">
            <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <Field label="Prompt">
            <textarea className="field" rows={2} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />
          </Field>
          <Field label="Answer" hint="Shown on the site only when Revealed is checked.">
            <textarea className="field" rows={4} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
          </Field>
          <Field label="Hints" hint="One per line. Students reveal them one at a time, in this order.">
            <textarea className="field" rows={3} value={form.hints} onChange={(e) => setForm({ ...form, hints: e.target.value })} />
          </Field>
          <Field label="Difficulty">
            <select className="field" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="">Unrated</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Date">
            <input className="field" type="date" value={form.posted_at} onChange={(e) => setForm({ ...form, posted_at: e.target.value })} />
          </Field>
          <label className="mono flex items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
            <input type="checkbox" checked={form.revealed} onChange={(e) => setForm({ ...form, revealed: e.target.checked })} />
            Revealed (visible to students)
          </label>
          <label className="mono flex items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} />
            Make this the Problem of the Week
          </label>
          <button className="btn btn-primary">Add puzzle</button>
        </form>
      </Section>

      <Section title={`Puzzle archive (${puzzles.length})`}>
        {puzzles.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>None posted yet.</p>
        ) : (
          <ul className="grid gap-2">
            {puzzles.map((p) => (
              <li key={p.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                      {formatDate(p.posted_at)} · {p.revealed ? 'revealed' : 'hidden until revealed'}
                      {p.is_current ? ' · this week' : ''}
                      {p.difficulty ? ` · ${p.difficulty}` : ''}
                    </p>
                  </div>
                  {!p.revealed && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => act(() => api.patch(`/admin/puzzles/${p.id}`, { revealed: true }), 'Answer revealed.')}
                    >
                      Reveal answer
                    </button>
                  )}
                  {!p.is_current && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => act(() => api.patch(`/admin/puzzles/${p.id}`, { is_current: true }), `"${p.title}" is now this week's.`)}
                    >
                      Make current
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={() => act(() => api.del(`/admin/puzzles/${p.id}`), `Removed ${p.title}.`)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* -------------------------------- sign-ins ------------------------------- */

/**
 * Who has signed in with a school account, and the weekly email.
 *
 * Signing in does not put anyone on the leaderboard -- any district student can
 * get in, but points belong to roster students. Linking the two is the job of
 * the dropdown here.
 */
function SignInsTab({ say }) {
  const [data, setData] = useState(null);
  const [digest, setDigest] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/members').then(setData).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say, load);

  const runDigest = async (dry) => {
    setBusy(true);
    try {
      setDigest(await api.post('/admin/digest', { dry }));
      if (!dry) say('Digest sent.');
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner />;

  const optedIn = data.members.filter((m) => m.email_opt_in && m.personal_email).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <Section title={`Signed-in members (${data.members.length})`} hint="Everyone who has signed in with an @mypisd.net account. Link someone to a roster student so their points show up on their own profile.">
        {data.members.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Nobody has signed in yet.</p>
        ) : (
          <ul className="grid gap-2">
            {data.members.map((m) => (
              <li key={m.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{m.full_name || m.school_email}</p>
                    <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                      {m.school_email}
                      {m.personal_email && ` · ${m.personal_email}`}
                      {m.email_opt_in ? ' · subscribed' : ''}
                      {m.last_login_at && ` · last in ${relativeDate(m.last_login_at)}`}
                    </p>
                  </div>
                  <select
                    className="field w-44"
                    value={m.student_id ?? ''}
                    onChange={(e) =>
                      act(
                        () => api.patch(`/admin/members/${m.id}`, { student_id: e.target.value }),
                        'Link updated.'
                      )
                    }
                  >
                    <option value="">Not on the roster</option>
                    {data.students.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Weekly email" hint="Sends every Monday, automatically, and only when something actually happened since the last one. Preview first -- it shows exactly what would go out.">
        <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
          {optedIn} subscribed of {data.members.length} signed in
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={() => runDigest(true)}>
            Preview
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => runDigest(false)}>
            Send now
          </button>
        </div>
        {digest && (
          <div className="mt-4 border-t pt-3">
            {digest.skipped ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{digest.skipped}</p>
            ) : (
              <>
                <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
                  {digest.subject} · {digest.sent} of {digest.recipients} sent
                </p>
                {digest.sample && (
                  <pre className="mono mt-2 max-h-72 overflow-auto rounded p-3 text-[0.65rem] whitespace-pre-wrap" style={{ background: 'var(--paper-2)' }}>
                    {digest.sample}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------- page text ------------------------------- */

const TEXT_FIELDS = [
  ['club_name', 'Club name', 'input'],
  ['school_name', 'School name', 'input'],
  ['tagline', 'Tagline', 'input'],
  ['prize_title', 'Prize name', 'input'],
  ['prize_blurb', 'Prize description', 'textarea'],
  ['about_heading', 'About page heading', 'input'],
  ['about_body', 'About page text', 'textarea'],
  ['discord_url', 'Discord invite link', 'input'],
  ['email', 'Contact email', 'input'],
  ['cyber_intro', 'Cyber page intro', 'textarea'],
  ['cyber_body', 'Cyber page text', 'textarea'],
  ['join_intro', 'Join page intro', 'textarea'],
  ['join_consent_url', 'Parent consent form link', 'input'],
  ['join_classroom_code', 'Google Classroom code', 'input'],
  ['join_meeting_info', 'Meeting day, time, and room', 'textarea'],
  ['meetings_calendar_embed_url', 'Meetings calendar embed URL', 'input'],
  ['meetings_calendar_subscribe_url', 'Meetings calendar subscribe (ICS) URL', 'input'],
  ['firecrawl_urls', 'Firecrawl pages to scrape', 'textarea'],
];

function TextTab({ say }) {
  const [settings, setSettings] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/settings').then((d) => setSettings(d.settings)).catch((e) => say(e.message, 'bad'));
  }, [say]);
  useEffect(load, [load]);
  const act = useAction(say);

  if (!settings) return <Spinner />;

  return (
    <Section title="Page text" hint="Everything the site says, in one place. The About page understands ## for headings and - for bullet points.">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => api.put('/admin/settings', { settings }), 'Saved.');
        }}
      >
        {TEXT_FIELDS.map(([key, label, kind]) => (
          <Field
            key={key}
            label={label}
            hint={
              key === 'firecrawl_urls'
                ? 'One URL per line. The weekly scraper reads these, and only uses them if a Firecrawl key is configured.'
                : key === 'meetings_calendar_embed_url'
                  ? "From Google Calendar: Settings → your calendar → Integrate calendar → copy the URL inside src=\"...\" from the embed code. The calendar must be set to public first."
                  : key === 'meetings_calendar_subscribe_url'
                    ? 'Same settings page, further down: "Public URL to this calendar." Lets a student add it to their own calendar, not just view it here.'
                    : undefined
            }
          >
            {kind === 'textarea' ? (
              <textarea
                className="field"
                rows={key === 'about_body' || key === 'cyber_body' ? 16 : 3}
                value={settings[key] ?? ''}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            ) : (
              <input
                className="field"
                value={settings[key] ?? ''}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            )}
          </Field>
        ))}
        <button className="btn btn-primary justify-self-start">Save page text</button>
      </form>
    </Section>
  );
}

/* -------------------------------- backup -------------------------------- */

function BackupTab({ say }) {
  const fileRef = useRef(null);

  const restore = async (file) => {
    if (!file) return;
    if (!confirm('Restoring replaces everything currently on the site with the contents of this file. Continue?')) return;
    try {
      const backup = JSON.parse(await file.text());
      await api.post('/admin/restore', backup);
      say('Restored. Reload the page to see it.');
    } catch (err) {
      say(err.message, 'bad');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Section
        title="Download a backup"
        hint="Everything — members, points, badges, opportunities, page text — as one file. Do this before big changes, and once a month otherwise."
      >
        <a className="btn btn-primary" href="/api/admin/backup" style={{ textDecoration: 'none' }}>
          Download backup file
        </a>
      </Section>

      <Section title="Restore from a backup" hint="Replaces all current data with the file's contents. There is no undo.">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="field"
          onChange={(e) => restore(e.target.files?.[0])}
        />
      </Section>
    </div>
  );
}
