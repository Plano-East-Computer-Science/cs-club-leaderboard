import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import TeamPosts from '../components/TeamPosts.jsx';
import Projects from './Projects.jsx';
import { useReveal } from '../lib/ui.js';
import { STARTERS } from '../lib/starters.js';

const STATE_NOTE = {
  open: 'Entries and devlogs are open.',
  demo: 'Demo day. Teams show their work, then everyone votes.',
  closed: 'Closed.',
};

const dayOf = (v) => {
  const d = new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const daysLeft = (iso) => (iso ? Math.ceil((Date.parse(`${iso}T23:59:59`) - Date.now()) / 86400000) : null);

export default function Build() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useReveal();

  const load = useCallback(() => api.get('/cycles').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading...</div>;

  const cur = d.current;
  const left = cur ? daysLeft(cur.cycle.demo_on) : null;
  const mine = cur?.entries.find((e) => e.id === cur.myEntryId) ?? null;

  return (
    <>
      <PageHead
        eyebrow="build --ship"
        title={<>Ship something <em>this cycle</em>.</>}
        lead="A cycle is a few weeks with one theme. Pitch in a line, post short devlogs, show it at the demo, and the club votes. Shipped projects earn points."
        kv={
          <div className="kv">
            <div><span>entries</span><strong>{cur ? cur.entries.length : 0}</strong></div>
            <div><span>days to demo</span><strong>{left == null ? '-' : Math.max(left, 0)}</strong></div>
            <div><span>cycles run</span><strong>{d.past.length}</strong></div>
          </div>
        }
      />

      <section className="sec">
        <div className="wrap cy-grid">
          {cur ? <Hero cur={cur} left={left} d={d} reload={load} /> : <NoCycle />}
          {cur && mine && <MyEntry cur={cur} entry={mine} d={d} reload={load} />}
        </div>
      </section>

      {cur && cur.entries.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <Pane file="gallery" meta={`${cur.entries.length} entries`} spot={false}>
              <div className="cy-gal">
                {cur.entries.map((e) => <EntryCard key={e.id} e={e} cur={cur} d={d} reload={load} />)}
              </div>
            </Pane>
          </div>
        </section>
      )}

      {cur && (
        <section className="sec">
          <div className="wrap">
            <Pane file="teammates" meta="looking for a team">
              <div className="pn-b"><TeamPosts type="cycle" id={cur.cycle.id} /></div>
            </Pane>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap">
          <p><Link className="u" to="/build/reviews">Code reviews</Link> <span className="m">ask for feedback on a repo or a workspace file, or review someone else's</span></p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Start from a template <small>pick one, follow the steps, then enter the cycle</small></h2>
          <div className="cy-tpl">
            {STARTERS.map((s) => (
              <Link key={s.slug} to={`/build/start/${s.slug}`} className="pn sp rv cy-t">
                <b>{s.name}</b>
                <span>{s.blurb}</span>
                <em>{s.time}</em>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {d.past.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <Pane file="past-cycles" meta="winners" spot={false}>
              {d.past.map((p) => (
                <div className="cy-past" key={p.cycle.id}>
                  <h3>{p.cycle.title}</h3>
                  <p className="d">{p.entries} entries, {p.shipped} shipped.</p>
                  {p.winners.length === 0 ? (
                    <p className="m">No votes were cast.</p>
                  ) : (
                    p.winners.map((w) => (
                      <p key={w.id}>
                        <span className="g">winner</span> {w.title} <span className="m">by {w.team.map((t) => t.name).join(', ')} · {w.votes} {w.votes === 1 ? 'vote' : 'votes'}</span>
                      </p>
                    ))
                  )}
                </div>
              ))}
            </Pane>
          </div>
        </section>
      )}

      <section className="sec" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <h2>All member projects <small>everything members have shared</small></h2>
          <Projects embedded />
        </div>
      </section>
    </>
  );
}

function NoCycle() {
  return (
    <Pane file="current-cycle" meta="none running">
      <div className="pn-b">
        <p>No cycle is running right now. Officers open the next one from the ideas board, so post what you would like to build.</p>
        <p><Link className="u" to="/ideas">Go to the ideas board</Link>. In the meantime, start from a template below.</p>
      </div>
    </Pane>
  );
}

function Hero({ cur, left, d, reload }) {
  const c = cur.cycle;
  const [pitch, setPitch] = useState('');
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('new');
  const [projects, setProjects] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canJoin = d.signedIn && c.status === 'open' && cur.myEntryId == null;

  useEffect(() => {
    if (!canJoin) return;
    api.get('/projects').then((r) => setProjects(r.projects.filter((p) => p.user_id === d.me))).catch(() => {});
  }, [canJoin, d.me]);

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/cycles/${c.id}/entries`, project === 'new' ? { pitch, title } : { pitch, project_id: Number(project) });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const when = left == null ? 'no demo date yet' : left < 0 ? 'demo date passed' : left === 0 ? 'demo is today' : `${left} ${left === 1 ? 'day' : 'days'} to demo`;
  return (
    <Pane file={`cycle/${c.slug}`} meta={`${c.status}${c.demo_on ? ` · demo ${dayOf(`${c.demo_on}T12:00:00`)}` : ''}`}>
      <div className="pn-b">
        <h2 className="cy-h">{c.title}</h2>
        <p className="cy-theme">{c.theme}</p>
        <p className="g">{when}</p>
        <p className="d">{STATE_NOTE[c.status]}</p>
        {c.rubric && <p className="d"><span className="m">How it is judged: </span>{c.rubric}</p>}
        {!d.signedIn && <p><Link className="btn" to="/signin">Sign in to enter</Link></p>}
        {canJoin && (
          <form onSubmit={join} className="cy-f">
            <label htmlFor="cy-pitch" className="m">Your pitch, one line</label>
            <input id="cy-pitch" className="field" maxLength={140} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="A Discord bot that nags me about homework" required />
            <label htmlFor="cy-proj" className="m">Project</label>
            <select id="cy-proj" className="field" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="new">A new project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {project === 'new' && (
              <input className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project name" aria-label="Project name" required />
            )}
            {error && <p className="dn" role="alert">{error}</p>}
            <div><button className="btn pri" disabled={busy}>{busy ? 'Entering...' : "I'm in"}</button></div>
          </form>
        )}
        {d.signedIn && cur.myEntryId != null && <p className="up">You are in. Your entry is below.</p>}
      </div>
    </Pane>
  );
}

function MyEntry({ cur, entry, d, reload }) {
  const c = cur.cycle;
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setError('');
    try { await fn(); await reload(); } catch (err) { setError(err.message); }
  };

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    await run(async () => {
      await api.post(`/cycles/${c.id}/entries/${entry.id}/devlogs`, { text, url });
      setText('');
      setUrl('');
    });
    setBusy(false);
  };
  const open = c.status === 'open';
  return (
    <Pane file="my-entry" meta={`${entry.team.length} of ${d.maxTeam} on the team`}>
      <div className="pn-b">
        <h3 className="cy-h2">{entry.title}</h3>
        <p className="d">{entry.pitch}</p>
        <div className="cy-team" aria-label="Team">
          {entry.team.map((m) => (
            <span key={m.id} className="cy-chip">
              {m.name}
              {open && !entry.owner && m.id === d.me && <button type="button" aria-label="Leave this team" onClick={() => run(() => api.del(`/cycles/${c.id}/entries/${entry.id}/team/${m.id}`))}>leave</button>}
              {open && entry.owner && m.id !== d.me && <button type="button" aria-label={`Remove ${m.name}`} onClick={() => run(() => api.del(`/cycles/${c.id}/entries/${entry.id}/team/${m.id}`))}>remove</button>}
            </span>
          ))}
        </div>
        {open && entry.team.length < d.maxTeam && <AddMember cycleId={c.id} entryId={entry.id} onAdded={reload} />}
        {open && entry.owner && (
          <p>
            <button type="button" className="tp-x" onClick={() => window.confirm('Withdraw your entry? Devlogs go with it.') && run(() => api.del(`/cycles/${c.id}/entries/${entry.id}`))}>withdraw entry</button>
          </p>
        )}

        <h4 className="k">devlog</h4>
        <form onSubmit={post} className="cy-f">
          <textarea className="field" rows={2} maxLength={280} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you get working today?" aria-label="New devlog" required />
          <input className="field" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// link or screenshot (optional)" aria-label="Link or image, optional" />
          {error && <p className="dn" role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn" disabled={busy || text.trim().length < 3}>{busy ? 'Posting...' : 'Post'}</button>
            <span className="m" style={{ fontSize: 12 }}>{text.length}/280</span>
          </div>
        </form>
        <Devlogs logs={entry.devlogs} />
      </div>
    </Pane>
  );
}

function AddMember({ cycleId, entryId, onAdded }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [error, setError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => api.get(`/members/search?q=${encodeURIComponent(q.trim())}`).then((r) => n === seq.current && setFound(r.members)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const add = async (m) => {
    setError('');
    try {
      await api.post(`/cycles/${cycleId}/entries/${entryId}/team`, { user_id: m.id });
      setQ('');
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="cy-add">
      <label htmlFor="cy-find" className="m">Add a teammate</label>
      <input id="cy-find" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members by name" autoComplete="off" />
      {found.length > 0 && (
        <ul className="cy-found">
          {found.map((m) => <li key={m.id}><button type="button" onClick={() => add(m)}>Add {m.name}</button></li>)}
        </ul>
      )}
      {error && <p className="dn" role="alert">{error}</p>}
    </div>
  );
}

function Devlogs({ logs }) {
  if (!logs.length) return <p className="d">No devlogs yet. Post the first one.</p>;
  return (
    <ul className="cy-logs">
      {logs.map((l) => (
        <li key={l.id}>
          <span className="m">{l.author} · {dayOf(l.at)}</span>
          <p>{l.text}</p>
          {l.url && <a className="u" href={l.url} target="_blank" rel="noreferrer noopener">link</a>}
        </li>
      ))}
    </ul>
  );
}

function EntryCard({ e, cur, d, reload }) {
  const demo = cur.cycle.status === 'demo';
  const [error, setError] = useState('');
  const voted = cur.myVote === e.id;
  const vote = async () => {
    setError('');
    try { await api.post(`/cycles/${cur.cycle.id}/vote`, { entry_id: e.id }); await reload(); } catch (err) { setError(err.message); }
  };
  return (
    <article className="cy-card">
      <h3>{e.title}</h3>
      <p>{e.pitch}</p>
      <p className="m">{e.team.map((t) => t.name).join(', ')} · {e.devlog_count} {e.devlog_count === 1 ? 'devlog' : 'devlogs'}{e.demoed ? ' · demoed' : ''}</p>
      {e.devlogs[0] && <p className="d cy-last">Latest: {e.devlogs[0].text}</p>}
      <div className="cy-act">
        {e.repo_url && <a className="u" href={e.repo_url} target="_blank" rel="noreferrer noopener">repo</a>}
        {e.demo_url && <a className="u" href={e.demo_url} target="_blank" rel="noreferrer noopener">demo</a>}
        {demo && d.signedIn && !e.mine && (
          <button type="button" className="btn" aria-pressed={voted} onClick={vote}>{voted ? 'Your vote' : 'Vote'}</button>
        )}
        {demo && e.mine && <span className="m">your team</span>}
      </div>
      {error && <p className="dn" role="alert">{error}</p>}
    </article>
  );
}
