import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useData } from '../lib/data.jsx';
import { useUser } from '../lib/useUser.js';
import { Pane } from '../components/Pane.jsx';
import { Crest } from '../components/Crest.jsx';
import { useReveal } from '../lib/ui.js';
import { parseTs } from '../lib/season.js';
import { formatDate, daysUntil } from '../lib/format.js';
import { TIERS, tierIndex, tierProgress, nextTier } from '../lib/tiers.js';
import { PATHS } from '../../shared/compass.js';
import { QuestRow, RankBar } from './Quests.jsx';
import ReportButton from '../components/ReportButton.jsx';

export default function Home() {
  const { user, loading, signOut } = useUser();
  if (loading) return <div className="state-note">loading...</div>;
  return user ? <Today user={user} signOut={signOut} /> : <Landing />;
}

/* ---------------------------- signed out: landing ---------------------------- */

// The five things the club is, in the order a new member meets them.
const SHAPE = [
  ['meet', '/room', 'The meeting is the point. Type the code from the projector, get checked in, work in pairs, show what you made.'],
  ['arena', '/arena', 'Ladders of problems for contests, building, AI, data and cyber, plus a daily problem and live duels.'],
  ['build', '/projects', 'Ship small projects with a teammate. Each one lands on a public portfolio page you can put on an application.'],
  ['compass', '/compass', 'Six questions on your first sign-in pick a path, so you always know the next thing to do.'],
  ['standings', '/standings', 'Showing up, shipping and competing all count. Tiers give everyone a next step, and the season ends with a prize.'],
];

