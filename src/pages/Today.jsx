/**
 * Today (`/` signed in, Wave 4; v2-spec section 3). The app knows the time:
 *   live room    the room takes the top and the one primary button
 *   meeting day  the meeting card says Today
 *   other days   the next meeting sits beside your standing
 * Then one next step (chosen on the server by pickNext in worker/hub/dashboard.js),
 * this week (daily problem, ship cycle, saved deadlines), the club feed, and your
 * standing as a small bracket. No rank before your first meeting.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Lightning,
  Hammer,
  BookmarkSimple,
  HandsClapping,
  Flag,
  Plus,
  CalendarBlank,
  CheckCircle,
  Tray,
} from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/ui.js';
import { useClub, pointsOf } from '../lib/club.js';
import { parseTs } from '../lib/season.js';
import { whenLabel } from '../../shared/planner.js';
import { daysUntil } from '../lib/format.js';
import ReportButton from '../components/ReportButton.jsx';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  MeetingCard,
  PageHeader,
  PersonRow,
  Pill,
  Section,
  Skeleton,
  SkeletonList,
  deadlineLine,
  useToast,
  cx,
} from '../ui/index.js';

/* --------------------------------- helpers --------------------------------- */

/** "5m", "3h", "yesterday", "4d", then a date. */
function ago(at) {
  const t = parseTs(at);
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  const d = Math.round(m / 1440);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const chicago = (opts) => new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', ...opts });
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
/** The next date (YYYY-MM-DD, Central) that falls on a weekday name like "Wednesday", today included. */
function nextOn(dayName) {
  const want = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
  if (want < 0) return null;
  const d = new Date(`${todayIso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((want - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

/* -------------------------------- live room -------------------------------- */

function LiveRoom({ m }) {
  return (
    <Card className="td-live ui-enter" aria-labelledby="td-live-t">
      <div className="td-live__l">
        <p className="td-live__k">
          <i className="ui-live__dot" aria-hidden="true" />
          Live now{m.since && ago(m.since) !== 'now' ? `, started ${ago(m.since)}` : ''}
        </p>
        <h2 id="td-live-t" className="td-live__t">{m.title || 'Club meeting'}</h2>
        <p className="ui-small">
          Room code <span className="td-live__code">{m.code}</span>
          {m.here && <>. You are checked in.</>}
        </p>
      </div>
      <Button to={`/room/${m.code}`} variant={m.here ? 'secondary' : 'primary'} size="lg" iconRight={ArrowRight}>
        {m.here ? 'Back to the room' : 'Join the room'}
      </Button>
    </Card>
  );
}

/* --------------------------------- next step -------------------------------- */

function NextStep({ n, primary, onClaimed }) {
  const toast = useToast();
  const claim = async () => {
    try {
      await api.post('/claims', { kind: 'compete', ref: `opp:${n.oppId}`, title: n.oppTitle });
      toast('Sent. An officer will confirm it.');
      onClaimed();
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };
  return (
    <Card className="td-next" aria-labelledby="td-next-t">
      <p className="ui-label">Your next step</p>
      <h2 id="td-next-t" className="td-next__t">{n.title}</h2>
      <p className="td-next__why">{n.why}</p>
      <div className="td-next__act">
        {n.kind === 'claim' ? (
          <>
            <Button variant={primary ? 'primary' : 'secondary'} size="lg" onClick={claim}>{n.cta}</Button>
            <Button variant="ghost" to="/opportunities">I did not enter</Button>
          </>
        ) : (
          <Button variant={primary ? 'primary' : 'secondary'} size="lg" to={n.to} iconRight={ArrowRight}>{n.cta}</Button>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------- this week -------------------------------- */

function Row({ icon: Icon, to, title, meta, soon, done }) {
  return (
    <li>
      <Link to={to} className="td-row">
        <Icon size={20} aria-hidden="true" className="td-row__i" />
        <span className="td-row__t">{title}</span>
        <span className={cx('td-row__m', soon && 'td-row__m--soon', done && 'td-row__m--done')}>
          {done && <CheckCircle size={16} weight="fill" aria-hidden="true" />}
          {meta}
        </span>
      </Link>
    </li>
  );
}

function ThisWeek({ deadlines }) {
  const daily = useApi('/daily').data;
  const cycle = useApi('/cycles').data?.current?.cycle;
  const rows = [];
  if (daily?.problem)
    rows.push(
      <Row key="daily" icon={Lightning} to="/daily" title={`Daily problem: ${daily.problem.title}`}
        done={Boolean(daily.mine?.solved_at)}
        meta={daily.mine?.solved_at ? 'Solved' : daily.stats.solved ? `${daily.stats.solved} solved today` : 'New today'} />
    );
  if (cycle?.demo_on) {
    const n = daysUntil(cycle.demo_on);
    if (n != null && n >= 0)
      rows.push(
        <Row key="cycle" icon={Hammer} to="/build" title={`${cycle.title}: demo day`} soon={n <= 3}
          meta={n === 0 ? 'Today' : `${whenLabel(cycle.demo_on)}, in ${n} day${n === 1 ? '' : 's'}`} />
      );
  }
  for (const o of deadlines) {
    const d = deadlineLine(o.deadline);
    rows.push(<Row key={`o${o.id}`} icon={BookmarkSimple} to={`/opportunities?q=${encodeURIComponent(o.title)}`} title={o.title} meta={d.text} soon={d.soon} />);
  }
  return (
    <Section title="This week" action={<Button variant="ghost" to="/opportunities" iconRight={ArrowRight}>Opportunities</Button>}>
      {rows.length ? (
        <ul className="td-rows">{rows}</ul>
      ) : (
        <EmptyState icon={Tray} action={<Button to="/opportunities">Browse opportunities</Button>}>
          Nothing due. Save an opportunity and its deadline shows up here.
        </EmptyState>
      )}
    </Section>
  );
}

/* ----------------------------------- feed ----------------------------------- */

const VERB = {
  attend: (t) => `came to ${t || 'a meeting'}`,
  compete: (t) => `competed in ${t || 'a contest'}`,
  place: (t) => `placed at ${t || 'a contest'}`,
  ship: (t) => `shipped ${t || 'a project'}`,
  mentor: (t) => `helped a clubmate${t ? ` with ${t}` : ''}`,
  solve: (t) => `solved ${t || 'a problem'}`,
  idea: () => 'shared an idea for the club',
  daily: () => 'solved the daily problem',
  duel: (t) => `played a duel${t ? `: ${t}` : ''}`,
  manual: (t) => (t ? `was recognised for ${t}` : 'was recognised by an officer'),
  quest: (t) => `finished a quest${t ? `: ${t}` : ''}`,
  dropin: () => 'dropped in to Panther Pause',
};
// A ref like "room:ABCD" is not a title a person wrote.
const human = (t) => (/^[a-z-]+:\S*$/.test(t ?? '') || /^\d{4}-\d\d-\d\d$/.test(t ?? '') ? '' : t);

function Feed() {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(false);
  const [all, setAll] = useState(false);
  const toast = useToast();
  const load = () => {
    setErr(false);
    api.get('/feed').then((r) => setFeed(r.feed)).catch(() => setErr(true));
  };
  useEffect(load, []);

  const kudos = async (f) => {
    try {
      const r = f.mine ? await api.del(`/feed/${f.id}/kudos`) : await api.post(`/feed/${f.id}/kudos`);
      setFeed((xs) => xs.map((x) => (x.id === f.id ? { ...x, kudos: r.kudos, mine: r.mine } : x)));
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };

  let body;
  if (err) body = <ErrorState onRetry={load}>The club feed did not load.</ErrorState>;
  else if (!feed) body = <SkeletonList rows={4} label="Loading the club feed" />;
  else if (!feed.length)
    body = <EmptyState action={<Button to="/room">Join a room</Button>}>Nothing yet this season. Meetings, projects and contests show up here.</EmptyState>;
  else
    body = (
      <>
        <ul className="td-feed">
          {(all ? feed : feed.slice(0, 8)).map((f) => {
            const what = (VERB[f.kind] ?? (() => 'did something'))(human(f.title));
            return (
              <li key={f.id} className="td-feed__i">
                <span className="ui-av tr-explore" aria-hidden="true">{(f.name || '?')[0]}</span>
                <p className="td-feed__t">
                  <b>{f.own ? 'You' : f.name}</b> {what}
                  <span className="td-feed__ago">{ago(f.at)}</span>
                </p>
                {f.own ? (
                  f.kudos > 0 && <span className="td-feed__k">{f.kudos} kudos</span>
                ) : (
                  <span className="td-feed__acts">
                    <button type="button" className={cx('td-kudos', f.mine && 'is-on')} aria-pressed={f.mine} onClick={() => kudos(f)}
                      aria-label={`${f.mine ? 'Take back kudos from' : 'Give kudos to'} ${f.name} for ${what}`}>
                      <HandsClapping size={18} weight={f.mine ? 'fill' : 'regular'} aria-hidden="true" />
                      {f.kudos > 0 && <span>{f.kudos}</span>}
                    </button>
                    <ReportButton kind="feed" id={f.id} what={`${f.name}'s update`} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {feed.length > 8 && !all && <Button variant="ghost" onClick={() => setAll(true)}>Show {feed.length - 8} more</Button>}
      </>
    );
  return <Section title="Club feed">{body}</Section>;
}

/* --------------------------------- standing --------------------------------- */

function Standing({ s, firstMeeting, attendPts, meeting, onClaim }) {
  if (firstMeeting)
    return (
      <Card className="td-first">
        <p className="td-first__t">Your first meeting earns {attendPts ?? 'you'} points</p>
        <p className="ui-small">
          {meeting ? `${meeting.day}s at ${meeting.time}. ` : ''}Your place in the standings shows up after it.
        </p>
        <Button variant="ghost" icon={Plus} onClick={onClaim}>Claim something you did</Button>
      </Card>
    );
  return (
    <Card className="td-stand" aria-labelledby="td-stand-t">
      <div className="td-stand__h">
        <h2 id="td-stand-t" className="ui-heading">Your standing</h2>
        <Link to="/compete" className="td-link">Full standings</Link>
      </div>
      <p className="td-stand__pts">
        <span className="td-stand__n">{s.points}</span> points this season
        {s.rank && <span className="ui-small">, {ordinal(s.rank)} of {s.of}</span>}
      </p>
      {s.near.length > 0 && (
        <ol className="td-bracket" aria-label="You and the members around you">
          {s.near.map((r, i) => (
            <li key={i}>
              <PersonRow rank={r.rank} name={r.name} stat={r.points} me={r.me} track={r.me ? 'contest' : 'explore'} />
            </li>
          ))}
        </ol>
      )}
      <p className="ui-small td-stand__week">
        {s.week > 0 ? `${s.week} ${s.week === 1 ? 'thing' : 'things'} counted this week.` : 'Nothing counted yet this week. A meeting is the fastest.'}
      </p>
      <Button variant="ghost" icon={Plus} onClick={onClaim}>Claim something you did</Button>
    </Card>
  );
}

/* ---------------------------------- claims ---------------------------------- */

const CLAIM_KINDS = [['compete', 'I competed'], ['place', 'I placed'], ['ship', 'I shipped a project']];
const CLAIM_WORD = { compete: 'Competed', place: 'Placed', ship: 'Shipped' };

/** A3 claims and the older-entry link request, in one dialog. */
function ClaimDialog({ open, onOpenChange }) {
  const [d, setD] = useState(null);
  const [link, setLink] = useState(null);
  const [pick, setPick] = useState('');
  const [form, setForm] = useState({ kind: 'compete', title: '', proof_url: '', place: '' });
  const [err, setErr] = useState('');
  const toast = useToast();
  const load = () => {
    api.get('/me/claims').then(setD).catch((e) => setErr(e.message));
    api.get('/me/link').then(setLink).catch(() => {});
  };
  useEffect(() => {
    if (open) load();
  }, [open]);

  const send = async (body) => {
    setErr('');
    try {
      const r = await api.post('/claims', body);
      toast(r.status === 'approved' ? `Approved, +${r.awarded} points` : 'Sent. An officer will check it.');
      setForm({ kind: 'compete', title: '', proof_url: '', place: '' });
      load();
    } catch (e) {
      setErr(e.message);
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const asks = d?.interests.filter((o) => !o.deadline || daysUntil(o.deadline) < 0) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Claim something you did" description="Competitions, placings and shipped projects. An officer confirms each one.">
      {asks.map((o) => (
        <div key={o.id} className="td-ask">
          <span>Did you compete in <b>{o.title}</b>?</span>
          <Button onClick={() => send({ kind: 'compete', ref: `opp:${o.id}`, title: o.title })}>I competed</Button>
        </div>
      ))}
      <form
        className="td-claim"
        onSubmit={(e) => {
          e.preventDefault();
          send({ ...form, place: form.kind === 'place' ? form.place : '' });
        }}
      >
        <Field as="select" label="What happened" value={form.kind} onChange={set('kind')}>
          {CLAIM_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Field>
        <Field label="What was it" required minLength={3} maxLength={120} value={form.title} onChange={set('title')} placeholder="USACO December" />
        {form.kind === 'place' && <Field label="Your place" type="number" min="1" max="1000" required value={form.place} onChange={set('place')} />}
        <Field label="Proof link (optional)" type="url" pattern="https://.*" maxLength={500} value={form.proof_url} onChange={set('proof_url')} placeholder="https://" helper="A results page, a repo or a certificate." />
        {err && <p className="ui-field__e" role="alert">{err}</p>}
        <Button type="submit" variant="primary">Send claim</Button>
      </form>
      {d?.claims.length > 0 && (
        <ul className="td-claims">
          {d.claims.slice(0, 4).map((c) => (
            <li key={c.id}>
              <span>{CLAIM_WORD[c.kind]} {c.title}</span>
              <Pill tone={c.status === 'approved' ? 'live' : c.status === 'rejected' ? 'need' : 'neutral'}>
                {c.status === 'approved' ? `+${c.points}` : c.status}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      {link?.pending ? (
        <p className="ui-small td-oldentry">Waiting for an officer to confirm you are {link.pending.name}.</p>
      ) : link?.students?.length > 0 ? (
        <details className="td-oldentry">
          <summary>On the board before you made an account?</summary>
          <form
            className="td-claim"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.post('/me/link', { student_id: Number(pick) });
                toast('Sent to the officers.');
                load();
              } catch (x) {
                setErr(x.message);
              }
            }}
          >
            <Field as="select" label="Your older entry" required value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Pick your name</option>
              {link.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Field>
            <Button type="submit" disabled={!pick}>Ask an officer to merge it</Button>
          </form>
        </details>
      ) : null}
    </Dialog>
  );
}

/* ----------------------------------- page ----------------------------------- */

function TodaySkeleton() {
  return (
    <div className="ui-page" role="status" aria-label="Loading Today">
      <Skeleton kind="title" />
      <div className="td-grid td-grid--sk">
        <div className="td-main"><Skeleton kind="block" /><SkeletonList rows={3} /></div>
        <div className="td-side"><Skeleton kind="block" /><Skeleton kind="block" /></div>
      </div>
    </div>
  );
}

export default function Today({ user }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const club = useClub();
  const nav = useNavigate();
  const { search } = useLocation();
  const load = () => {
    setError('');
    api.get('/me/dashboard').then(setD).catch((e) => setError(e.message));
  };
  useEffect(load, []);
  useEffect(() => {
    if (/claim=1/.test(search)) setClaimOpen(true);
  }, [search]);

  // First sign-in: send them to the compass once per browser. Skipping is one click there.
  useEffect(() => {
    if (!d?.compassDue) return;
    try {
      if (localStorage.getItem('compass-offered')) return;
      localStorage.setItem('compass-offered', '1');
    } catch {
      return;
    }
    nav('/compass');
  }, [d, nav]);

  if (error)
    return (
      <div className="ui-page">
        <ErrorState onRetry={load}>{error}</ErrorState>
      </div>
    );
  if (!d) return <TodaySkeleton />;

  const first = (user.name || '').split(' ')[0] || 'there';
  const live = d.meeting.kind === 'live' ? d.meeting : null;
  const m = club?.meeting;
  const next = club?.next;
  const today = todayIso();
  const regular = m && nextOn(m.day);
  const meetingToday = Boolean((next && next.date === today) || regular === today);
  const nextDate = next?.date ?? regular;

  return (
    <div className="ui-page td">
      {live && <LiveRoom m={live} />}
      <PageHeader
        title={`Hey, ${first}`}
        subtitle={meetingToday && !live ? `${chicago({ weekday: 'long', month: 'long', day: 'numeric' })}. Meeting today at ${m?.time}.` : chicago({ weekday: 'long', month: 'long', day: 'numeric' })}
      />
      <div className="td-grid">
        <div className="td-main">
          <NextStep n={d.next} primary={!live || live.here} onClaimed={load} />
          <ThisWeek deadlines={d.deadlines} />
          <Feed />
        </div>
        <aside className="td-side" aria-label="Meeting and standing">
          {!live && m && (
            <MeetingCard
              today={meetingToday}
              when={meetingToday ? whenLabel(today) : nextDate ? whenLabel(nextDate) : `${m.day}s`}
              time={m.time}
              place={m.place}
              title={next?.title || (d.meeting.kind === 'planned' && !d.meeting.plan ? d.meeting.info : 'Weekly meeting')}
              kind={next?.kind}
              speaker={next?.speaker}
              note={!next && d.meeting.extra ? d.meeting.extra : undefined}
              action={meetingToday ? <Button to="/room" variant="secondary" icon={CalendarBlank}>Have a code? Join</Button> : null}
            />
          )}
          <Standing s={d.season} firstMeeting={d.meetings === 0} attendPts={pointsOf(club, 'attend')} meeting={m} onClaim={() => setClaimOpen(true)} />
          <nav className="td-quick" aria-label="Your pages">
            <Link to="/quests" className="td-link"><Flag size={16} aria-hidden="true" />Quests, {d.quests.done} of {d.quests.total} done</Link>
            {d.projects.length > 0 ? (
              <Link to={`/u/${user.id}`} className="td-link"><Hammer size={16} aria-hidden="true" />{d.projects.length} recent project{d.projects.length === 1 ? '' : 's'}</Link>
            ) : (
              <Link to="/build" className="td-link"><Hammer size={16} aria-hidden="true" />Post your first project</Link>
            )}
          </nav>
        </aside>
      </div>
      <ClaimDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </div>
  );
}
