/**
 * HQ Meetings: one timeline of planned sessions and held rooms. Upcoming rows
 * open their room (with the planned blocks) or go to the plan editor; past
 * rows show the room code, check-ins, points paid and takeaways. "Quick room"
 * opens an unplanned room (a Panther Pause drop-in, say). The plan editor is
 * src/pages/officer/Planner.jsx; the ideas board status lives here too.
 */
import { useState } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Lightning, ArrowLeft, DotsThree, Trash, CalendarPlus } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { PageHeader, Button, Pill, EmptyState, Field, Dialog, Menu, useToast } from '../../ui/index.js';
import { TEMPLATES, LENGTHS, DEFAULT_LENGTH } from '../../../shared/session-templates.js';
import { kindName } from '../../../shared/planner.js';
import { nextWeekday } from '../../../shared/hq.js';
import { PlanEditor, blankPlan } from '../officer/Planner.jsx';
import { useLoad, Loaded, HqTabs, timeAgo, dayLabel, CloseConfirm } from './bits.jsx';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const sum = (blocks) => blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);
const ymdOfMs = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

function DateTile({ ymd, today }) {
  const d = new Date(`${ymd}T12:00:00Z`);
  const opt = (o) => d.toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
  return (
    <span className={`hq-date ${ymd === today ? 'hq-date--today' : ''}`} aria-hidden="true">
      <span className="hq-date__m">{ymd === today ? 'Today' : opt({ month: 'short' })}</span>
      <span className="hq-date__d">{opt({ day: 'numeric' })}</span>
    </span>
  );
}

/* --------------------------------- rows --------------------------------- */

