/**
 * Duel block (B2) and pair maker (B9) screens. The room's Durable Object
 * (worker/hub/room-do.js + duel.js) holds the state; these render it.
 *
 *   DuelSetup  officer opens a live duel pack in one tap (V3-B), or picks
 *              problems per division by hand; round length and count
 *   DuelBoard  the projector: live match grid per division, timer, spotlight
 *   DuelPlay   a student's laptop: pick a division, solve, submit, result
 *   PairPanel  officer "pair the room"; PartnerCard shows a student their partner
 *
 * Judging runs in the browser (CodeRunner / pyrunner). Code is sent to the
 * room on submit for officer spot-checks and is never rendered on the projector.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { judge } from '../lib/run/index.js';
import CodeRunner from '../components/CodeRunner.jsx';
import Editorials from '../components/Editorials.jsx';
import { Spinner } from '../components/bits.jsx';
import { Body } from './Course.jsx';

export const DIVS = [
  ['new', 'New', 'First year of code, or never done a contest'],
  ['comfortable', 'Comfortable', 'Loops, lists and functions feel fine'],
  ['contest', 'Contest', 'USACO, UIL, Codeforces regulars'],
];
const LABEL = Object.fromEntries(DIVS.map(([k, l]) => [k, l]));

export const clock = (ms) => {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** ms left until a server timestamp, ticking. */
function useLeft(until, skew) {
  const [, tick] = useState(0);
  const live = until > Date.now() + skew;
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [live, until]);
  return Math.max(0, (until ?? 0) - (Date.now() + skew));
}

/** Why the room refused the last action. Fades after a few seconds. */
export function Notice({ notice }) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    setShown(notice.text);
    const id = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  return (
    <p className="duel-notice" role="alert" hidden={!shown}>
      {shown}
    </p>
  );
}

function Timer({ duel, skew, big }) {
  const live = duel.phase === 'live';
  const left = useLeft(live ? duel.endsAt : duel.spotlightEndsAt, skew);
  if (duel.phase !== 'live' && duel.phase !== 'spotlight') return null;
  return (
    <div className={`duel-timer ${big ? 'big' : ''} ${live && left < 60_000 ? 'hot' : ''}`} role="timer" aria-label={live ? 'Round time left' : 'Spotlight time left'}>
      <span>{live ? 'round' : 'spotlight'}</span>
      <b>{clock(left)}</b>
    </div>
  );
}

/** Attempt counts are private: the projector and other players see only working / solved, never who is struggling. */
function SideStatus({ s, over, showTries = true }) {
  if (s.solved) return <span className={`duel-st ok ${s.won ? 'won' : ''}`}>{s.won ? 'won ' : 'solved '}{clock(s.ms)}</span>;
  if (s.attempts && showTries) return <span className="duel-st try">{s.attempts} {s.attempts === 1 ? 'try' : 'tries'}</span>;
  return <span className="duel-st">{over ? 'no submit' : 'working'}</span>;
}

function GhostRow({ ms }) {
  return (
    <li className="duel-side ghost">
      <span className="duel-nm">Ghost</span>
      <span className="duel-st">{ms == null ? 'first time on this one' : `best ${clock(ms)}`}</span>
    </li>
  );
}

/* --------------------------------- officer -------------------------------- */