function Landing() {
  const { settings, students, season, totalPoints } = useData();
  useReveal();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>
              <span className="p">&gt;</span>
              The club, <em>in your browser</em>.<span className="cursor" aria-hidden="true" />
            </h1>
            <p className="lead">
              {settings.club_name || 'Plano East CS Club'} runs on this site. <b>Meet, practise, build and compete</b>, on school
              wifi, with nothing to install.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <Link className="btn pri" to="/signin">Create your account</Link>
              <Link className="btn" to="/arena">See the board first</Link>
            </div>
            <div className="kv">
              <div><span>members</span><strong>{students.length}</strong></div>
              <div><span>season day</span><strong>{season.day}</strong></div>
              <div><span>points awarded</span><strong>{totalPoints}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>How the club works <small>ls ~/club</small></h2>
          <p className="sub">An account keeps your progress and builds your portfolio. Sign in with Google, or get a one-time link by email.</p>
          <ol className="lshape rv">
            {SHAPE.map(([name, to, desc]) => (
              <li key={name}>
                <Link to={to}>
                  <b>{name}</b>
                  <span>{desc}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Open to everyone <small>ls resources/</small></h2>
          <p className="sub">No account needed for any of these.</p>
          <div className="chips">
            {[['opportunities', '/opportunities'], ['calendar', '/calendar'], ['competitions', '/competitions'], ['puzzles', '/puzzles'], ['cyber', '/cyber'], ['about', '/about']].map(([n, to]) => (
              <Link key={n} className="chip lchip" to={to}>{n}</Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* --------------------------- signed in: Today (F1) --------------------------- */

/** "5m", "3h", "yesterday", "4d", then a date. */
function ago(at) {
  const t = parseTs(at);
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h`;
  const d = Math.round(m / 1440);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d`;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Type the code from the projector, land in the room. */
function JoinForm({ code: start = '', big }) {
  const nav = useNavigate();
  const [code, setCode] = useState(start);
  return (
    <form
      className={`td-join${big ? ' big' : ''}`}
      onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/room/${code.trim().toUpperCase()}`); }}
    >
      <input className="field mono" value={code} maxLength={8} placeholder="CODE" autoComplete="off" spellCheck={false}
        onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Room code" />
      <button className={`btn${big ? ' pri' : ''}`} disabled={!code.trim()}>{big ? 'Join the room' : 'Join'}</button>
    </form>
  );
}

function Meeting({ m }) {
  if (m.kind === 'live')
    return (
      <div className={`td-meet live${m.here ? ' here' : ''}`}>
        <p className="td-k"><span className="live2"><i />live</span> since {ago(m.since)}</p>
        {m.here ? (
          <>
            <p className="td-mt">You are checked in to <b>{m.title}</b>.</p>
            <Link className="btn" to={`/room/${m.code}`}>Back to the room</Link>
          </>
        ) : (
          <>
            <p className="td-mt">Room <b className="g">{m.code}</b> is open: <b>{m.title}</b></p>
            <JoinForm code={m.code} big />
          </>
        )}
      </div>
    );
  return (
    <div className="td-meet">
      <p className="td-k">next meeting</p>
      <p className="td-mt">{m.kind === 'planned' ? m.info : 'No meeting scheduled. When an officer opens a room, it shows up here.'}</p>
      {m.extra && <p className="d">{m.extra}</p>}
      <JoinForm />
    </div>
  );
}

function NextAction({ n, primary, onClaimed }) {
  const [msg, setMsg] = useState(null);
  const claim = async () => {
    try {
      await api.post('/claims', { kind: 'compete', ref: `opp:${n.oppId}`, title: n.oppTitle });
      setMsg({ text: 'Sent. An officer will confirm it.' });
      onClaimed();
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
  };
  return (
    <div className="td-next">
      <p className="td-k">your next move</p>
      <h2 className="td-nt">{n.title}</h2>
      <p className="td-why">{n.why}</p>
      {n.kind === 'claim' ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`btn${primary ? ' pri' : ''} td-go`} onClick={claim}>{n.cta}</button>
          <Link className="linkb" to="/opportunities">I did not enter</Link>
        </div>
      ) : (
        <Link className={`btn${primary ? ' pri' : ''} td-go`} to={n.to}>{n.cta}</Link>
      )}
      {msg && <p className={msg.bad ? 'dn' : 'up'} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </div>
  );
}

function Season({ s, studentId }) {
  const ti = tierIndex(s.points);
  const nx = nextTier(s.points);
  return (
    <Pane file="season" meta={s.id} cls="td-season">
      <div className="pn-b">
        <p className="td-pts"><b>{s.points}</b> points this season</p>
        <p className="td-tier" style={{ '--c': TIERS[ti].color }}>
          <Crest i={ti} cls="cs" />
          {TIERS[ti].name}
          <span className="d">{nx ? `${nx.min - s.points} to ${nx.name}` : 'top tier'}</span>
        </p>
        <div className="xp" role="progressbar" aria-label="Progress to the next tier" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tierProgress(s.points) * 100)}>
          <i className="fillbar" style={{ '--p': tierProgress(s.points), '--c': TIERS[ti].color }} />
        </div>
      </div>
      {s.near.length > 0 && (
        <ol className="td-near" aria-label={`You are ranked ${s.rank} of ${s.of}`}>
          {s.near.map((r, i) => (
            <li key={i} className={r.me ? 'me' : undefined}>
              <span className="n">#{r.rank}</span>
              <span className="nm">{r.me ? 'you' : r.name}</span>
              <span className="p">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="pn-b td-week">
        <p>
          <b className="g">{s.week}</b> {s.week === 1 ? 'thing' : 'things'} counted this week
          {s.week === 0 && <span className="d">. A meeting is the fastest one.</span>}
        </p>
        <p className="d" style={{ fontSize: 12.5 }}>
          <Link className="uline" to="/standings">full standings</Link>
          {studentId && <> · <Link className="uline" to={`/student/${studentId}`}>your record</Link></>}
        </p>
        <details style={{ marginTop: 10 }}>
          <summary className="d" style={{ cursor: 'pointer', fontSize: 12.5 }}>claim an older entry</summary>
          <div style={{ marginTop: 8 }}><LinkPanel /></div>
        </details>
      </div>
    </Pane>
  );
}

/* ------------------------------ club feed (F2) ------------------------------ */

const VERB = {
  attend: (t) => `attended ${t || 'a meeting'}`,
  compete: (t) => `competed in ${t || 'a contest'}`,
  place: (t) => `placed at ${t || 'a contest'}`,
  ship: (t) => `shipped ${t || 'a project'}`,
  mentor: (t) => `helped a clubmate${t ? ` with ${t}` : ''}`,
  solve: (t) => `solved ${t || 'a problem'}`,
  idea: () => 'posted an idea for the club',
  daily: () => "solved the daily problem",
  duel: (t) => `finished a duel${t ? `: ${t}` : ''}`,
  manual: (t) => (t ? `was recognised for ${t}` : 'was recognised by an officer'),
  quest: (t) => `finished a quest${t ? `: ${t}` : ''}`,
  dropin: () => 'dropped in to Panther Pause',
};

function Feed() {
  const [feed, setFeed] = useState(null);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState('');
  useReveal(); // the pane mounts after the page's own reveal pass
  useEffect(() => {
    api.get('/feed').then((r) => setFeed(r.feed)).catch(() => setFeed(null));
  }, []);
  if (!feed) return null; // feed is optional; hide the block if it fails

  const kudos = async (f) => {
    setErr('');
    try {
      const r = f.mine ? await api.del(`/feed/${f.id}/kudos`) : await api.post(`/feed/${f.id}/kudos`);
      setFeed((xs) => xs.map((x) => (x.id === f.id ? { ...x, kudos: r.kudos, mine: r.mine } : x)));
    } catch (e) {
      setErr(e.message);
    }
  };
  const rows = all ? feed : feed.slice(0, 8);
  return (
    <Pane file="club.feed" meta="what clubmates did" cls="td-feed" spot={false}>
      {feed.length === 0 ? (
        <div className="pn-b"><p className="d">Nothing yet this season. When an officer approves a meeting, a project or a contest, it shows up here.</p></div>
      ) : (
        <ul className="tf">
          {rows.map((f) => {
            const what = (VERB[f.kind] ?? (() => 'did something'))(f.title);
            return (
              <li key={f.id}>
                <span className="who"><b>{f.own ? 'You' : f.name}</b> {what}</span>
                <span className="ago">{ago(f.at)}</span>
                {f.own ? (
                  <span className="kd own" title="Kudos from clubmates">{f.kudos > 0 ? `${f.kudos} kudos` : ''}</span>
                ) : (
                  <span className="kd-wrap">
                    <button type="button" className="kd" aria-pressed={f.mine} onClick={() => kudos(f)}
                      aria-label={`${f.mine ? 'Take back kudos from' : 'Give kudos to'} ${f.name} for ${what}`}>
                      <span aria-hidden="true">{f.mine ? '[+]' : '[ ]'}</span> kudos{f.kudos ? ` ${f.kudos}` : ''}
                    </button>
                    <ReportButton kind="feed" id={f.id} what={`${f.name}'s update`} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {err && <p className="dn" role="status" style={{ padding: '0 18px 12px' }}>{err}</p>}
      {feed.length > 8 && !all && (
        <button type="button" className="linkb td-more" onClick={() => setAll(true)}>show {feed.length - 8} more</button>
      )}
    </Pane>
  );
}

/* ------------------------------ small blocks (5) ------------------------------ */

function Deadlines({ list }) {
  return (
    <Pane file="deadlines" meta="you marked these">
      <div className="pn-b">
        {list.length === 0 ? (
          <p className="d">Press "I'm doing this" on an opportunity and its deadline shows up here.</p>
        ) : (
          <ul className="td-list">
            {list.map((o) => {
              const n = daysUntil(o.deadline);
              return (
                <li key={o.id}>
                  <Link className="uline" to={`/opportunities?q=${encodeURIComponent(o.title)}`}>{o.title}</Link>
                  <span className={n != null && n <= 7 ? 'g' : 'd'}>{n == null ? 'rolling' : n === 0 ? 'today' : `${n}d · ${formatDate(o.deadline).replace(/, \d{4}$/, '')}`}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Link className="g uline td-foot" to="/opportunities">browse opportunities</Link>
      </div>
    </Pane>
  );
}

function Projects({ list, userId }) {
  return (
    <Pane file="projects" meta={list.length ? `${list.length} recent` : 'your portfolio'}>
      <div className="pn-b">
        {list.length === 0 ? (
          <p className="d">No projects yet. Post one and it lands on your public portfolio.</p>
        ) : (
          <ul className="td-list">{list.map((p) => <li key={p.id}><span>{p.title}</span><span className="d">{p.track}</span></li>)}</ul>
        )}
        <p className="td-foot">
          <Link className="g uline" to="/projects">{list.length ? 'manage projects' : 'post a project'}</Link>{'  '}
          <Link className="g uline" to={`/u/${userId}`}>your portfolio</Link>
        </p>
      </div>
    </Pane>
  );
}

function Quests({ q }) {
  return (
    <Pane file="quests" meta={`${q.done}/${q.total} done`}>
      <div className="pn-b" style={{ paddingBottom: 12 }}>
        <p className="d" style={{ fontSize: 12.5 }}>
          {q.next ? <><b className="g">{q.rankName}</b>, {q.next.min - q.peak} pts to {q.next.name}</> : <>You are <b className="g">{q.rankName}</b>.</>}
        </p>
        <RankBar points={q.peak} rank={q.rank} next={q.next} />
      </div>
      {q.open.length > 0 && <div className="ql" style={{ borderTop: '1px solid var(--line)' }}>{q.open.map((x) => <QuestRow key={x.id} q={x} />)}</div>}
      <div className="pn-b" style={{ paddingTop: 10 }}><Link className="g uline" to="/quests">all quests</Link></div>
    </Pane>
  );
}

/** Ask an officer to connect this account to an older leaderboard entry. */
function LinkPanel() {
  const [info, setInfo] = useState(null);
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const load = () => api.get('/me/link').then(setInfo).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/me/link', { student_id: Number(pick) });
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const cancel = () => api.del('/me/link').then(load).catch((e) => setError(e.message));

  if (!info) return <p className="d">{error || 'loading...'}</p>;
  if (info.pending)
    return (
      <>
        <p>Waiting for an officer to confirm you are <b className="g">{info.pending.name}</b>.</p>
        <button type="button" className="linkb" onClick={cancel}>cancel request</button>
      </>
    );
  // Every account has its own entry now (A1); this only claims an older one from before accounts.
  if (!info.students.length) return <p className="d">No older entries are waiting to be claimed.</p>;
  return (
    <>
      <p className="d">On the board before you made an account? Pick your old entry and an officer will merge it into this one.</p>
      <form onSubmit={send} style={{ display: 'grid', gap: 8 }}>
        <select className="field" required value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Your older leaderboard entry">
          <option value="">Pick your name</option>
          {info.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn" disabled={!pick}>Ask an officer to merge it</button>
      </form>
      {error && <p className="dn" style={{ marginTop: 8 }}>{error}</p>}
    </>
  );
}

/* ------------------------------ claims (A3) ------------------------------ */

const CLAIM_KINDS = [['compete', 'I competed'], ['place', 'I placed'], ['ship', 'I shipped a project']];
const CLAIM_WORD = { compete: 'competed', place: 'placed', ship: 'shipped' };

function ClaimsPanel({ open }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ kind: 'compete', title: '', proof_url: '', place: '' });
  const [msg, setMsg] = useState(null);
  const load = () => api.get('/me/claims').then(setD).catch((e) => setMsg({ bad: true, text: e.message }));
  useEffect(() => { load(); }, []);

  const send = async (body) => {
    setMsg(null);
    try {
      const r = await api.post('/claims', body);
      setMsg({ text: r.status === 'approved' ? `Approved, ${r.awarded} points.` : 'Sent. An officer will check it.' });
      setForm({ kind: 'compete', title: '', proof_url: '', place: '' });
      load();
    } catch (err) {
      setMsg({ bad: true, text: err.message });
    }
  };
  const submit = (e) => {
    e.preventDefault();
    send({ ...form, place: form.kind === 'place' ? form.place : '' });
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pending = d?.claims.filter((c) => c.status === 'pending').length ?? 0;
  return (
    <Pane file="claims" meta={pending ? `${pending} waiting` : 'competed, placed, shipped'}>
      <div className="pn-b" id="claim">
        {/* Only ask once the deadline has passed; before that you have not competed yet. */}
        {d?.interests.filter((o) => !o.deadline || daysUntil(o.deadline) < 0).map((o) => (
          <p key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>Did you compete in <b style={{ color: 'var(--text)' }}>{o.title}</b>?</span>
            <button className="btn" onClick={() => send({ kind: 'compete', ref: `opp:${o.id}`, title: o.title })}>I competed</button>
          </p>
        ))}
        {d?.claims.slice(0, 3).map((c) => (
          <p key={c.id} className="d" style={{ fontSize: 12.5, marginBottom: 4 }}>
            {CLAIM_WORD[c.kind]} {c.title}: {c.status === 'approved' ? `+${c.points}` : c.status}
            {c.reject_reason ? ` (${c.reject_reason})` : ''}
          </p>
        ))}
        <details open={open} style={{ marginTop: 8 }}>
          <summary className="g" style={{ cursor: 'pointer', fontSize: 13 }}>claim something you did</summary>
          <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <select className="field" value={form.kind} onChange={set('kind')} aria-label="What you are claiming">
              {CLAIM_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className="field" required minLength={3} maxLength={120} value={form.title} onChange={set('title')} placeholder="What was it, e.g. USACO December" aria-label="What it was" />
            {form.kind === 'place' && (
              <input className="field" type="number" min="1" max="1000" required value={form.place} onChange={set('place')} placeholder="Your place, e.g. 2" aria-label="Your place" />
            )}
            <input className="field" type="url" pattern="https://.*" maxLength={500} value={form.proof_url} onChange={set('proof_url')} placeholder="Proof link, https:// (optional)" aria-label="Proof link" />
            <button className="btn">Send claim</button>
          </form>
        </details>
        {msg && <p className={msg.bad ? 'dn' : 'up'} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
      </div>
    </Pane>
  );
}

/* ---------------------------------- page ---------------------------------- */

function Today({ user, signOut }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();
  const { search } = useLocation();
  const claimOpen = /claim=1/.test(search);
  const load = () => api.get('/me/dashboard').then(setD).catch((e) => setError(e.message));
  useReveal();
  useEffect(() => { load(); }, []);

  // First sign-in: send them to the compass once per browser. Skipping is one click there.
  useEffect(() => {
    if (!d?.compassDue) return;
    try {
      if (localStorage.getItem('compass-offered')) return;
      localStorage.setItem('compass-offered', '1');
    } catch { return; }
    nav('/compass');
  }, [d, nav]);

  useEffect(() => {
    if (d && claimOpen) document.getElementById('claim')?.scrollIntoView({ block: 'center' });
  }, [d, claimOpen]);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading today...</div>;

  const first = (user.name || '').split(' ')[0] || 'there';
  const livePrimary = d.meeting.kind === 'live' && !d.meeting.here;
  const blocks = {
    deadlines: <Deadlines key="deadlines" list={d.deadlines} />,
    projects: <Projects key="projects" list={d.projects} userId={user.id} />,
    quests: <Quests key="quests" q={d.quests} />,
    claims: <ClaimsPanel key="claims" open={claimOpen} />,
  };
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <section className="today">
      <div className="wrap">
        <header className="td-hd">
          <p className="eb"><span className="g">$</span>today{d.path ? ` --path ${d.path}` : ''}</p>
          <h1>Hey, {first}<span className="d">. {date}.</span></h1>
        </header>

        <div className="td-grid">
          <div className="td-now pn">
            <Meeting m={d.meeting} />
            <NextAction n={d.next} primary={!livePrimary} onClaimed={load} />
          </div>
          <Season s={d.season} studentId={user.student_id} />
          <Feed />
          <div className="td-side">{d.order.map((k) => blocks[k])}</div>
        </div>

        <p className="d td-acct">
          signed in as {user.email}{' '}
          <Link className="g uline" to="/compass">{d.path ? `${PATHS[d.path].name.toLowerCase()} path, retake the compass` : 'take the compass'}</Link>{' '}
          <Link className="g uline" to="/signin">account</Link>{' '}
          <button type="button" className="linkb" onClick={signOut}>sign out</button>
        </p>
      </div>
    </section>
  );
}
