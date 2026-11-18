/**
 * Arena (C1): the Board. One screen per track: the rung you are on, big, with
 * its hint and an Open button, and the whole ladder beside it as a path.
 * Nothing is locked; tapping any rung on the path puts it in the big card.
 * Signed out, the board is the same with no progress.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import CodeforcesPanel from '../components/CodeforcesPanel.jsx';
import { TRACKS, PLACEMENT, ladderOf, nextRung, rungStates, hostOf, trackOf } from '../../shared/board.js';

const fmtDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Pips({ n }) {
  return (
    <span className="ar-pips" role="img" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : undefined} />)}
    </span>
  );
}

/* ------------------------------- placement ------------------------------- */

function Placement({ onDone }) {
  const [a, setA] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ready = PLACEMENT.every((q) => a[q.id] !== undefined);
  const send = async (answers) => {
    setBusy(true);
    setErr('');
    try {
      onDone(await api.post('/board/placement', { answers }));
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <section className="ar-place" aria-labelledby="place-h">
      <h2 id="place-h">Three questions, then you get a starting square on every track.</h2>
      {PLACEMENT.map((q) => (
        <fieldset key={q.id}>
          <legend>{q.q}</legend>
          <div className="chips">
            {q.options.map((o, i) => (
              <button key={o} type="button" aria-pressed={a[q.id] === i} onClick={() => setA({ ...a, [q.id]: i })}>{o}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="ar-row">
        <button type="button" className="btn pri" disabled={!ready || busy} onClick={() => send(a)}>Place me</button>
        <button type="button" className="btn" disabled={busy} onClick={() => send({ coded: 0, contest: 0, focus: 0 })}>Start at the bottom</button>
        {err && <span className="dn" role="alert">{err}</span>}
      </div>
    </section>
  );
}

/* ------------------------------- the big card ------------------------------- */

function RungCard({ rung, state, signedIn, onProgress, isNext }) {
  const [answer, setAnswer] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAnswer('');
    setMsg(null);
  }, [rung.id]);

  const done = state === 'done';
  const host = hostOf(rung.url);
  const internal = rung.url.startsWith('/');

  const start = () => signedIn && !done && api.post(`/board/rungs/${rung.id}/start`).then(() => onProgress(rung.id, 'started')).catch(() => {});
  const tick = async (body = {}) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post(`/board/rungs/${rung.id}/done`, body);
      if (r.correct) onProgress(rung.id, 'done', r.method);
      else setMsg({ ok: false, t: 'Not it. Check it and try again.' });
    } catch (e) {
      setMsg({ ok: false, t: e.message });
    }
    setBusy(false);
  };
  const undo = async () => {
    setBusy(true);
    await api.post(`/board/rungs/${rung.id}/undo`).catch(() => {});
    onProgress(rung.id, 'started');
    setBusy(false);
  };

  const openLabel = rung.verify === 'internal' ? 'Solve it here' : internal ? 'Open' : `Open on ${host}`;
  return (
    <article className={`ar-card${done ? ' is-done' : ''}`} aria-live="polite">
      <p className="ar-status">
        {done ? 'Done' : isNext ? 'Next up' : state === 'skipped' ? 'Below your start' : 'Further up the ladder'}
        <span>{trackOf(rung.track).tiers.find(([id]) => id === rung.tier)?.[1]}</span>
      </p>
      <h2 className="ar-title">{rung.title}</h2>
      <p className="ar-meta">
        <span>{host}</span>
        <Pips n={rung.difficulty} />
        {rung.n > 0 && <span>{rung.n} {rung.n === 1 ? 'clubmate' : 'clubmates'} done</span>}
      </p>
      {rung.hint && <p className="ar-hint">{rung.hint}</p>}

      <div className="ar-row">
        {internal ? (
          <Link className="btn pri" to={rung.url} onClick={start}>{openLabel}</Link>
        ) : (
          <a className="btn pri" href={rung.url} target="_blank" rel="noreferrer noopener" onClick={start}>
            {openLabel}<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {signedIn && !done && (rung.verify === 'checkbox' || rung.verify === 'codeforces') && (
          <button type="button" className="btn" disabled={busy} onClick={() => tick()}>Mark done</button>
        )}
        {signedIn && done && (
          <span className="ar-ok">Done{rung.method === 'answer' ? ', answer checked' : rung.method === 'judge' ? ', tests passed' : ''}</span>
        )}
        {signedIn && done && rung.method === 'self' && (
          <button type="button" className="linkb" disabled={busy} onClick={undo}>Undo</button>
        )}
      </div>

      {signedIn && !done && rung.verify === 'answer' && (
        <form className="ar-answer" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) tick({ answer }); }}>
          <label htmlFor={`ans-${rung.id}`}>Your answer</label>
          <div className="ar-row">
            <input id={`ans-${rung.id}`} className="field" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" spellCheck={false} />
            <button className="btn" disabled={busy || !answer.trim()}>Check</button>
          </div>
        </form>
      )}
      {signedIn && !done && rung.verify === 'internal' && <p className="ar-note">Ticks itself when every test passes.</p>}
      {signedIn && !done && rung.verify === 'codeforces' && <p className="ar-note">Solve it on Codeforces. It ticks itself once your handle is linked below, or mark it done by hand.</p>}
      {!signedIn && <p className="ar-note"><Link className="uline g" to="/signin">Sign in</Link> to keep your place on the board.</p>}
      {msg && <p className={msg.ok ? 'up' : 'dn'} role="status">{msg.t}</p>}
    </article>
  );
}

function Usaco({ c }) {
  return (
    <div className="ar-usaco">
      <b>USACO</b>
      {c ? (
        c.live ? (
          <span>{c.name} is open now, until {fmtDay(c.end)}.</span>
        ) : (
          <span>
            {c.name} opens in <strong>{c.days}</strong> {c.days === 1 ? 'day' : 'days'}, {fmtDay(c.start)} to {fmtDay(c.end)}.
          </span>
        )
      ) : (
        <span>This season's contest dates are not posted yet. <a className="uline" href="https://usaco.org/" target="_blank" rel="noreferrer noopener">usaco.org</a></span>
      )}
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function Arena() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [track, setTrack] = useState(null);
  const [picked, setPicked] = useState(null); // a rung tapped on the path; null = the next one
  useReveal();

  const load = () => {
    setError('');
    api.get('/board').then((x) => {
      setD(x);
      setTrack((t) => t ?? x.placement?.focus ?? 'contest');
    }).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const boards = useMemo(() => {
    if (!d) return {};
    const start = d.placement?.start ?? {};
    return Object.fromEntries(TRACKS.map((t) => {
      const ladder = ladderOf(d.rungs, t.id);
      return [t.id, { ladder, next: nextRung(ladder, d.progress, start[t.id] ?? 1), states: rungStates(ladder, d.progress, start[t.id] ?? 1), done: ladder.filter((r) => d.progress[r.id]?.status === 'done').length }];
    }));
  }, [d]);

  if (error) return <div className="state-note bad">{error} <button className="btn" onClick={load}>Try again</button></div>;
  if (!d) return <div className="state-note">loading the board...</div>;

  const onProgress = (id, status, method) => {
    setD((x) => ({
      ...x,
      progress: { ...x.progress, [id]: { status, method: method ?? x.progress[id]?.method ?? '' } },
      rungs: x.rungs.map((r) => (r.id === id && status === 'done' && x.progress[id]?.status !== 'done' ? { ...r, n: r.n + 1 } : r)),
    }));
    if (status === 'done') setPicked(null); // move the card on to the next rung
  };

  const b = boards[track];
  const rung = b.ladder.find((r) => r.id === picked) ?? b.next ?? b.ladder.at(-1);
  const totalDone = Object.values(d.progress).filter((p) => p.status === 'done').length;
  const needsPlacement = d.signedIn && !d.placement;
  const t = trackOf(track);

  return (
    <>
      <PageHead
        eyebrow="arena"
        title="The Board"
        lead="Five ladders of free problems and lessons. Do the next rung, or skip to any rung you like."
        kv={
          <div className="kv two2">
            <div><span>rungs done</span><strong>{d.signedIn ? totalDone : '-'}</strong></div>
            <div><span>usaco</span><strong>{d.usaco ? (d.usaco.live ? 'live' : `${d.usaco.days}d`) : 'tbd'}</strong></div>
          </div>
        }
      />

      <section className="sec ar">
        <div className="wrap">
          {needsPlacement ? (
            <Placement onDone={(p) => { setD({ ...d, placement: p }); setTrack(p.focus); }} />
          ) : (
            <>
              <div className="ar-tracks" role="tablist" aria-label="Tracks">
                {TRACKS.map((x) => {
                  const bx = boards[x.id];
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="tab"
                      id={`tab-${x.id}`}
                      aria-selected={x.id === track}
                      aria-controls="ar-panel"
                      onClick={() => { setTrack(x.id); setPicked(null); }}
                    >
                      <span className="nm">{x.name}<b>{bx.done}/{bx.ladder.length}</b></span>
                      <span className="nx">{bx.next ? bx.next.title : 'Ladder cleared'}</span>
                      <i style={{ '--p': `${bx.ladder.length ? (bx.done / bx.ladder.length) * 100 : 0}%` }} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>

              <div className="ar-grid" id="ar-panel" role="tabpanel" aria-labelledby={`tab-${track}`}>
                <div className="ar-left">
                  {rung ? (
                    <RungCard rung={{ ...rung, method: d.progress[rung.id]?.method }} state={b.states[rung.id]} isNext={rung === b.next} signedIn={d.signedIn} onProgress={onProgress} />
                  ) : (
                    <p className="ar-note">No rungs on this track yet. Officers add them from the officer page.</p>
                  )}
                  {picked && b.next && picked !== b.next.id && (
                    <button type="button" className="linkb ar-back" onClick={() => setPicked(null)}>Back to your next rung</button>
                  )}
                  {track === 'contest' && <Usaco c={d.usaco} />}
                  {track === 'contest' && d.signedIn && <CodeforcesPanel onSynced={load} />}
                  <p className="ar-blurb">{t.blurb}</p>
                </div>

                <ol className="ar-path" aria-label={`${t.name} ladder`}>
                  {t.tiers.map(([tid, tname]) => {
                    const list = b.ladder.filter((r) => r.tier === tid);
                    if (!list.length) return null;
                    return (
                      <li key={tid} className="ar-tier">
                        <h3>{tname}<span>{list.filter((r) => b.states[r.id] === 'done').length}/{list.length}</span></h3>
                        <ol>
                          {list.map((r) => {
                            const s = b.states[r.id];
                            return (
                              <li key={r.id} className={`s-${s}${r.id === rung?.id ? ' sel' : ''}`}>
                                <button type="button" onClick={() => setPicked(r.id)} aria-current={r.id === rung?.id ? 'step' : undefined}>
                                  <i aria-hidden="true" />
                                  <span className="rt">{r.title}</span>
                                  <span className="rh">{s === 'next' ? 'next up' : hostOf(r.url)}</span>
                                  {s !== 'next' && <span className="sr-only">, {s === 'skipped' ? 'below your start' : s}</span>}
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </li>
                    );
                  })}
                  <li className="ar-foot">
                    Predict a hidden column with pandas in the <Link className="uline g" to="/arena/data">data challenges</Link>.{' '}
                    The club's own courses are still at <Link className="uline" to="/learn">/learn</Link>.
                    {d.signedIn && d.placement && (
                      <> <button type="button" className="linkb" onClick={() => setD({ ...d, placement: null })}>Retake placement</button></>
                    )}
                  </li>
                </ol>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
