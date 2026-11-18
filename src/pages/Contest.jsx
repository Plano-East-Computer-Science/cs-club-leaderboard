/**
 * Mock contest block (B5) screens. The room's Durable Object
 * (worker/hub/room-do.js + shared/contest.js) holds the state and does the
 * scoring and the freeze; these render it.
 *
 *   ContestSetup    officer picks 3 to 8 bank problems, minutes, freeze and penalty
 *   ContestConsole  officer: teams (make, move), start, end, reveal one team at a time
 *   ContestScreen   the projector: timer and scoreboard, team names only, never code
 *   ContestPlay     a member's laptop: their team's status, the problem set, the editor
 *
 * Judging runs in the browser (pyrunner), the same honour system as duels.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { runCases, warmUp } from '../lib/pyrunner.js';
import CodeRunner from '../components/CodeRunner.jsx';
import { Spinner } from '../components/bits.jsx';
import { Body } from './Course.jsx';
import { clock } from './Duel.jsx';

const LETTERS = 'ABCDEFGH';

/** ms left until a server timestamp, ticking. Kept here so this file does not import Session.jsx (which imports it). */
function useLeft(until, skew) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, until - (Date.now() + skew)) : 0;
}

function Timer({ c, skew, big }) {
  const left = useLeft(c.phase === 'live' ? c.endsAt : 0, skew);
  if (c.phase !== 'live') return null;
  return (
    <div className={`duel-timer ${big ? 'big' : ''} ${left < 60_000 ? 'hot' : ''}`} role="timer" aria-label="Contest time left">
      <span>{c.frozen ? 'board frozen' : 'left'}</span>
      <b>{clock(left)}</b>
    </div>
  );
}

/** One cell: "+" or "+2" with the minute for a solve, "-3" for tries with no solve. */
function Cell({ x }) {
  if (x.ok) {
    return (
      <span className="ct-ok" title={`solved at minute ${Math.floor(x.ms / 60_000)}`}>
        +{x.wrong || ''}
        <small>{Math.floor(x.ms / 60_000)}</small>
      </span>
    );
  }
  return x.wrong ? <span className="ct-no">-{x.wrong}</span> : <span className="ct-none">.</span>;
}