/** preset (Wave 6): the duel block's payload from the plan, { set, minutes, rounds, newMode }. */
export function DuelSetup({ send, disabled, preset }) {
  const [all, setAll] = useState(null);
  const [err, setErr] = useState('');
  const [diff, setDiff] = useState(0);
  const [div, setDiv] = useState('new');
  const [picked, setPicked] = useState({ new: [], comfortable: [], contest: [] });
  const [minutes, setMinutes] = useState(preset?.minutes ?? 10);
  const [rounds, setRounds] = useState(preset?.rounds ?? 3);
  const [newMode, setNewMode] = useState(preset?.newMode ?? '1v1');
  const [packs, setPacks] = useState(null); // V3-B: live duel packs, played in one tap
  const [hand, setHand] = useState(false);

  useEffect(() => {
    api
      .get('/admin/hub/problems?status=live')
      .then((d) => setAll(d.problems))
      .catch((e) => setErr(e.message));
    api
      .get('/admin/hub/sets?kind=duel&status=live')
      .then((d) => setPacks(d.sets))
      .catch((e) => setErr(e.message));
  }, []);

  const titles = useMemo(() => Object.fromEntries((all ?? []).map((p) => [p.slug, p.title])), [all]);
  const toggle = (slug) =>
    setPicked((p) => {
      const cur = p[div];
      if (cur.includes(slug)) return { ...p, [div]: cur.filter((x) => x !== slug) };
      return cur.length >= 3 ? p : { ...p, [div]: [...cur, slug] };
    });
  const total = Object.values(picked).flat().length;
  const settings = { minutes: Number(minutes), rounds: Number(rounds), newMode };
  const byHand = hand || (packs && !packs.length);
  const planned = preset?.set ? packs?.find((p) => p.slug === preset.set) : null;

  return (
    <section className="card grid gap-3 p-5" aria-label="Set up a duel">
      {err && <p className="dn text-sm">{err}</p>}
      {planned && (
        <div className="duel-planned">
          <p className="eyebrow">Planned for tonight</p>
          <button type="button" className="btn btn-primary duel-planned__go" disabled={disabled} onClick={() => send({ t: 'duel_setup', set: planned.slug, minutes: preset.minutes, rounds: preset.rounds, newMode: preset.newMode })}>
            Open the lobby with {planned.title}
          </button>
          <p className="m mono text-xs">{preset.rounds} rounds of {preset.minutes} minutes{preset.newMode === '2v2' ? ', New plays 2v2' : ''}</p>
        </div>
      )}
      {preset?.set && packs && !planned && <p className="dn text-sm">The planned pack ({preset.set}) is not live any more. Pick another below.</p>}
      <p className="eyebrow">Duel: use a pack</p>
      {!packs ? (
        !err && <Spinner label="Loading duel packs" />
      ) : !packs.length ? (
        <p className="d text-sm">No live duel packs yet. Make one in Officer tools, Duel packs and contest sets.</p>
      ) : (
        <ul className="duel-packs">
          {packs.map((s) => (
            <li key={s.slug}>
              <PackSummary set={s} titles={titles} />
              <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => send({ t: 'duel_setup', set: s.slug, ...settings })}>
                Open the lobby with {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="mono grid gap-1 text-xs">
          Minutes per round
          <input className="field" style={{ width: '6rem' }} type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="mono grid gap-1 text-xs">
          Rounds
          <input className="field" style={{ width: '5rem' }} type="number" min={1} max={6} value={rounds} onChange={(e) => setRounds(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="New division format">
          <button type="button" aria-pressed={newMode === '1v1'} onClick={() => setNewMode('1v1')}>New: 1v1</button>
          <button type="button" aria-pressed={newMode === '2v2'} onClick={() => setNewMode('2v2')}>New: 2v2 driver and navigator</button>
        </div>
      </div>
      {packs?.length > 0 && (
        <button type="button" className="btn btn-ghost justify-self-start" aria-expanded={hand} onClick={() => setHand((h) => !h)}>
          {hand ? 'Hide the hand picker' : 'Pick problems by hand'}
        </button>
      )}
      {byHand && <HandPicker {...{ all, err, diff, setDiff, div, setDiv, picked, toggle, total, disabled }} onOpen={() => send({ t: 'duel_setup', problems: picked, ...settings })} />}
    </section>
  );
}

/** What a pack plays: the three problems per division, plus its warm-up and final. */
function PackSummary({ set, titles }) {
  const name = (slug) => titles[slug] ?? slug;
  const b = set.body;
  return (
    <div className="min-w-0">
      <b>{set.title}</b>
      <dl className="duel-pack-divs">
        {DIVS.map(([k, l]) => (
          <div key={k}>
            <dt>{l}</dt>
            <dd>{(b[k] ?? []).map(name).join(', ') || 'none'}</dd>
          </div>
        ))}
      </dl>
      {(b.practice || b.final) && (
        <p className="m mono text-xs">
          {b.practice && <>Warm-up while people arrive: <Link to={`/p/${b.practice}`}>{name(b.practice)}</Link>. </>}
          {b.final && <>Final for pairs: <Link to={`/p/${b.final}`}>{name(b.final)}</Link>.</>}
        </p>
      )}
    </div>
  );
}

/** The original setup: up to 3 problems per division from the live bank. */
function HandPicker({ all, err, diff, setDiff, div, setDiv, picked, toggle, total, disabled, onOpen }) {
  const shown = (all ?? []).filter((p) => !diff || p.difficulty === diff);
  return (
    <div className="grid gap-3">
      <p className="eyebrow">By hand: up to 3 problems per division, played one per round</p>
      <div className="chips" role="group" aria-label="Division">
        {DIVS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={div === k} onClick={() => setDiv(k)}>
            {l} {picked[k].length}/3
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Difficulty">
        {[0, 1, 2, 3, 4, 5].map((d) => (
          <button key={d} type="button" aria-pressed={diff === d} onClick={() => setDiff(d)}>
            {d ? `level ${d}` : 'any level'}
          </button>
        ))}
      </div>
      {!all ? (
        !err && <Spinner label="Loading problems" />
      ) : !shown.length ? (
        <p className="d text-sm">No live problems at this level. Add some in Officer tools, Problem bank.</p>
      ) : (
        <ul className="duel-pick" aria-label={`Problems for ${LABEL[div]}`}>
          {shown.map((p) => {
            const at = picked[div].indexOf(p.slug);
            return (
              <li key={p.slug}>
                <button type="button" aria-pressed={at >= 0} onClick={() => toggle(p.slug)}>
                  <span className="mono">{at >= 0 ? `R${at + 1}` : '  '}</span>
                  <span>{p.title}</span>
                  <span className="m">lvl {p.difficulty}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className="btn btn-primary"
        style={{ padding: '0.8rem', justifyContent: 'center' }}
        disabled={!total || disabled}
        onClick={onOpen}
      >
        Open the duel lobby
      </button>
    </div>
  );
}

/** The projector. Per division, never a ranking across them, never code. */
export function DuelBoard({ duel, send, skew, readOnly = false }) {
  const divs = DIVS.filter(([k]) => duel.open[k]);
  const solvers = duel.matches.flatMap((m) => m.sides.filter((s) => s.solved).map((s) => ({ ...s, div: m.div, title: m.title })));
  const last = duel.round >= duel.rounds;
  const over = duel.phase !== 'live';

  return (
    <section className="duel-board" aria-label="Duel">
      <header className="duel-head">
        <div>
          <p className="eyebrow">duel {duel.round ? `round ${duel.round} of ${duel.rounds}` : `${duel.rounds} rounds, ${duel.minutes} min each`}</p>
          <h2 className="display duel-phase">
            {duel.phase === 'lobby' ? 'Pick your division' : duel.phase === 'live' ? 'Go' : duel.phase === 'spotlight' ? 'How I solved it' : 'Duel over'}
          </h2>
        </div>
        <Timer duel={duel} skew={skew} big />
      </header>

      {duel.spotlight && duel.phase === 'spotlight' && (
        <div className="duel-spot" role="status">
          <span className="eyebrow">explaining {duel.spotlight.title}</span>
          <b>{duel.spotlight.name}</b>
          {duel.spotlight.ms != null && <span className="mono">solved in {clock(duel.spotlight.ms)}</span>}
        </div>
      )}

      {duel.phase === 'lobby' ? (
        <div className="duel-cols">
          {divs.map(([k, l]) => (
            <div key={k} className="duel-col">
              <h3>{l}</h3>
              <p className="duel-ready">
                <b>{duel.ready[k]}</b> ready
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="duel-cols">
          {divs.map(([k, l]) => {
            const ms = duel.matches.filter((m) => m.div === k);
            return (
              <div key={k} className="duel-col">
                <h3>
                  {l} <span className="m">{ms[0]?.title}</span>
                </h3>
                {!ms.length && <p className="m">Nobody this round.</p>}
                {ms.map((m) => (
                  <ol key={m.id} className="duel-match" aria-label={`Match ${m.id}`}>
                    {m.sides.map((s, i) => (
                      <li key={i} className={`duel-side ${s.won ? 'won' : ''}`}>
                        <span className="duel-nm">{s.names.join(' + ')}</span>
                        <SideStatus s={s} over={over} showTries={!readOnly} />
                      </li>
                    ))}
                    {m.ghost && <GhostRow ms={m.ghostMs} />}
                  </ol>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {duel.waiting > 0 && duel.phase !== 'lobby' && <p className="m mono mt-3 text-sm">{duel.waiting} waiting for the next round</p>}

      {!readOnly && duel.phase === 'spotlight' && solvers.length > 0 && (
        <div className="duel-solvers" role="group" aria-label="Pick someone to explain">
          <span className="eyebrow">ask one to explain</span>
          {solvers.flatMap((s) =>
            s.uids.map((u, i) => (
              <button key={u} type="button" className="btn btn-ghost" onClick={() => send({ t: 'duel_spotlight', uid: u })}>
                {s.names[i]} <span className="m">{LABEL[s.div]}{s.won ? ', won' : ''}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="duel-ctl" hidden={readOnly}>
        {duel.phase === 'live' && (
          <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'duel_end_round' })}>End round now</button>
        )}
        {(duel.phase === 'lobby' || (duel.phase === 'spotlight' && !last)) && (
          <button type="button" className="btn btn-primary" onClick={() => send({ t: 'duel_start' })}>
            Start round {duel.round + 1}
          </button>
        )}
        {duel.phase === 'spotlight' && (
          <button type="button" className={`btn ${last ? 'btn-primary' : 'btn-ghost'}`} onClick={() => send({ t: 'duel_finish' })}>Finish duel</button>
        )}
        {duel.phase !== 'live' && (
          <button type="button" className="btn btn-ghost" onClick={() => window.confirm('Close the duel? Results already saved stay saved.') && send({ t: 'duel_close' })}>
            Close duel
          </button>
        )}
      </div>
    </section>
  );
}

/** B9: pair the room. Remembers the last pairs so the next press rotates. */
export function PairPanel({ pairs, send }) {
  return (
    <section className="card grid gap-3 p-5" aria-label="Pair maker">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Pairs</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'pairs', mode: 'random' })}>Pair at random</button>
          <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'pairs', mode: 'mixed' })} title="Uses duel divisions as the level">
            Pair mixed levels
          </button>
          {pairs && <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'pairs_clear' })}>Clear</button>}
        </div>
      </div>
      {pairs?.length ? (
        <ol className="duel-pairs">
          {pairs.map((g, i) => (
            <li key={i}>{g.join(' + ')}</li>
          ))}
        </ol>
      ) : (
        <p className="m text-sm">Everyone here gets a partner. Press again for new pairs.</p>
      )}
    </section>
  );
}

export function PartnerCard({ partner }) {
  if (!partner) return null;
  return (
    <section className="card duel-partner p-4" aria-label="Your partner">
      <p className="eyebrow">your partner</p>
      <b>{partner.length ? partner.join(' and ') : 'Find an officer'}</b>
    </section>
  );
}

/* --------------------------------- student -------------------------------- */

function DivisionPicker({ duel, send }) {
  return (
    <section className="card p-5" aria-label="Pick a division">
      <p className="eyebrow">duel: pick your division</p>
      <p className="d mt-1 text-sm">You race someone in the same division. Pick honestly: it is more fun close.</p>
      <div className="duel-divs mt-4">
        {DIVS.filter(([k]) => duel.open[k]).map(([k, l, hint]) => (
          <button key={k} type="button" aria-pressed={duel.div === k} onClick={() => send({ t: 'duel_div', div: k })}>
            <b>{l}</b>
            <span>{hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Versus({ match, over }) {
  return (
    <ol className="duel-match vs" aria-label="Your match">
      {match.sides.map((s, i) => (
        <li key={i} className={`duel-side ${s.won ? 'won' : ''} ${i === match.me ? 'me' : ''}`}>
          <span className="duel-nm">{i === match.me ? (s.names.length > 1 ? 'Your team' : 'You') : s.names.join(' + ')}</span>
          <SideStatus s={s} over={over} showTries={i === match.me} />
        </li>
      ))}
      {match.ghost && <GhostRow ms={match.ghostMs} />}
    </ol>
  );
}

function Arena({ duel, match, send, skew }) {
  const [prob, setProb] = useState(null);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('java');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const mine = match.sides[match.me];
  const team = mine.names.length > 1;

  useEffect(() => {
    setProb(null);
    setLast(null);
    api
      .get(`/problems/${encodeURIComponent(match.slug)}`)
      .then((p) => {
        setProb(p);
      })
      .catch((e) => setErr(e.message));
  }, [match.slug, duel.round]);

  async function doSubmit() {
    setBusy(true);
    try {
      const res = await judge({ lang, source: code, cases: prob.cases });
      const passed = res.passed;
      setLast({ passed, n: res.results.filter((r) => r.ok).length, of: res.results.length });
      send({ t: 'duel_submit', round: duel.round, slug: match.slug, passed, code });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="duel-arena">
      <div className="duel-bar">
        <div>
          <p className="eyebrow">round {duel.round} of {duel.rounds}, {LABEL[duel.div] ?? ''}</p>
          <h2 className="display duel-title">{match.title}</h2>
          {team && (
            <p className="g mono text-sm">
              {match.seat === 0 ? 'You drive first: you type.' : 'You navigate first: you read and think out loud.'} Swap halfway.
            </p>
          )}
        </div>
        <Timer duel={duel} skew={skew} />
      </div>
      <Versus match={match} />

      {err && <p className="dn mt-3 text-sm">{err}</p>}
      {!prob ? (
        !err && <Spinner label="Loading the problem" />
      ) : (
        <div className="duel-work">
          <article className="duel-statement">
            <Body text={prob.body} />
          </article>
          <div className="min-w-0">
            {mine.solved ? (
              <div className="duel-done" role="status">
                <b>Accepted</b>
                <span>in {clock(mine.ms)}, {mine.attempts} {mine.attempts === 1 ? 'try' : 'tries'}</span>
                <span className="d">{mine.won ? 'First in your match.' : 'Nice. Stay put for the spotlight.'}</span>
              </div>
            ) : (
              <>
                <CodeRunner key={`${match.slug}-${duel.round}`} id="duel" cases={prob.cases} starter={prob.starter} onChange={(c, l) => { setCode(c); setLang(l); }} runLabel="Run tests" playground={false} />
                <button type="button" className="btn btn-primary duel-submit" disabled={busy || !code.trim()} onClick={doSubmit}>
                  {busy ? 'Judging...' : 'Submit'}
                </button>
                <p className="m mono mt-1 text-xs">Run tests as often as you like. Submit counts as a try.</p>
                {last && !last.passed && (
                  <p className="dn mono mt-2 text-sm" role="status">
                    Not yet: {last.n} of {last.of} tests passed.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Result({ duel, match }) {
  const mine = match.sides[match.me];
  const verdict = mine.won ? 'You won' : mine.solved ? 'Solved' : 'Not this time';
  return (
    <section className="card duel-result p-6" aria-label="Round result">
      <p className="eyebrow">round {duel.round} of {duel.rounds}: {match.title}</p>
      <h2 className={`display ${mine.won ? 'g' : ''}`}>{verdict}</h2>
      <p className="mono d">
        {mine.solved ? `${clock(mine.ms)}, ` : ''}
        {mine.attempts} {mine.attempts === 1 ? 'try' : 'tries'}
      </p>
      <div className="mt-4">
        <Versus match={match} over />
      </div>
      {duel.spotlight && (
        <p className="mt-4" role="status">
          <b className="g">{duel.spotlight.name}</b> is explaining how they solved it.
        </p>
      )}
      {mine.solved && match.slug && <div className="mt-4"><Editorials slug={match.slug} /></div>}
      <p className="m mono mt-4 text-sm">{duel.phase === 'done' ? 'That was the last round. Thanks for playing.' : 'Next round soon.'}</p>
    </section>
  );
}

/** Everything a student sees of the duel. */
export function DuelPlay({ duel, send, skew }) {
  if (duel.phase === 'live' && duel.match) return <Arena duel={duel} match={duel.match} send={send} skew={skew} />;
  return (
    <div className="grid gap-4">
      {duel.match && duel.phase !== 'live' && <Result duel={duel} match={duel.match} />}
      {duel.phase === 'live' && (
        <div className="card p-5" role="status">
          <p className="display text-xl">Round {duel.round} is running</p>
          <p className="d mt-1 text-sm">{duel.div ? 'You are in the next round.' : 'Pick a division to join the next round.'}</p>
        </div>
      )}
      {duel.phase === 'lobby' && duel.div && (
        <p className="g mono text-sm" role="status">
          You are in {LABEL[duel.div]}. Waiting for the round to start.
        </p>
      )}
      {duel.phase !== 'done' && <DivisionPicker duel={duel} send={send} />}
    </div>
  );
}