function PlanRow({ p, today, onChanged }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/hub/rooms', { planId: p.id });
      navigate(`/host/${r.code}`);
    } catch (e) {
      toast(e.message, { tone: 'bad' });
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await api.del(`/admin/hub/planner/${p.id}`);
      toast(`Deleted ${p.title}.`);
      onChanged();
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };
  const when = dayLabel(p.date);
  return (
    <li className="hq-meet">
      <DateTile ymd={p.date} today={today} />
      <div>
        <Link className="hq-meet__t" to={`/hq/meetings/plan/${p.id}`}>{p.title}</Link>
        <p className="hq-meet__m">
          <span>{p.date < today ? 'Date passed, not held' : when}</span>
          <span>{kindName(p.template)}</span>
          <span><span className="hq-num">{sum(p.blocks)}</span> min, {p.blocks.length} blocks</span>
        </p>
      </div>
      <div className="hq-row-actions">
        <Button variant={p.date === today ? 'primary' : 'secondary'} disabled={busy} onClick={open}>
          {busy ? 'Opening' : 'Open room'}
        </Button>
        <Button variant="ghost" to={`/hq/meetings/plan/${p.id}`}>Edit</Button>
        <Menu
          label={`More for ${p.title}`}
          trigger={<Button variant="ghost" icon={DotsThree} aria-label={`More for ${p.title}`} />}
          items={[{ label: 'Delete plan', icon: Trash, danger: true, onSelect: () => setDeleting(true) }]}
        />
      </div>
      {deleting && (
        <div className="hq-confirm" role="alertdialog" aria-label={`Delete ${p.title}?`}>
          <p>Delete the plan for {p.title}? Its blocks and notes go with it.</p>
          <div className="hq-row-actions">
            <Button variant="danger" autoFocus onClick={del}>Delete plan</Button>
            <Button variant="ghost" onClick={() => setDeleting(false)}>Keep it</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function RoomRow({ r, onChanged }) {
  const [closing, setClosing] = useState(false);
  const open = !r.closed_at;
  const ymd = ymdOfMs(r.created_at);
  const unpaid = !open && r.paidMembers < r.attendees;
  return (
    <li className="hq-meet">
      <DateTile ymd={ymd} />
      <div>
        <p className="hq-meet__t">{r.title}</p>
        <p className="hq-meet__m">
          <span className="hq-room__code">{r.code}</span>
          <span>{r.kind === 'dropin' ? 'Drop-in' : kindName(r.template)}</span>
          <span><span className="hq-num">{r.attendees}</span> checked in</span>
          {!open && <span><span className="hq-num">{r.paid}</span> points paid</span>}
        </p>
        {r.takeaways && <p className="hq-meet__take ui-clamp2">Takeaways: {r.takeaways}</p>}
      </div>
      <div className="hq-row-actions">
        {open ? (
          <>
            <Pill tone="live">Open {timeAgo(r.created_at).replace(' ago', '')}</Pill>
            <Button to={`/host/${r.code}`}>Host</Button>
            {!closing && <Button variant="danger" onClick={() => setClosing(true)}>Close and pay</Button>}
          </>
        ) : unpaid ? (
          <Pill tone="need">{r.attendees - r.paidMembers} not paid</Pill>
        ) : (
          r.attendees > 0 && <Pill>Paid</Pill>
        )}
      </div>
      {closing && <CloseConfirm room={r} onCancel={() => setClosing(false)} onClosed={onChanged} />}
    </li>
  );
}

/* ------------------------------- quick room ------------------------------- */

function QuickRoom() {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('dropin');
  const [minutes, setMinutes] = useState(DEFAULT_LENGTH);
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/admin/hub/rooms', { title: title.trim(), template, minutes });
      navigate(`/host/${r.code}`);
    } catch (err) {
      toast(err.message, { tone: 'bad' });
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Quick room"
      description="For something unplanned, like a Panther Pause drop-in. A planned meeting opens from its row instead."
      trigger={<Button icon={Lightning}>Quick room</Button>}
    >
      <form className="hq-form" onSubmit={go}>
        <Field label="Title" value={title} required autoFocus maxLength={80} placeholder="Panther Pause, Tuesday" onChange={(e) => setTitle(e.target.value)} />
        <Field label="How it runs" as="select" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="dropin">Drop-in: check-in and a help queue</option>
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <option key={id} value={id}>{t.name}</option>
          ))}
        </Field>
        {template !== 'dropin' && (
          <Field label="Length" as="select" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {LENGTHS.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </Field>
        )}
        <div>
          <Button type="submit" variant="primary" disabled={busy || !title.trim()}>{busy ? 'Opening' : 'Open room'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* -------------------------------- timeline -------------------------------- */

function Timeline({ planner, meetings }) {
  return (
    <Loaded state={planner} rows={4} label="Loading meetings">
      {(pd) => (
        <Loaded state={meetings} rows={3} label="Loading past meetings">
          {(md) => {
            const upcoming = pd.plans.filter((p) => !p.roomCode);
            const reload = () => {
              planner.reload();
              meetings.reload();
            };
            return (
              <>
                <h2 className="hq-sec-t">Upcoming</h2>
                {upcoming.length === 0 ? (
                  <div className="hq-panel">
                    <EmptyState icon={CalendarPlus} action={<Button to="/hq/meetings/plan/new">Plan a meeting</Button>}>
                      Nothing planned. Members see the next plan on Today.
                    </EmptyState>
                  </div>
                ) : (
                  <ul className="hq-panel hq-list" aria-label="Upcoming meetings">
                    {upcoming.map((p) => <PlanRow key={p.id} p={p} today={pd.today} onChanged={reload} />)}
                  </ul>
                )}
                <h2 className="hq-sec-t">Held</h2>
                {md.rooms.length === 0 ? (
                  <div className="hq-panel">
                    <EmptyState>No rooms yet. Past meetings show here with who came and what they were paid.</EmptyState>
                  </div>
                ) : (
                  <ul className="hq-panel hq-list" aria-label="Held meetings">
                    {md.rooms.map((r) => <RoomRow key={r.code} r={r} onChanged={reload} />)}
                  </ul>
                )}
              </>
            );
          }}
        </Loaded>
      )}
    </Loaded>
  );
}

/* --------------------------------- editor --------------------------------- */

function Editor({ planner, meetings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = () => navigate('/hq/meetings');
  return (
    <>
    <PageHeader
      title={id === 'new' ? 'Plan a meeting' : 'Edit the plan'}
      subtitle="Blocks, timings and notes, set before the day so nothing is decided live."
    />
    <Loaded state={planner} rows={4} label="Loading the plan">
      {(pd) => {
        const plan = id === 'new' ? blankPlan(nextWeekday(pd.today, Math.max(0, DAYS.indexOf(String(meetings.data?.meetingDay ?? 'wednesday').toLowerCase())))) : pd.plans.find((p) => String(p.id) === id);
        if (!plan) return <EmptyState action={<Button to="/hq/meetings">Back to meetings</Button>}>That plan is gone or was already held.</EmptyState>;
        if (plan.roomCode) return <EmptyState action={<Button to={`/host/${plan.roomCode}`}>Open room {plan.roomCode}</Button>}>This meeting already has a room, so its plan is locked.</EmptyState>;
        return (
          <PlanEditor
            key={id}
            plan={plan}
            data={pd}
            onCancel={back}
            onSaved={() => {
              planner.reload();
              back();
            }}
          />
        );
      }}
    </Loaded>
    </>
  );
}

/* ---------------------------------- ideas ---------------------------------- */

function Ideas() {
  const state = useLoad('/ideas');
  const toast = useToast();
  const set = (i, status) =>
    api
      .post(`/admin/hub/ideas/${i.id}/status`, { status })
      .then(() => {
        toast(status === 'hidden' ? 'Hidden from the board.' : `Marked ${status}.`);
        state.reload();
      })
      .catch((e) => toast(e.message, { tone: 'bad' }));
  return (
    <Loaded state={state} rows={5} label="Loading ideas">
      {(d) =>
        d.ideas.length === 0 ? (
          <div className="hq-panel"><EmptyState>No ideas yet. Point members at the ideas board during a meeting.</EmptyState></div>
        ) : (
          <>
            <p className="hq-note">Linking an idea to a plan marks it planned. Mark it done once it has run.</p>
            <ul className="hq-panel hq-list hq-ideas" aria-label="Ideas board">
              {d.ideas.slice(0, 40).map((i) => (
                <li key={i.id} className="hq-idea">
                  <span className="hq-idea__v" aria-label={`${i.votes} votes`}>{i.votes}</span>
                  <div>
                    <p className="hq-idea__b">{i.body}</p>
                    <p className="hq-sub">{i.kind}, from {i.author}</p>
                  </div>
                  <select className="ui-input" value={i.status} onChange={(e) => set(i, e.target.value)} aria-label={`Status of: ${i.body}`}>
                    <option value="open">Open</option>
                    <option value="planned">Planned</option>
                    <option value="done">Done</option>
                    <option value="hidden">Hide</option>
                  </select>
                </li>
              ))}
            </ul>
          </>
        )
      }
    </Loaded>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function Meetings() {
  const planner = useLoad('/admin/hub/planner');
  const meetings = useLoad('/admin/hub/meetings');
  const actions = (
    <>
      <QuickRoom />
      <Button variant="primary" icon={Plus} to="/hq/meetings/plan/new">Plan a meeting</Button>
    </>
  );
  const tabs = <HqTabs label="Meetings" items={[{ to: '/hq/meetings', label: 'Timeline', end: true }, { to: '/hq/meetings/ideas', label: 'Ideas board' }]} />;
  return (
    <Routes>
      <Route
        index
        element={
          <>
            <PageHeader title="Meetings" subtitle="Plan the next one, open its room, look back at the last." actions={actions} />
            {tabs}
            <Timeline planner={planner} meetings={meetings} />
          </>
        }
      />
      <Route
        path="ideas"
        element={
          <>
            <PageHeader title="Meetings" subtitle="What members asked for. Plan it, then mark it done." actions={actions} />
            {tabs}
            <Ideas />
          </>
        }
      />
      <Route
        path="plan/:id"
        element={
          <>
            <Button variant="ghost" icon={ArrowLeft} to="/hq/meetings" className="hq-back">Meetings</Button>
            <Editor planner={planner} meetings={meetings} />
          </>
        }
      />
    </Routes>
  );
}
