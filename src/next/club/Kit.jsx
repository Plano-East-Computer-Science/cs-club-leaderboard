/**
 * /club/kits/:id: one meeting format as a ready-to-run kit, plus the kit
 * builder: pick a date and it dates every prep task (ticks are remembered on
 * this device), fills in the announcement, and lets an officer send the plan
 * straight to HQ's planner so the room opens with the agenda loaded.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PaperPlaneTilt, CheckCircle } from '@phosphor-icons/react';
import { Button, EmptyState, Field, useSession, useToast } from '../../ui/index.js';
import { useApi } from '../../lib/ui.js';
import { api } from '../../lib/api.js';
import { formatById, prepSchedule, announcement, blockClock, formatMinutes } from '../../../shared/next/club/formats.js';
import { nextWeekday, shortDay, daysFromToday } from './dates.js';
import { CopyBlock } from './Prose.jsx';
import './club.css';

const isOfficer = (u) => u?.role === 'officer' || u?.role === 'lead';

function useTicks(key) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  };
  const [ticks, setTicks] = useState(read);
  const [k, setK] = useState(key);
  if (k !== key) {
    setK(key);
    setTicks(read());
  }
  const toggle = (i) => {
    const next = { ...ticks, [i]: !ticks[i] };
    setTicks(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode: ticks last for this visit */
    }
  };
  return [ticks, toggle];
}

function dueWords(due) {
  const n = daysFromToday(due);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

export default function Kit() {
  const { id } = useParams();
  const f = formatById(id);
  const { user } = useSession();
  const toast = useToast();
  const club = useApi('/club').data;
  const meeting = club?.meeting;
  const [date, setDate] = useState(() => nextWeekday('Wednesday'));
  const [title, setTitle] = useState(f?.name ?? '');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ticks, toggle] = useTicks(`next:kit:${id}:${date}`);

  const steps = useMemo(() => (f && date ? prepSchedule(f, date) : []), [f, date]);
  const clock = useMemo(() => (f ? blockClock(f, meeting?.time || '4:30 PM') : []), [f, meeting?.time]);

  if (!f)
    return (
      <div className="ui-page">
        <EmptyState action={<Button to="/club" variant="secondary">See all meeting kinds</Button>}>There is no meeting kit with that name.</EmptyState>
      </div>
    );

  const sendToHq = async () => {
    setBusy(true);
    try {
      const blocks = f.blocks.map(({ type, title: t, minutes, screen, notes, duel, contest, speaker }) => ({
        type,
        title: t,
        minutes,
        screen,
        notes: notes ?? '',
        ...(duel && { duel }),
        ...(contest && { contest }),
        ...(speaker && { speaker }),
      }));
      const plan = await api.post('/admin/hub/planner', { date, title: title.trim() || f.name, template: f.template, blocks });
      setSent(plan);
      toast?.('Plan sent to HQ');
    } catch (e) {
      toast?.(e.message || 'That did not send.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const doneCount = steps.filter((_, i) => ticks[i]).length;

  return (
    <div className="ui-page cl-page cl-kit">
      <Link to="/club" className="cl-back">
        <ArrowLeft size={16} aria-hidden="true" /> All meetings
      </Link>
      <header className="cl-kit__h">
        <h1 className="ui-display-l">{f.name}</h1>
        <p className="cl-kit__line">{f.line}</p>
        <p className="cl-muted">
          <strong>Best for:</strong> {f.bestFor}
        </p>
      </header>

      <div className="cl-kit__grid">
        <div className="cl-kit__main">
          <section className="cl-sec" aria-labelledby="k-run">
            <h2 className="cl-h2" id="k-run">Run of show, {formatMinutes(f)} minutes</h2>
            <ol className="cl-time cl-time--big">
              {clock.map((b, i) => (
                <li key={i}>
                  <span className="cl-time__at">{b.at}</span>
                  <span className="cl-time__body">
                    <span className="cl-time__t">{b.title}</span>
                    {b.screen && <span className="cl-time__s">{b.screen}</span>}
                    {b.notes && isOfficer(user) && <span className="cl-time__n">Officer note: {b.notes}</span>}
                  </span>
                  <span className="cl-time__m">{b.minutes} min</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="cl-sec" aria-labelledby="k-script">
            <h2 className="cl-h2" id="k-script">What the host says</h2>
            <ul className="cl-script">
              {f.script.map((s, i) => (
                <li key={i}>
                  <span className="cl-script__at">minute {s.at}</span>
                  <q>{s.say}</q>
                </li>
              ))}
            </ul>
          </section>

          <section className="cl-sec cl-two" aria-label="Roles and problems">
            <div>
              <h2 className="cl-h2">Roles</h2>
              <dl className="cl-dl">
                {f.roles.map((r) => (
                  <div key={r.role}>
                    <dt>{r.role}</dt>
                    <dd>{r.job}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="cl-h2">What goes wrong</h2>
              <dl className="cl-dl">
                {f.pitfalls.map((p) => (
                  <div key={p.problem}>
                    <dt>{p.problem}</dt>
                    <dd>{p.fix}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
          <p className="cl-muted">
            <strong>It worked if:</strong> {f.success}
          </p>
        </div>

        <aside className="cl-builder" aria-labelledby="k-build">
          <h2 className="cl-h2" id="k-build">Plan one</h2>
          <Field label="Meeting date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {isOfficer(user) && <Field label="Title on the site" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />}

          <h3 className="cl-h3">
            Prep checklist <span className="cl-muted">{doneCount} of {steps.length} done</span>
          </h3>
          <ul className="cl-check">
            {steps.map((s, i) => (
              <li key={i} className={ticks[i] ? 'is-done' : daysFromToday(s.due) < 0 ? 'is-late' : ''}>
                <label>
                  <input type="checkbox" checked={Boolean(ticks[i])} onChange={() => toggle(i)} />
                  <span className="cl-check__t">{s.task}</span>
                  <span className="cl-check__d">
                    {shortDay(s.due)}, {dueWords(s.due)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <h3 className="cl-h3">Announcement</h3>
          <CopyBlock text={announcement(f, { date, time: meeting?.time, place: meeting?.place })} />

          {isOfficer(user) &&
            (sent ? (
              <p className="cl-sent">
                <CheckCircle size={20} weight="fill" aria-hidden="true" /> In HQ for {shortDay(sent.date)}.{' '}
                <Link to="/hq/meetings">Open HQ Meetings</Link>
              </p>
            ) : (
              <Button variant="primary" icon={PaperPlaneTilt} onClick={sendToHq} disabled={busy || !date}>
                {busy ? 'Sending' : 'Send plan to HQ'}
              </Button>
            ))}
          <p className="cl-muted cl-bring">Members bring: {f.bring}</p>
        </aside>
      </div>
    </div>
  );
}
