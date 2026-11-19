/**
 * HQ Home: the one page an officer opens each week. Is the next meeting
 * ready, did the last one pay, is anything waiting, who has drifted away,
 * and what is due. One primary button: open the room on the day, otherwise
 * finish the prep.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  WarningCircle,
  CalendarPlus,
  EnvelopeSimple,
  DownloadSimple,
  Copy,
  Tray,
  ArrowRight,
} from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { initials } from '../../lib/format.js';
import { PageHeader, Button, Pill, EmptyState, ErrorState, Skeleton, useToast } from '../../ui/index.js';
import { driftInvite, INBOX_KINDS } from '../../../shared/hq.js';
import { useLoad, timeAgo, dayLabel, inDays, CloseConfirm, copyText, useHq } from './bits.jsx';
import { KIND_LABEL } from './Inbox.jsx';

function Panel({ title, action, children, className }) {
  return (
    <section className={`hq-panel ${className ?? ''}`} aria-label={title}>
      <div className="hq-panel__h">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------ next meeting ------------------------------ */

function NextMeeting({ next, onOpened }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!next) {
    return (
      <Panel title="Next meeting" className="hq-o1">
        <EmptyState icon={CalendarPlus} action={<Button variant="primary" to="/hq/meetings/plan/new">Plan a meeting</Button>}>
          Nothing is planned yet. Members see the next meeting on Today once it is.
        </EmptyState>
      </Panel>
    );
  }

  const done = next.checks.filter((c) => c.ok).length;
  const open = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/hub/rooms', { planId: next.id });
      onOpened?.();
      navigate(`/host/${r.code}`);
    } catch (e) {
      toast(e.message, { tone: 'bad' });
      setBusy(false);
    }
  };

  return (
    <section className="hq-panel hq-next hq-o1" aria-label="Next meeting">
      <div className="hq-next__top">
        <div>
          <p className="hq-next__day">{next.isToday ? 'Today' : dayLabel(next.date)}</p>
          <p className="hq-next__when">{next.isToday ? dayLabel(next.date) : inDays(next.inDays)}</p>
          <p className="hq-next__title">{next.title}</p>
          <p className="hq-sub">
            {next.kind}, {next.blocks} blocks, {next.minutes} min
          </p>
        </div>
        {next.isToday && <Pill tone="gold">Meeting day</Pill>}
      </div>
      <ul className="hq-checks" aria-label="Readiness">
        {next.checks.map((c) => (
          <li key={c.id} className={`hq-check ${c.ok ? 'hq-check--ok' : 'hq-check--bad'}`}>
            {c.ok ? <CheckCircle size={20} weight="fill" aria-label="Done" /> : <WarningCircle size={20} weight="fill" aria-label="Needs work" />}
            <div>
              <p className="hq-check__l">{c.label}</p>
              {c.hint && <p className="hq-check__h">{c.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
      <div className="hq-next__foot">
        <span className="hq-score">
          {done} of {next.checks.length} ready
        </span>
        {next.isToday ? (
          <Button variant="primary" size="lg" onClick={open} disabled={busy}>
            {busy ? 'Opening' : 'Open room'}
          </Button>
        ) : (
          <Button variant="primary" size="lg" to={`/hq/meetings/plan/${next.id}`} iconRight={ArrowRight}>
            Finish prep
          </Button>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ last meeting ------------------------------ */

function Rooms({ open, last, reload }) {
  const [closing, setClosing] = useState(null);
  return (
    <Panel className="hq-o3" title={open.length ? 'Rooms still open' : 'Last meeting'} action={<Link className="hq-link-more" to="/hq/meetings">All meetings</Link>}>
      <ul className="hq-list">
        {open.map((r) => (
          <li key={r.code} className="hq-room">
            <div>
              <p className="hq-room__code">{r.code}</p>
              <p className="hq-room__t">{r.title}</p>
              <p className="hq-sub">
                Opened {timeAgo(r.created_at)}, {r.attendees} checked in. Attendance pays when it closes.
              </p>
            </div>
            <div className="hq-row-actions">
              <Button to={`/host/${r.code}`}>Host</Button>
              {closing !== r.code && (
                <Button variant="danger" onClick={() => setClosing(r.code)}>
                  Close and pay
                </Button>
              )}
            </div>
            {closing === r.code && <CloseConfirm room={r} onCancel={() => setClosing(null)} onClosed={() => { setClosing(null); reload(); }} />}
          </li>
        ))}
        {last && (
          <li className="hq-room">
            <div>
              {open.length > 0 && <p className="hq-sub">Last closed meeting</p>}
              <p className="hq-room__t">{last.title}</p>
              <p className="hq-sub">
                Closed {timeAgo(last.closed_at)}. {last.attendees} checked in, <span className="hq-num">{last.paid}</span> points paid.
              </p>
            </div>
            {last.paidMembers >= last.attendees ? (
              <Pill tone="live" icon={CheckCircle}>Attendance paid</Pill>
            ) : (
              <Pill tone="need" icon={WarningCircle}>{last.attendees - last.paidMembers} not paid</Pill>
            )}
          </li>
        )}
        {!last && open.length === 0 && (
          <li>
            <EmptyState>No meetings held yet. The first closed room shows here.</EmptyState>
          </li>
        )}
      </ul>
    </Panel>
  );
}

/* --------------------------------- inbox --------------------------------- */

function InboxCounts({ inbox }) {
  return (
    <Panel className="hq-o2" title="Inbox" action={inbox.total > 0 && <Link className="hq-link-more" to="/hq/inbox">Open inbox</Link>}>
      {inbox.total === 0 ? (
        <EmptyState icon={Tray}>Nothing waiting on an officer.</EmptyState>
      ) : (
        <ul className="hq-kinds">
          {INBOX_KINDS.map((k) => {
            const n = inbox.counts[k] ?? 0;
            return (
              <li key={k}>
                {n > 0 ? (
                  <Link className="hq-kind" to={`/hq/inbox?kind=${k}`}>
                    <span>{KIND_LABEL[k]}</span>
                    <span className="hq-kind__n hq-kind__n--on">{n}</span>
                  </Link>
                ) : (
                  <span className="hq-kind">
                    <span>{KIND_LABEL[k]}</span>
                    <span className="hq-kind__n">0</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------- due --------------------------------- */

function Due({ due }) {
  const digest = due.digest;
  return (
    <Panel title="Due this week" className="hq-o5">
      <ul className="hq-due">
        <li>
          <EnvelopeSimple size={18} aria-hidden="true" />
          <div>
            <p className="hq-due__t">
              Weekly digest goes out {digest.inDays === 0 ? 'today' : `${dayLabel(digest.date)}, ${inDays(digest.inDays)}`}
            </p>
            <Link className="hq-link-more" to="/hq/announce">Preview it</Link>
          </div>
        </li>
        <li className={due.backup.due ? 'hq-due--need' : undefined}>
          <DownloadSimple size={18} aria-hidden="true" />
          <div>
            <p className="hq-due__t">
              {due.backup.due
                ? due.backup.last
                  ? `Backup due. The last one was ${timeAgo(due.backup.last)}.`
                  : 'Backup due. None downloaded from HQ yet.'
                : `Backed up ${timeAgo(due.backup.last)}`}
            </p>
            {due.backup.due && <Link className="hq-link-more" to="/hq/settings/backup">Download a backup</Link>}
          </div>
        </li>
      </ul>
    </Panel>
  );
}

/* -------------------------------- drifting -------------------------------- */

function Drifting({ drifting, next, meeting }) {
  const toast = useToast();
  const copy = async (m) => {
    const ok = await copyText(driftInvite(m.name, { next, meeting }));
    if (ok) toast(`Copied a message for ${m.name.split(' ')[0]}. Paste it where you talk to them.`);
  };
  return (
    <Panel
      className="hq-o4"
      title="Not seen in 3 weeks"
      action={drifting.total > 0 && <Link className="hq-link-more" to="/hq/members?filter=drifting">See all {drifting.total}</Link>}
    >
      {drifting.total === 0 ? (
        <EmptyState icon={CheckCircle}>Everyone active has been seen in the last 3 weeks.</EmptyState>
      ) : (
        <ul className="hq-list">
          {drifting.members.map((m) => (
            <li key={m.id} className="hq-drift">
              <span className="ui-av tr-explore" aria-hidden="true">{initials(m.name)}</span>
              <div>
                <Link className="hq-drift__n" to={`/hq/members/${m.id}`}>{m.name}</Link>
                <p className="hq-sub">Last seen {m.days} days ago</p>
              </div>
              <Button variant="ghost" icon={Copy} onClick={() => copy(m)} aria-label={`Copy a message for ${m.name}`}>
                Copy a message
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------- page ---------------------------------- */

function HomeSkeleton() {
  return (
    <div className="hq-home" role="status" aria-label="Loading HQ">
      <div className="hq-home__col">
        <div className="hq-panel hq-panel__b"><Skeleton kind="title" /><Skeleton kind="block" /></div>
        <div className="hq-panel hq-panel__b"><Skeleton kind="line" /><Skeleton kind="line" className="ui-sk--short" /></div>
      </div>
      <div className="hq-home__col">
        <div className="hq-panel hq-panel__b"><Skeleton kind="block" /></div>
      </div>
    </div>
  );
}

export default function Home() {
  const state = useLoad('/admin/hub/home');
  const { refreshCounts } = useHq();
  const d = state.data;
  const today = d ? new Date(`${d.today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <>
      <PageHeader title="This week" subtitle={d ? `${today}. What needs you before the next meeting.` : 'What needs you before the next meeting.'} />
      {state.error && !d && <ErrorState onRetry={state.reload}>{state.error}</ErrorState>}
      {!d && !state.error && <HomeSkeleton />}
      {d && (
        <div className="hq-home">
          <div className="hq-home__col">
            <NextMeeting next={d.next} onOpened={refreshCounts} />
            <Rooms open={d.open} last={d.last} reload={state.reload} />
            <Drifting drifting={d.drifting} next={d.next} meeting={d.meeting} />
          </div>
          <div className="hq-home__col">
            <InboxCounts inbox={d.inbox} />
            <Due due={d.due} />
          </div>
        </div>
      )}
    </>
  );
}
