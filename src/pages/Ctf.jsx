/**
 * Arena > CTF board (C11): flags by category, a solo and squad scoreboard,
 * upcoming CTFtime events, and a form for members to write a challenge.
 * Flags are checked on the server; nothing here ever holds an answer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { CATEGORIES } from '../../shared/ctf.js';

const DIFF = { 1: 'easy', 2: 'medium', 3: 'hard' };
const fmtDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const BLANK = { title: '', category: 'crypto', difficulty: 1, body: '', file_name: '', file_data: '', hint: '', flag: '' };

function Challenge({ slug, signedIn, onSolved }) {
  const [c, setC] = useState(null);
  const [flag, setFlag] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setC(null);
    setFlag('');
    setMsg(null);
    setHint(false);
    api.get(`/ctf/challenges/${slug}`).then(setC).catch((e) => setMsg({ ok: false, t: e.message }));
  }, [slug]);

  const submit = async (e) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post(`/ctf/challenges/${slug}/solve`, { flag });
      if (r.correct) {
        setMsg({ ok: true, t: r.already ? 'Already solved.' : r.awarded ? `Correct. ${r.awarded} club point${r.awarded === 1 ? '' : 's'}.` : 'Correct.' });
        onSolved();
      } else setMsg({ ok: false, t: 'Not the flag. Check the format and try again.' });
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
    setBusy(false);
  };

  if (!c) return <div className="pn-b">{msg ? <p className="dn" role="alert">{msg.t}</p> : <p className="d">loading...</p>}</div>;
  return (
    <div className="pn-b ctf-det">
      <h2>{c.title}</h2>
      <p className="d">{c.category} / {DIFF[c.difficulty]} / {c.points} pts{c.author_name ? ` / by ${c.author_name}` : ''}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{c.body}</p>
      {c.file_data && (
        <>
          <p className="d">
            {c.file_name}{' '}
            <a className="uline g" href={`data:text/plain;charset=utf-8,${encodeURIComponent(c.file_data)}`} download={c.file_name}>download</a>
          </p>
          <pre className="ctf-file" tabIndex={0} aria-label={`Contents of ${c.file_name}`}>{c.file_data}</pre>
        </>
      )}
      {c.hint && (hint ? <p className="d">Hint: {c.hint}</p> : <button type="button" className="linkb" onClick={() => setHint(true)}>Show the hint</button>)}
      {signedIn ? (
        <form onSubmit={submit} className="ctf-row">
          <label className="sr-only" htmlFor="ctf-flag">Flag</label>
          <input id="ctf-flag" className="field" placeholder="csclub{...}" value={flag} onChange={(e) => setFlag(e.target.value)} autoComplete="off" spellCheck={false} maxLength={200} />
          <button className="btn pri" disabled={busy || !flag.trim()}>Submit</button>
        </form>
      ) : (
        <p className="d"><Link className="uline g" to="/signin">Sign in</Link> to submit a flag.</p>
      )}
      {msg && <p className={msg.ok ? 'up' : 'dn'} role="status">{msg.t}</p>}
    </div>
  );
}

function Author({ onSent }) {
  const [f, setF] = useState(BLANK);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const loadMine = useCallback(() => api.get('/ctf/mine').then((d) => setMine(d.challenges)).catch(() => {}), []);
  useEffect(() => { loadMine(); }, [loadMine]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/ctf/challenges', { ...f, difficulty: Number(f.difficulty) });
      setMsg({ ok: true, t: 'Sent to the officers. It appears on the board once one approves it.' });
      setF(BLANK);
      loadMine();
      onSent();
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
    setBusy(false);
  };

  return (
    <div className="pn-b">
      <p className="d">Write a puzzle solvable from a text file alone: no live servers, nothing that attacks a real site. An officer reviews it, and an approved one counts as shipping.</p>
      <form onSubmit={submit} className="ctf-form">
        <label>Title<input className="field" value={f.title} onChange={set('title')} maxLength={80} required /></label>
        <div className="ctf-two">
          <label>Category
            <select className="field" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Difficulty
            <select className="field" value={f.difficulty} onChange={set('difficulty')}>{[1, 2, 3].map((d) => <option key={d} value={d}>{d} ({DIFF[d]})</option>)}</select>
          </label>
        </div>
        <label>What the player is asked to do<textarea className="field" rows={3} value={f.body} onChange={set('body')} maxLength={4000} required /></label>
        <label>File name (optional)<input className="field" value={f.file_name} onChange={set('file_name')} maxLength={60} placeholder="note.txt" /></label>
        <label>File contents (text, up to 20,000 characters)<textarea className="field" rows={4} value={f.file_data} onChange={set('file_data')} maxLength={20000} spellCheck={false} /></label>
        <label>Hint (optional)<input className="field" value={f.hint} onChange={set('hint')} maxLength={300} /></label>
        <label>The flag<input className="field" value={f.flag} onChange={set('flag')} maxLength={100} placeholder="csclub{...}" autoComplete="off" spellCheck={false} required /></label>
        <p className="d">The flag is stored as a hash. Nobody, including officers, can read it back, so keep a copy.</p>
        <div className="ctf-row"><button className="btn pri" disabled={busy}>Send for review</button></div>
      </form>
      {msg && <p className={msg.ok ? 'up' : 'dn'} role="status">{msg.t}</p>}
      {mine.length > 0 && (
        <ul className="ctf-mine">
          {mine.map((m) => (
            <li key={m.id}><b>{m.title}</b> <span className="d">{m.category}, {m.status}{m.status === 'rejected' && m.reject_reason ? `: ${m.reject_reason}` : ''}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Ctf() {
  const [d, setD] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [pick, setPick] = useState(null);
  useReveal();

  const load = useCallback(() => {
    api.get('/ctf').then(setD).catch((e) => setError(e.message));
    api.get('/ctf/scoreboard').then(setBoard).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => (d?.challenges ?? []).filter((c) => cat === 'all' || c.category === cat), [d, cat]);
  const counts = useMemo(() => Object.fromEntries((d?.categories ?? []).map((k) => [k, d.challenges.filter((c) => c.category === k).length])), [d]);
  const done = d ? d.challenges.filter((c) => c.solved).length : 0;

  if (error) return <div className="state-note bad">{error} <button className="btn" onClick={load}>Try again</button></div>;
  if (!d) return <div className="state-note">loading the CTF board...</div>;

  return (
    <>
      <PageHead
        eyebrow="ls arena/ctf"
        title="Capture the flag."
        lead="Each puzzle hides a flag that looks like csclub{...}. Find it, submit it, climb the board."
        kv={
          <div className="kv two2">
            <div><span>challenges</span><strong>{d.challenges.length}</strong></div>
            <div><span>you solved</span><strong>{d.signedIn ? done : '-'}</strong></div>
          </div>
        }
      />
      <section className="sec" style={{ border: 0 }}>
        <div className="wrap ctf">
          <div className="chips" role="group" aria-label="Category">
            <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>all ({d.challenges.length})</button>
            {d.categories.map((k) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}>{k} ({counts[k]})</button>)}
          </div>
          <div className="ctf-cols">
            <Pane file="challenges" meta={`${shown.length} shown`}>
              <ul className="ctf-list">
                {shown.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`ctf-item${pick === c.slug ? ' on' : ''}`} aria-pressed={pick === c.slug} onClick={() => setPick(c.slug)}>
                      <span className="ctf-t">{c.title}{c.solved && <span className="up"> solved</span>}</span>
                      <span className="d">{c.category} / {DIFF[c.difficulty]} / {c.points} pts / {c.solves} solved</span>
                    </button>
                  </li>
                ))}
                {!shown.length && <li className="d">Nothing in this category yet.</li>}
              </ul>
            </Pane>
            <Pane file={pick ?? 'pick one'} meta="the puzzle">
              {pick ? <Challenge slug={pick} signedIn={d.signedIn} onSolved={load} /> : <div className="pn-b"><p className="d">Pick a challenge on the left.</p></div>}
            </Pane>
          </div>

          <div className="ctf-cols">
            <Pane file="scoreboard" meta="solo, all time">
              <div className="pn-b">
                {board?.solo.length ? (
                  <ol className="ctf-sc">{board.solo.map((s) => <li key={s.place}><b>{s.name}</b><span>{s.score} pts</span><span className="d">{s.solves} solved</span></li>)}</ol>
                ) : <p className="d">No solves yet. Be first.</p>}
                {board?.squads.length > 0 && (
                  <>
                    <h3 className="cmp-h">Squads this season</h3>
                    <ol className="ctf-sc">{board.squads.map((s) => <li key={s.name}><b>{s.name}</b><span>{s.score} pts</span><span className="d">{s.solves} solves</span></li>)}</ol>
                  </>
                )}
              </div>
            </Pane>
            <Pane file="events" meta="from CTFtime">
              <div className="pn-b">
                {d.events.length ? (
                  <ul className="ctf-ev">
                    {d.events.map((e) => (
                      <li key={e.id}>
                        <a className="uline g" href={e.url} target="_blank" rel="noreferrer noopener">{e.title}<span className="sr-only"> (opens in a new tab)</span></a>
                        <span className="d">starts {fmtDay(e.starts)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="d">No upcoming online CTFs listed right now.</p>}
              </div>
            </Pane>
          </div>

          {d.signedIn ? (
            <Pane file="write a challenge" meta="officers review it"><Author onSent={load} /></Pane>
          ) : (
            <p className="d"><Link className="uline g" to="/signin">Sign in</Link> to submit flags and write challenges.</p>
          )}
        </div>
      </section>
    </>
  );
}
