/**
 * HQ Members: the roster (search, last seen, season points, a "Not seen 3
 * weeks" filter) and a member drawer at /hq/members/:id that holds every
 * per-member job the old console spread over six screens: point history,
 * award points, badges, a signed line, a verified record, merge, hide, and
 * delete behind a typed confirmation.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, UserPlus, DotsThree, Trash, Copy, EyeSlash, Eye } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { initials } from '../../lib/format.js';
import { PageHeader, Button, Pill, EmptyState, Field, Dialog, Menu, Stat, SkeletonList, useToast } from '../../ui/index.js';
import { pointLabel } from '../../../shared/points.js';
import { PRESETS } from '../officer/AdminScreens.jsx';
import { Loaded, useLoad, timeAgo, copyText } from './bits.jsx';

const FILTERS = [
  ['all', 'Everyone'],
  ['drifting', 'Not seen 3 weeks'],
  ['hidden', 'Hidden'],
];

/* ---------------------------------- drawer ---------------------------------- */

function AwardPoints({ member, onAwarded }) {
  const toast = useToast();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/points', { student_id: member.id, delta: Number(delta), reason: reason.trim() });
      toast(`${Number(delta) > 0 ? '+' : ''}${delta} points to ${member.name}.`);
      setDelta('');
      setReason('');
      onAwarded();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Award points</h3>
      <form className="hq-form" onSubmit={submit}>
        <div className="hq-chips" role="group" aria-label="Quick fills">
          {PRESETS.map((p) => (
            <button
              key={p.reason}
              type="button"
              className="hq-chip"
              onClick={() => {
                setDelta(String(p.amount));
                setReason(p.reason);
              }}
            >
              +{p.amount} {p.reason}
            </button>
          ))}
        </div>
        <div className="hq-form__row">
          <Field label="Points" type="number" inputMode="numeric" value={delta} required onChange={(e) => setDelta(e.target.value)} />
          <Field label="Reason (the member sees it)" value={reason} required maxLength={120} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div>
          <Button type="submit" disabled={busy || !delta || Number(delta) === 0 || !reason.trim()}>
            {busy ? 'Awarding' : 'Award points'}
          </Button>
        </div>
        <p className="hq-note">Attendance pays itself when a room closes. Use this for the exceptions. A negative number takes points back.</p>
      </form>
    </section>
  );
}