/** The public scoreboard. Team names, places, solved, penalty minutes, one column per problem. */
export function ContestBoard({ c, rows = c.board, big = false, title = 'Scoreboard' }) {
  const note = c.final ? 'Final results' : c.frozen ? (c.phase === 'ended' ? 'Frozen: the reveal comes next' : 'Frozen: the board is as of the freeze') : '';
  return (
    <section className={`ct-board ${big ? 'big' : ''}`} aria-label={title}>
      {note && <p className={`ct-note ${c.final ? 'final' : ''}`} role="status">{note}</p>}
      {!rows.length ? (
        <p className="m">No teams yet.</p>
      ) : (
        <table>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col" title="Problems solved">Solved</th>
              <th scope="col" title="Penalty minutes">Time</th>
              {c.problems.map((p, i) => (
                <th key={p.slug} scope="col" title={p.title}>{LETTERS[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.you ? 'me' : ''}>
                <td className="ct-place">{r.place}</td>
                <th scope="row" className="ct-team">{r.name}{r.you ? ' (you)' : ''}</th>
                <td className="ct-solved">{r.solved}</td>
                <td className="ct-pen">{r.penalty}</td>
                {r.cells.map((x, i) => (
                  <td key={i}><Cell x={x} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** The projector. Same data as the console's public board; the true standings are never drawn here. */
export function ContestScreen({ c, skew }) {
  const heading = { setup: 'Forming teams', live: c.frozen ? 'Board frozen' : 'Contest live', ended: c.final ? 'Final results' : 'Contest over' }[c.phase];
  return (
    <div className="grid gap-6">
      <header className="duel-head">
        <div>
          <p className="eyebrow">team contest, {c.problems.length || '3 to 8'} problems, {c.minutes} min</p>
          <h1 className="display duel-phase">{heading}</h1>
        </div>
        <Timer c={c} skew={skew} big />
      </header>
      {c.phase === 'setup' ? (
        <p className="ses-sub">Teams of three. Any teammate can submit. Penalty counts only on problems you solve.</p>
      ) : (
        <ContestBoard c={c} big />
      )}
    </div>
  );
}

/* --------------------------------- officer --------------------------------- */

export function ContestSetup({ send, disabled, block }) {
  const [all, setAll] = useState(null);
  const [err, setErr] = useState('');
  const [diff, setDiff] = useState(0);
  const [picked, setPicked] = useState([]);
  const [minutes, setMinutes] = useState(30);
  const [freeze, setFreeze] = useState(block?.contest?.freeze ?? 10);
  const [penalty, setPenalty] = useState(block?.contest?.penalty ?? 20);

  useEffect(() => {
    api
      .get('/admin/hub/problems?status=live')
      .then((d) => setAll(d.problems))
      .catch((e) => setErr(e.message));
  }, []);

  const shown = useMemo(() => (all ?? []).filter((p) => !diff || p.difficulty === diff), [all, diff]);
  const toggle = (slug) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : p.length >= 8 ? p : [...p, slug]));
  const ok = picked.length >= 3 && picked.length <= 8;

  return (
    <section className="card grid gap-3 p-5" aria-label="Set up the contest">
      <p className="eyebrow">Contest: pick 3 to 8 problems, in the order they show as A, B, C</p>
      {err && <p className="dn text-sm">{err}</p>}
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
        <ul className="duel-pick" aria-label="Problems for the contest">
          {shown.map((p) => {
            const at = picked.indexOf(p.slug);
            return (
              <li key={p.slug}>
                <button type="button" aria-pressed={at >= 0} onClick={() => toggle(p.slug)}>
                  <span className="mono">{at >= 0 ? LETTERS[at] : ''}</span>
                  <span>{p.title}</span>
                  <span className="m">lvl {p.difficulty}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="mono grid gap-1 text-xs">
          Minutes
          <input className="field" style={{ width: '6rem' }} type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="mono grid gap-1 text-xs">
          Freeze: last minutes
          <input className="field" style={{ width: '6rem' }} type="number" min={0} max={60} value={freeze} onChange={(e) => setFreeze(e.target.value)} />
        </label>
        <label className="mono grid gap-1 text-xs">
          Penalty per wrong try
          <input className="field" style={{ width: '6rem' }} type="number" min={0} max={120} value={penalty} onChange={(e) => setPenalty(e.target.value)} />
        </label>
      </div>
      <p className="m text-xs">{picked.length} picked. Wrong tries only cost penalty on a problem the team goes on to solve.</p>
      <button
        type="button"
        className="btn btn-primary"
        style={{ padding: '0.8rem', justifyContent: 'center' }}
        disabled={!ok || disabled}
        onClick={() => send({ t: 'contest_setup', problems: picked, minutes: Number(minutes), freeze: Number(freeze), penalty: Number(penalty) })}
      >
        Open the contest lobby
      </button>
    </section>
  );
}

function MoveSelect({ person, teams, send }) {
  return (
    <select
      className="field ct-move"
      aria-label={`Move ${person.name}`}
      value=""
      onChange={(e) => {
        if (!e.target.value) return;
        send({ t: 'contest_move', uid: person.uid, to: e.target.value === 'none' ? null : e.target.value === 'new' ? 'new' : Number(e.target.value) });
      }}
    >
      <option value="">move...</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
      <option value="new">a new team</option>
      <option value="none">no team</option>
    </select>
  );
}

function Teams({ c, send }) {
  return (
    <section className="card grid gap-3 p-5" aria-label="Teams">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Teams of up to three</p>
        {c.phase === 'setup' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'contest_teams', mode: 'mixed' })} title="Spreads the highest lifetime points across teams">
              Make teams, mixed levels
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'contest_teams', mode: 'random' })}>Make teams at random</button>
          </div>
        )}
      </div>
      {c.teams.length ? (
        <ul className="ct-teams">
          {c.teams.map((t) => (
            <li key={t.id}>
              <b>{t.name}</b>
              <ul>
                {t.members.map((m) => (
                  <li key={m.uid}>
                    <span>{m.name}</span>
                    <MoveSelect person={m} teams={c.teams} send={send} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m text-sm">Everyone connected gets a team. Press again to deal new ones.</p>
      )}
      {c.unassigned.length > 0 && (
        <div>
          <p className="eyebrow">here without a team</p>
          <ul className="ct-teams">
            {c.unassigned.map((p) => (
              <li key={p.uid}>
                <span>{p.name}</span>
                <MoveSelect person={p} teams={c.teams} send={send} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The officer's console for the running contest block. */
export function ContestConsole({ c, send, skew }) {
  const next = c.teams.find((t) => t.id === c.nextReveal);
  return (
    <div className="grid gap-4">
      <section className="card grid gap-3 p-5" aria-label="Contest controls">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{c.phase === 'setup' ? 'lobby' : c.phase === 'live' ? (c.frozen ? 'live, board frozen' : 'live') : c.final ? 'final' : 'ended'}</p>
            <p className="mono d text-sm">
              {c.problems.length} problems, {c.minutes} min, freeze {c.freeze} min, penalty {c.penalty} min per wrong try
            </p>
          </div>
          <Timer c={c} skew={skew} />
        </div>
        <div className="duel-ctl">
          {c.phase === 'setup' && (
            <button type="button" className="btn btn-primary" disabled={!c.teams.length} onClick={() => send({ t: 'contest_start' })}>
              Start the contest
            </button>
          )}
          {c.phase === 'live' && (
            <button type="button" className="btn btn-ghost" onClick={() => window.confirm('End the contest now? Nobody can submit after this.') && send({ t: 'contest_end' })}>
              End now
            </button>
          )}
          {c.phase === 'ended' && c.freeze > 0 && !c.final && (
            <button type="button" className="btn btn-primary" onClick={() => send({ t: 'contest_reveal' })}>
              Reveal the next team{next ? `: ${next.name}` : ''}
            </button>
          )}
          {c.phase !== 'live' && (
            <button type="button" className="btn btn-ghost" onClick={() => window.confirm('Close the contest? The attempts already saved stay saved.') && send({ t: 'contest_close' })}>
              Close contest
            </button>
          )}
        </div>
        {c.phase === 'ended' && !c.final && c.freeze > 0 && (
          <p className="m text-sm">Teams unfreeze from the bottom of the final standings up. {c.revealed} of {c.teams.length} revealed.</p>
        )}
      </section>

      {c.phase !== 'setup' && <ContestBoard c={c} title="Projector scoreboard" />}
      {c.phase === 'live' && c.frozen && (
        <section className="card p-5" aria-label="True standings">
          <p className="eyebrow mb-2">true standings, for you only (the projector and teams do not see these)</p>
          <ContestBoard c={c} rows={c.live} title="True standings" />
        </section>
      )}
      {c.phase !== 'ended' && <Teams c={c} send={send} />}
    </div>
  );
}

/* --------------------------------- student --------------------------------- */

function Work({ c, slug, index, cell, send }) {
  const [prob, setProb] = useState(null);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const open = c.phase === 'live';

  useEffect(() => {
    warmUp();
    setProb(null);
    setLast(null);
    setErr('');
    api
      .get(`/problems/${encodeURIComponent(slug)}`)
      .then((p) => {
        setProb(p);
        setCode(p.starter || '');
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

  async function doSubmit() {
    setBusy(true);
    try {
      const res = await runCases(code, prob.cases);
      const passed = res.length > 0 && res.every((r) => r.ok);
      setLast({ passed, n: res.filter((r) => r.ok).length, of: res.length });
      // The browser judges; the room records the attempt, its time and this code for spot checks.
      send({ t: 'contest_submit', team: c.team.id, slug, passed, code });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="duel-work">
      <article className="duel-statement">
        <h3 className="display mb-2 text-xl">{LETTERS[index]}. {c.problems[index].title}</h3>
        {prob ? <Body text={prob.body} /> : !err && <Spinner label="Loading the problem" />}
      </article>
      <div className="min-w-0">
        {err && <p className="dn mb-2 text-sm">{err}</p>}
        {cell.ok ? (
          <div className="duel-done" role="status">
            <b>Your team solved it</b>
            <span>at minute {Math.floor(cell.ms / 60_000)}, {cell.wrong} wrong {cell.wrong === 1 ? 'try' : 'tries'} before</span>
          </div>
        ) : prob ? (
          <>
            <CodeRunner id={`contest-${slug}`} cases={prob.cases} value={code} onChange={setCode} runLabel="Run tests" playground={false} />
            <button type="button" className="btn btn-primary duel-submit" disabled={busy || !code.trim() || !open} onClick={doSubmit}>
              {busy ? 'Judging...' : open ? 'Submit for the team' : 'The contest is over'}
            </button>
            <p className="m mono mt-1 text-xs">Run tests as often as you like. Each submit is a try, and a wrong one costs penalty only if your team solves this later.</p>
            {last && !last.passed && (
              <p className="dn mono mt-2 text-sm" role="status">
                Not yet: {last.n} of {last.of} tests passed.
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ContestPlay({ c, send, skew }) {
  const [pick, setPick] = useState(0);
  if (!c.team) {
    return (
      <div className="card p-6 text-center" role="status">
        <p className="display text-2xl font-bold">Waiting for a team</p>
        <p className="d mt-2 text-sm">An officer is forming teams of three. Keep this page open.</p>
      </div>
    );
  }
  const t = c.team;
  const mates = t.mates.length ? `with ${t.mates.join(' and ')}` : 'on your own';
  if (c.phase === 'setup') {
    return (
      <div className="card p-6" role="status">
        <p className="eyebrow">your team</p>
        <p className="display text-3xl font-extrabold g">{t.name}</p>
        <p className="d mt-1">You are {mates}. The contest starts when the officer presses start.</p>
      </div>
    );
  }
  const idx = Math.min(pick, c.problems.length - 1);
  const cells = t.row.cells;
  return (
    <div className="grid gap-4">
      <section className="card ct-me p-4" aria-label="Your team">
        <div>
          <p className="eyebrow">{t.name}, {mates}</p>
          <p className="mono" role="status">
            <b className="g">{t.row.solved} solved</b>, {t.row.penalty} min penalty, live place {t.row.place}
            {c.frozen && c.phase === 'live' ? ' (the board others see is frozen)' : ''}
          </p>
        </div>
        <Timer c={c} skew={skew} />
      </section>

      <div className="chips" role="group" aria-label="Problems">
        {c.problems.map((p, i) => (
          <button key={p.slug} type="button" aria-pressed={idx === i} onClick={() => setPick(i)} title={p.title}>
            {LETTERS[i]} {cells[i].ok ? '+' : cells[i].wrong ? `-${cells[i].wrong}` : ''}
          </button>
        ))}
      </div>

      <Work key={c.problems[idx].slug} c={c} slug={c.problems[idx].slug} index={idx} cell={cells[idx]} send={send} />

      <ContestBoard c={c} />
      {c.phase === 'ended' && <p className="m mono text-sm">The contest is over. Watch the screen for the reveal.</p>}
    </div>
  );
}
