import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useData } from '../lib/data.jsx';
import { useUser } from '../lib/useUser.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { QuestRow, RankBar } from './Quests.jsx';

const grid = { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' };
const bar = (n, of) => `[${'#'.repeat(Math.round((n / (of || 1)) * 16))}${'-'.repeat(16 - Math.round((n / (of || 1)) * 16))}]`;

export default function Home() {
  const { user, loading, signOut } = useUser();
  if (loading) return <div className="state-note">loading...</div>;
  return user ? <Dashboard user={user} signOut={signOut} /> : <Landing />;
}

/* ---------------------------- signed out: landing ---------------------------- */

const OPEN = [
  ['standings', '/standings', 'points, tiers, the season prize'],
  ['opportunities', '/opportunities', 'contests and hackathons near us'],
  ['calendar', '/calendar', 'every deadline in one place'],
  ['puzzles', '/puzzles', 'the problem of the week'],
  ['cyber', '/cyber', 'the cyber team'],
  ['curriculum', '/curriculum', 'what we teach, by track'],
];

function Landing() {
  const { settings, students, totalPoints, season } = useData();
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
              {settings.club_name || 'Plano East CS Club'} now runs on this site. <b>Learn, run code, join the live
              meeting and ship projects</b> without installing anything or logging in to anything the school blocks.
              Everything is open to read. An account keeps your progress and builds your portfolio.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <Link className="btn" to="/signin">Create your account</Link>
              <Link className="btn btn-ghost" to="/learn">Try a lesson first</Link>
            </div>
            <div className="kv">
              <div><span>members</span><strong>{students.length}</strong></div>
              <div><span>points awarded</span><strong>{totalPoints}</strong></div>
              <div><span>season day</span><strong>{season.day}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>What an account gets you <small>cat features.md</small></h2>
          <p className="sub">No password to remember. Sign in with Google, or get a one-time link by email.</p>
          <div style={grid}>
            <Pane file="learn" meta="lessons that run here">
              <div className="pn-b">
                <p>Short lessons with quick checks and real code that runs on the page. Your progress and streak are saved.</p>
                <Link className="g uline" to="/learn">open lessons</Link>
              </div>
            </Pane>
            <Pane file="room" meta="live meetings">
              <div className="pn-b">
                <p>Join the meeting with a code. Answer live questions, tell the room when you are lost, and get checked in for free.</p>
                <Link className="g uline" to="/room">join a room</Link>
              </div>
            </Pane>
            <Pane file="projects" meta="your portfolio">
              <div className="pn-b">
                <p>Post what you build. You get a public page to put on a college application.</p>
                <Link className="g uline" to="/projects">see projects</Link>
              </div>
            </Pane>
            <Pane file="quests" meta="xp and ranks">
              <div className="pn-b">
                <p>Lessons, meetings and projects tick off quests and raise your rank, from recruit up to root. It shows on your portfolio.</p>
                <Link className="g uline" to="/quests">see the quests</Link>
              </div>
            </Pane>
            <Pane file="ideas" meta="you pick what we run">
              <div className="pn-b">
                <p>Want a meeting on LLMs, data, game dev? Post it and vote. Officers plan from the top of the list.</p>
                <Link className="g uline" to="/ideas">open the board</Link>
              </div>
            </Pane>
            <Pane file="gateway" meta="GitHub at school">
              <div className="pn-b">
                <p>An officer gives out a code at the meeting and GitHub works on school machines for the session.</p>
                <Link className="g uline" to="/gateway">how it works</Link>
              </div>
            </Pane>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Open to everyone <small>ls resources/</small></h2>
          <p className="sub">You do not need an account to use any of this.</p>
          <div style={grid}>
            {OPEN.map(([n, to, d]) => (
              <Link key={n} to={to} className="pn sp" style={{ padding: '14px 18px', display: 'block' }}>
                <span className="g">{n}</span>
                <span className="d" style={{ display: 'block', marginTop: 4 }}>{d}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* --------------------------- signed in: dashboard --------------------------- */

/** Type the code from the projector, land in the room. */
function JoinBox() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  return (
    <form
      className="pn sp"
      style={{ padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center' }}
      onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/room/${code.trim().toUpperCase()}`); }}
    >
      <span className="g" style={{ whiteSpace: 'nowrap' }}>join a room</span>
      <input className="field mono" value={code} maxLength={8} placeholder="ABCD" autoComplete="off" spellCheck={false}
        onChange={(e) => setCode(e.target.value)} aria-label="Room code" style={{ letterSpacing: '.2em', textTransform: 'uppercase' }} />
      <button className="btn" disabled={!code.trim()}>go</button>
    </form>
  );
}

/** Ask an officer to connect this account to a leaderboard entry. */
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

  if (!info) return <p className="d">loading...</p>;
  if (info.pending)
    return (
      <>
        <p>Waiting for an officer to confirm you are <b className="g">{info.pending.name}</b>.</p>
        <p className="d">It shows up here once approved, usually at the next meeting.</p>
        <button type="button" className="g uline" onClick={cancel} style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}>
          cancel request
        </button>
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

function ClaimsPanel() {
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
      <div className="pn-b">
        {d?.interests.map((o) => (
          <p key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>Did you compete in <b style={{ color: 'var(--text)' }}>{o.title}</b>?</span>
            <button className="btn" onClick={() => send({ kind: 'compete', ref: `opp:${o.id}`, title: o.title })}>I competed</button>
          </p>
        ))}
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
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
        {msg && <p className={msg.bad ? 'dn' : 'up'} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
        {d?.claims.slice(0, 4).map((c) => (
          <p key={c.id} className="d" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>
            {CLAIM_WORD[c.kind]} {c.title}: {c.status === 'approved' ? `+${c.points}` : c.status}
            {c.reject_reason ? ` (${c.reject_reason})` : ''}
          </p>
        ))}
      </div>
    </Pane>
  );
}

function Dashboard({ user, signOut }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useReveal();
  useEffect(() => {
    api.get('/me/dashboard').then(setD).catch((e) => setError(e.message));
  }, []);

  const first = (user.name || '').split(' ')[0] || 'there';
  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading your hub...</div>;

  return (
    <>
      <PageHead
        eyebrow="whoami"
        title={<>Hey, <em>{first}</em></>}
        lead="Pick up where you left off, check where you stand, and keep your projects in one place."
        kv={
          <div className="kv">
            <div><span>rank</span><strong>{d.rank}</strong></div>
            <div><span>day streak</span><strong>{d.streak}</strong></div>
            <div><span>meetings</span><strong>{d.meetings}</strong></div>
          </div>
        }
      />
      <section className="sec">
        <div className="wrap">
          <div style={grid}>
            <Pane file="continue" meta={d.next?.started ? 'in progress' : 'start here'}>
              <div className="pn-b">
                {d.next ? (
                  <>
                    <p><b style={{ color: 'var(--text)' }}>{d.next.courseTitle}</b></p>
                    {d.next.step && <p className="d">Next: {d.next.step}</p>}
                    <Link className="btn" to={`/learn/${d.next.course}`}>{d.next.started ? 'Continue' : 'Start'}</Link>
                  </>
                ) : (
                  <p>You have finished every lesson. Nice. New ones are on the way.</p>
                )}
              </div>
            </Pane>

            <Pane file="quests" meta={`${d.questsDone}/${d.questsTotal} done · ${d.xp} xp`}>
              <div className="pn-b" style={{ paddingBottom: 12 }}>
                <p className="d" style={{ fontSize: 13, marginBottom: 0 }}>
                  {d.nextRank ? <><b className="g">{d.rank}</b> to {d.nextRank.id}: {d.nextRank.min - d.xp} xp to go</> : <>You are <b className="g">root</b>.</>}
                </p>
                <RankBar xp={d.xp} rank={d.rank} next={d.nextRank} />
              </div>
              <div className="ql" style={{ borderTop: '1px solid var(--line)' }}>
                {d.quests.map((q) => <QuestRow key={q.id} q={q} />)}
                <Link to="/quests" style={{ display: 'block' }}><span className="g uline">all quests</span></Link>
              </div>
            </Pane>

            <Pane file="standing" meta="leaderboard">
              <div className="pn-b">
                {d.standing ? (
                  <>
                    <p>
                      <b className="g" style={{ fontSize: 28 }}>#{d.standing.rank}</b>{' '}
                      <span className="d">of {d.standing.of}, {d.standing.points} points</span>
                    </p>
                    <Link className="g uline" to={`/student/${user.student_id}`}>your leaderboard page</Link>
                    <details style={{ marginTop: 12 }}>
                      <summary className="d" style={{ cursor: 'pointer', fontSize: 13 }}>claim an older entry</summary>
                      <div style={{ marginTop: 8 }}><LinkPanel /></div>
                    </details>
                  </>
                ) : (
                  <LinkPanel />
                )}
              </div>
            </Pane>

            <ClaimsPanel />

            <Pane file="progress" meta={`${d.courses.length} started`}>
              <div className="pn-b">
                {d.courses.length === 0 ? (
                  <p className="d">Nothing started. Your first lesson takes about five minutes.</p>
                ) : (
                  d.courses.map((c) => (
                    <p key={c.slug} style={{ marginBottom: 8 }}>
                      <Link className="uline" to={`/learn/${c.slug}`}>{c.title}</Link>
                      <span className="d" style={{ display: 'block', fontSize: 12 }}>
                        {bar(c.passed, c.steps)} {c.passed}/{c.steps}
                      </span>
                    </p>
                  ))
                )}
              </div>
            </Pane>

            <Pane file="projects" meta={`${d.projects.length} shown`}>
              <div className="pn-b">
                {d.projects.length === 0 ? (
                  <p className="d">No projects yet. Post one and it appears on your public portfolio.</p>
                ) : (
                  d.projects.map((p) => (
                    <p key={p.id} style={{ marginBottom: 6 }}>{p.title}</p>
                  ))
                )}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <Link className="g uline" to="/projects">manage projects</Link>
                  <Link className="g uline" to={`/u/${user.id}`}>your portfolio page</Link>
                </div>
              </div>
            </Pane>
          </div>

          <div style={{ ...grid, marginTop: 16 }}>
            <JoinBox />
            <Link to="/opportunities" className="pn sp" style={{ padding: '14px 18px', display: 'block' }}>
              <span className="g">opportunities</span>
              <span className="d" style={{ display: 'block', marginTop: 4 }}>contests and hackathons with deadlines</span>
            </Link>
            <Link to="/ideas" className="pn sp" style={{ padding: '14px 18px', display: 'block' }}>
              <span className="g">ideas board</span>
              <span className="d" style={{ display: 'block', marginTop: 4 }}>vote on what the next meeting covers</span>
            </Link>
            <Link to="/gateway" className="pn sp" style={{ padding: '14px 18px', display: 'block' }}>
              <span className="g">GitHub at school</span>
              <span className="d" style={{ display: 'block', marginTop: 4 }}>use a code from an officer</span>
            </Link>
          </div>

          <p className="d" style={{ marginTop: 22, fontSize: 12 }}>
            signed in as {user.email}{' '}
            <Link className="g uline" to="/signin">account</Link>{' '}
            <button type="button" className="g uline" onClick={signOut} style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}>
              sign out
            </button>
          </p>
        </div>
      </section>
    </>
  );
}