function History({ events, onUndo }) {
  if (!events) return <SkeletonList rows={3} label="Loading point history" />;
  if (!events.length) return <p className="hq-note">No points yet.</p>;
  return (
    <ul className="hq-hist" aria-label="Point history">
      {events.map((e) => (
        <li key={e.id}>
          <span className={`hq-hist__d ${e.delta >= 0 ? 'hq-hist__d--up' : 'hq-hist__d--down'}`}>
            {e.delta > 0 ? '+' : ''}
            {e.delta}
          </span>
          <span className="hq-hist__r" title={e.reason}>{pointLabel(e.reason)}</span>
          <span className="hq-hist__w">{timeAgo(e.created_at)}</span>
          <Button variant="ghost" size="sm" onClick={() => onUndo(e)} aria-label={`Undo ${e.delta} for ${pointLabel(e.reason)}`}>
            Undo
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Badges({ member }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const load = () => api.get('/admin/badges').then(setData).catch((e) => toast(e.message, { tone: 'bad' }));
  useEffect(() => {
    load();
  }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return null;
  const mine = new Set(data.awarded.filter((a) => a.student_id === member.id).map((a) => a.badge_id));
  const has = data.badges.filter((b) => mine.has(b.id));
  const can = data.badges.filter((b) => !mine.has(b.id));
  const give = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/badges/award', { student_id: member.id, badge_id: Number(pick) });
      toast(`Badge given to ${member.name}.`);
      setPick('');
      load();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  return (
    <section>
      <h3>Badges</h3>
      {has.length > 0 && (
        <p className="hq-chips">
          {has.map((b) => (
            <Pill key={b.id} tone="gold">{b.name}</Pill>
          ))}
        </p>
      )}
      {data.badges.length === 0 ? (
        <p className="hq-note">No badges exist yet. Make them under Season, Badges.</p>
      ) : can.length === 0 ? (
        <p className="hq-note">{member.name.split(' ')[0]} has every badge.</p>
      ) : (
        <form className="hq-inline" onSubmit={give}>
          <Field label="Give a badge" as="select" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick a badge</option>
            {can.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Field>
          <Button type="submit" disabled={!pick}>Give</Button>
        </form>
      )}
    </section>
  );
}

function Portfolio({ member }) {
  const toast = useToast();
  const [line, setLine] = useState('');
  const [record, setRecord] = useState(null);
  if (!member.userId) {
    return (
      <section>
        <h3>Signed line and verified record</h3>
        <p className="hq-note">Both need a linked account. {member.name.split(' ')[0]} is on the board only, with no account yet.</p>
      </section>
    );
  }
  const sign = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/hub/portfolio/signoffs', { user_id: member.userId, line: line.trim() });
      toast(`Signed a line for ${member.name}. It shows on their portfolio.`);
      setLine('');
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  const issue = async () => {
    try {
      const { code } = await api.post('/admin/hub/records', { user_id: member.userId });
      setRecord(`${window.location.origin}/verify/${code.replace(/(.{4})(?=.)/g, '$1-')}`);
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  return (
    <>
      <section>
        <h3>Signed line</h3>
        <form className="hq-form" onSubmit={sign}>
          <Field
            label="One sentence you have seen them earn. Shows on their portfolio with your name."
            as="textarea"
            rows={2}
            maxLength={200}
            value={line}
            placeholder="Ran the debugging table for new members three weeks in a row."
            onChange={(e) => setLine(e.target.value)}
          />
          <div>
            <Button type="submit" disabled={line.trim().length < 10}>Sign it</Button>
          </div>
        </form>
      </section>
      <section>
        <h3>Verified record</h3>
        {record ? (
          <div className="hq-form">
            <p className="hq-code">{record}</p>
            <div>
              <Button icon={Copy} onClick={() => copyText(record).then((ok) => ok && toast('Link copied.'))}>Copy the link</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="hq-note">A printable page of attendance and approved results, with a code a college can check. Issue it when they ask.</p>
            <div className="hq-row-actions">
              <Button onClick={issue}>Issue a verified record</Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Merge({ member, roster, onMerged }) {
  const toast = useToast();
  const [into, setInto] = useState('');
  const [sure, setSure] = useState(false);
  const target = roster.find((m) => String(m.id) === into);
  const merge = async () => {
    try {
      await api.post('/admin/hub/students/merge', { keep: target.id, from: member.id });
      toast(`Merged ${member.name} into ${target.name}.`);
      onMerged(target.id);
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  return (
    <section>
      <h3>Same person twice?</h3>
      <div className="hq-inline">
        <Field label="Merge this entry into" as="select" value={into} onChange={(e) => { setInto(e.target.value); setSure(false); }}>
          <option value="">Pick the entry to keep</option>
          {roster
            .filter((m) => m.id !== member.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.points} pts{m.email ? `, ${m.email}` : ''})
              </option>
            ))}
        </Field>
        {!sure && <Button disabled={!target} onClick={() => setSure(true)}>Merge</Button>}
      </div>
      {sure && target && (
        <div className="hq-confirm" role="alertdialog" aria-label="Confirm merge">
          <p>
            Move every point, badge and account from {member.name} to {target.name}? {member.name} leaves the board.
          </p>
          <div className="hq-row-actions">
            <Button variant="danger" autoFocus onClick={merge}>Merge into {target.name}</Button>
            <Button variant="ghost" onClick={() => setSure(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function DeleteConfirm({ member, onCancel, onDeleted }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const del = async (e) => {
    e.preventDefault();
    try {
      await api.del(`/admin/students/${member.id}`);
      toast(`Deleted ${member.name}.`);
      onDeleted();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  return (
    <form className="hq-confirm" role="alertdialog" aria-label={`Delete ${member.name}?`} onSubmit={del}>
      <p>
        This deletes {member.name} and every point they have earned. It cannot be undone. To hide them from the board but keep their history, use Hide
        instead.
      </p>
      <Field label={`Type ${member.name} to confirm`} value={typed} autoFocus autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
      <div className="hq-row-actions">
        <Button type="submit" variant="danger" icon={Trash} disabled={typed.trim() !== member.name.trim()}>
          Delete for good
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Drawer({ member, roster, onClose, onChanged, onGo }) {
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const loadEvents = () => api.get(`/admin/points/${member.id}`).then((d) => setEvents(d.events)).catch((e) => toast(e.message, { tone: 'bad' }));
  useEffect(() => {
    setEvents(null);
    setDeleting(false);
    loadEvents();
  }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => {
    loadEvents();
    onChanged();
  };
  const undo = async (e) => {
    try {
      await api.del(`/admin/points/${e.id}`);
      toast('Award removed.');
      changed();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  const hide = async () => {
    try {
      await api.patch(`/admin/students/${member.id}`, { active: !member.active });
      toast(member.active ? `${member.name} is hidden from the board. Their history stays.` : `${member.name} is back on the board.`);
      onChanged();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      className="hq-sheet"
      title={member.name}
      description={`${member.grade ? `Grade ${member.grade}. ` : ''}${member.email ?? 'On the board only, no account.'}`}
    >
      <div className="hq-sheet__body">
        <div className="hq-sheet__meta">
          {!member.active && <Pill>Hidden</Pill>}
          {member.drifting && <Pill tone="need">Not seen 3 weeks</Pill>}
          <span className="hq-row-actions">
            <Button icon={member.active ? EyeSlash : Eye} onClick={hide}>
              {member.active ? 'Hide' : 'Show on the board'}
            </Button>
            <Menu
              label="More actions"
              trigger={<Button variant="ghost" icon={DotsThree} aria-label="More actions" />}
              items={[{ label: 'Delete member', icon: Trash, danger: true, onSelect: () => setDeleting(true) }]}
            />
          </span>
        </div>
        {deleting && <DeleteConfirm member={member} onCancel={() => setDeleting(false)} onDeleted={() => { onChanged(); onClose(); }} />}
        <div className="hq-sheet__stats">
          <Stat value={member.seasonPoints} label="This season" />
          <Stat value={member.points} label="All time" />
          <Stat value={member.lastSeen ? timeAgo(member.lastSeen) : 'Never'} label="Last seen" />
        </div>
        <AwardPoints member={member} onAwarded={changed} />
        <section>
          <h3>Point history</h3>
          <History events={events} onUndo={undo} />
        </section>
        <Badges member={member} />
        <Portfolio member={member} />
        <Merge member={member} roster={roster} onMerged={(id) => { onChanged(); onGo(id); }} />
      </div>
    </Dialog>
  );
}

/* ---------------------------------- roster ---------------------------------- */

function AddMember({ onAdded }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const add = async (e) => {
    e.preventDefault();
    try {
      const { id } = await api.post('/admin/students', { name: name.trim(), grade });
      toast(`Added ${name.trim()}.`);
      setOpen(false);
      setName('');
      setGrade('');
      onAdded(id);
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Add a member" description="For someone on the board without an account. Accounts make their own entry." trigger={<Button icon={UserPlus}>Add member</Button>}>
      <form className="hq-form" onSubmit={add}>
        <Field label="Name" value={name} required autoFocus maxLength={80} onChange={(e) => setName(e.target.value)} />
        <Field label="Grade" as="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Not set</option>
          {[9, 10, 11, 12].map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </Field>
        <div>
          <Button type="submit" variant="primary" disabled={!name.trim()}>Add member</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Members() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(([f]) => f === params.get('filter')) ? params.get('filter') : 'all';
  const [q, setQ] = useState('');
  const state = useLoad('/admin/hub/roster');
  const qs = params.toString() ? `?${params}` : '';

  const list = useMemo(() => {
    const all = state.data?.members ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((m) => (filter === 'drifting' ? m.drifting : filter === 'hidden' ? !m.active : m.active))
      .filter((m) => !needle || m.name.toLowerCase().includes(needle) || (m.email ?? '').toLowerCase().includes(needle))
      .sort((a, b) => (filter === 'drifting' ? (a.lastSeen ?? 0) - (b.lastSeen ?? 0) : b.seasonPoints - a.seasonPoints || a.name.localeCompare(b.name)));
  }, [state.data, filter, q]);

  const counts = useMemo(() => {
    const all = state.data?.members ?? [];
    return { all: all.filter((m) => m.active).length, drifting: all.filter((m) => m.drifting).length, hidden: all.filter((m) => !m.active).length };
  }, [state.data]);

  const open = state.data?.members.find((m) => String(m.id) === id) ?? null;
  const go = (mid) => navigate(`/hq/members/${mid}${qs}`);

  return (
    <>
      <PageHeader title="Members" subtitle="Everyone on the board, when they were last seen, and their season." actions={<AddMember onAdded={(nid) => state.reload().then(() => go(nid))} />} />
      <div className="hq-bar">
        <div className="hq-search">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input className="ui-input" type="search" value={q} placeholder="Search by name or email" aria-label="Search members" onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="hq-filters" role="group" aria-label="Show">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" className="hq-filter" aria-pressed={filter === f} onClick={() => setParams(f === 'all' ? {} : { filter: f }, { replace: true })}>
              {label} <span className="hq-filter__n">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <Loaded state={state} rows={8} label="Loading members">
        {() =>
          list.length === 0 ? (
            <div className="hq-panel">
              <EmptyState>
                {q ? `Nobody matches "${q}".` : filter === 'drifting' ? 'Everyone active has been seen in the last 3 weeks.' : filter === 'hidden' ? 'Nobody is hidden.' : 'No members yet.'}
              </EmptyState>
            </div>
          ) : (
            <div className="hq-panel">
              <table className="hq-table">
                <caption className="sr-only">Members, {list.length} shown</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col" className="hq-hide-sm">Grade</th>
                    <th scope="col" className="r">Season</th>
                    <th scope="col" className="r hq-hide-sm">All time</th>
                    <th scope="col">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <button type="button" className="hq-who" onClick={() => go(m.id)}>
                          <span className="ui-av tr-explore" aria-hidden="true">{initials(m.name)}</span>
                          <span className="hq-who__n">
                            {m.name}
                            <span className="hq-who__e">{m.email ?? 'Board only'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="hq-hide-sm">{m.grade ?? ''}</td>
                      <td className="r hq-num">{m.seasonPoints}</td>
                      <td className="r hq-num hq-hide-sm">{m.points}</td>
                      <td className={m.drifting ? 'hq-stale' : undefined}>{m.lastSeen ? timeAgo(m.lastSeen) : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {id && state.data && !open && (
        <EmptyState action={<Button to={`/hq/members${qs}`}>Back to members</Button>}>That member is not on the board any more.</EmptyState>
      )}
      {open && <Drawer member={open} roster={state.data.members} onClose={() => navigate(`/hq/members${qs}`)} onChanged={state.reload} onGo={go} />}
    </>
  );
}
