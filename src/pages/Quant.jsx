/**
 * /arena/quant (C14): a trading game on made-up prices, and a backtest sandbox.
 * Simulated only. The prices come from a seeded random generator
 * (shared/quant.js), the tickers are invented, and no real money is involved.
 *
 * Rounds are played against the server: you pick a position, then it shows the
 * next few days and scores you from the seed. The sandbox runs a Python
 * strategy in your browser (the C12 notebook kernel) and is never sent anywhere.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { createKernel } from '../lib/datarunner.js';
import { useCodeKeys } from '../lib/codeKeys.js';
import { PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import {
  HISTORY, START_BALANCE, COST, DD_PENALTY, MIN_ACTIVE, SCENARIOS, makeSeries, equityCurve, scoreCurve, randomSeed,
} from '../../shared/quant.js';

const SANDBOX = { days: 60, step: 5, shortCap: 0.5 }; // same shape as the weekly round, so scores compare
const money = (eq) => `${Math.round(START_BALANCE * eq).toLocaleString()}`;
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const posLabel = (p) => (p === 0 ? 'out' : p === 1 ? 'all in' : p === 0.5 ? 'half in' : p > 0 ? `${Math.round(p * 100)}% in` : `short ${Math.round(-p * 100)}%`);

const STARTER = `def strategy(prices):
    # prices: a pandas Series of closing prices, oldest first, up to today.
    # Return a position for the next 5 days:
    #   1 = all in, 0.5 = half in, 0 = out, -0.5 = short half (the limit).
    fast = prices.tail(5).mean()
    slow = prices.tail(20).mean()
    return 1 if fast > slow else 0
`;

/** A plain line chart. `total` fixes the x range so the unseen future shows as empty space. */
function Chart({ values, total, color, label, split, fmt = (v) => v.toFixed(2) }) {
  const W = 600;
  const H = 150;
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i) => (i / Math.max(1, total - 1)) * W;
  const y = (v) => H - 6 - ((v - lo) / span) * (H - 12);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="qt-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}: from ${fmt(values[0])} to ${fmt(values[values.length - 1])}, low ${fmt(lo)}, high ${fmt(hi)}`}>
        {split != null && <line x1={x(split)} x2={x(split)} y1="0" y2={H} className="qt-split" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption><span>{label}</span><span>low {fmt(lo)} / high {fmt(hi)}</span></figcaption>
    </figure>
  );
}

function ScoreBox({ s }) {
  return (
    <dl className="qt-score">
      <div><dt>score</dt><dd className="g">{s.ranked ? s.score.toFixed(2) : 'not ranked'}</dd></div>
      <div><dt>steadiness</dt><dd>{s.sharpe.toFixed(2)}</dd></div>
      <div><dt>biggest drop</dt><dd className="dn">{(s.maxDrawdown * 100).toFixed(1)}%</dd></div>
      <div><dt>balance change</dt><dd className={s.totalReturn >= 0 ? 'up' : 'dn'}>{pct(s.totalReturn)}</dd></div>
    </dl>
  );
}

function HowScored() {
  return (
    <div className="pn sp rv">
      <div className="pane-h"><span><b>how_scoring_works.md</b></span><span>game rules</span></div>
      <div className="pn-b qt-rules">
        <p>Everyone starts with {START_BALANCE.toLocaleString()} game dollars. At each step you choose how much of it follows the price for the next few days: all in, half in, out, or in some rounds a small short (you gain when the price falls).</p>
        <ul className="ul">
          <li><b>Steadiness</b>: your average daily gain divided by how much your balance swings from day to day, scaled by the length of the round. A lucky jump followed by a fall scores low.</li>
          <li><b>Biggest drop</b>: the largest fall of your balance from its highest point. Every 10% drop costs {(DD_PENALTY / 10).toFixed(1)} points.</li>
          <li><b>Score</b> = steadiness minus {DD_PENALTY} times the biggest drop. Going all in and hoping usually loses to a careful plan.</li>
          <li>You need a position on at least {MIN_ACTIVE * 100}% of the steps to be ranked, so sitting out the whole round does not win.</li>
          <li>Changing your position costs {COST * 100}% of the amount moved.</li>
        </ul>
        <p className="ar-note">The server works out every score itself from the round's seed and your choices. Rounds give no club points.</p>
      </div>
    </div>
  );
}

function Leaderboard({ board }) {
  if (!board.rows.length) return <p className="d">Nobody has finished this round yet.</p>;
  return (
    <>
      <table className="dt-board">
        <thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Score</th><th scope="col">Change</th><th scope="col">Drop</th></tr></thead>
        <tbody>
          {board.rows.map((r) => (
            <tr key={r.rank} className={r.mine ? 'me' : undefined}>
              <td>{r.rank}</td><td>{r.name}{r.mine ? ' (you)' : ''}</td><td>{r.score.toFixed(2)}</td><td>{pct(r.totalReturn)}</td><td>{(r.maxDrawdown * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {board.unranked > 0 && <p className="ar-note">{board.unranked} more finished without enough steps in the market to be ranked.</p>}
    </>
  );
}

function Round({ id, onSeed, onChange }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get(`/quant/rounds/${id}`).then(setR).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error && !r) return <p className="dn" role="alert">{error} <button type="button" className="linkb" onClick={load}>Try again</button></p>;
  if (!r) return <p className="d">loading the round...</p>;

  const total = r.history + r.days;
  const decided = r.mine?.decisions.length ?? 0;
  const done = decided >= r.steps;
  const open = r.status === 'open';
  const choices = [...(r.shortCap ? [-r.shortCap] : []), 0, 0.5, 1];
  const equity = r.mine?.equity ?? [1];

  const decide = async () => {
    setBusy(true);
    setError('');
    try {
      setR(await api.post(`/quant/rounds/${id}/decide`, { step: decided, position: pick }));
      setPick(null);
      onChange?.();
    } catch (e) {
      setError(e.message);
      if (e.status === 409) load();
    }
    setBusy(false);
  };

  return (
    <div className="qt-round">
      <p className="dt-meta">
        <span className="g">{r.ticker}</span>
        <span>simulated prices</span>
        <span>{r.steps} steps of {r.step} days</span>
        <span>{r.shortCap ? `short up to ${r.shortCap * 100}%` : 'no shorting'}</span>
        <span>{open ? `ends ${new Date(r.closesAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'ended'}</span>
      </p>
      <Chart values={r.prices} total={total} split={r.history - 1} color="var(--gold)" label={`${r.ticker} price (made up), first ${r.history} days are history`} />
      {r.mine && decided > 0 && (
        <Chart values={equity} total={r.days + 1} color="var(--up)" label="Your balance in game dollars" fmt={(v) => money(v)} />
      )}

      {!r.signedIn ? (
        open && <p className="d"><Link className="uline g" to="/signin">Sign in</Link> to play this round.</p>
      ) : done ? (
        <>
          <p className="up" role="status">You finished with {money(equity[equity.length - 1])} game dollars.</p>
          {r.mine.result && <ScoreBox s={r.mine.result} />}
          {r.mine.result && !r.mine.result.ranked && <p className="ar-note">Not ranked: you held a position on fewer than {MIN_ACTIVE * 100}% of the steps.</p>}
        </>
      ) : open ? (
        <fieldset className="qt-decide">
          <legend>
            Step {decided + 1} of {r.steps}. Balance {money(equity[equity.length - 1])} game dollars. What do you hold for the next {r.step} days?
          </legend>
          <div className="chips" role="group" aria-label="Position">
            {choices.map((p) => (
              <button key={p} type="button" aria-pressed={pick === p} onClick={() => setPick(p)}>{posLabel(p)}</button>
            ))}
          </div>
          <button type="button" className="btn pri" disabled={pick === null || busy} onClick={decide}>
            {busy ? 'Locking in...' : `Lock in and show ${r.step} more days`}
          </button>
          {decided > 0 && <p className="ar-note">So far: {r.mine.decisions.map(posLabel).join(', ')}.</p>}
        </fieldset>
      ) : (
        <p className="d">This round has ended.</p>
      )}
      {error && <p className="dn" role="alert">{error}</p>}

      {!open && r.seed != null && (
        <p className="ar-note">
          Seed {r.seed}. Anyone can re-create these prices from it and check every score.{' '}
          <button type="button" className="linkb" onClick={() => onSeed(r.seed)}>Try this seed in the sandbox</button>
        </p>
      )}
      <h3 className="qt-h">Club leaderboard</h3>
      <Leaderboard board={r.leaderboard} />
    </div>
  );
}

function Sandbox({ box, setBox }) {
  const { seed, scenario } = box;
  const setSeed = (s) => setBox((b) => ({ ...b, seed: s }));
  const setScenario = (s) => setBox((b) => ({ ...b, scenario: s }));
  const [code, setCode] = useState(STARTER);
  const [state, setState] = useState('idle'); // idle | loading | running | failed
  const [status, setStatus] = useState('');
  const [out, setOut] = useState(null);
  const kernel = useRef(null);
  useEffect(() => () => kernel.current?.dispose(), []);

  const run = async () => {
    setState(kernel.current ? 'running' : 'loading');
    setStatus(kernel.current ? '' : 'Starting Python...');
    const { prices, ticker } = makeSeries(seed, { days: HISTORY + SANDBOX.days, plan: SCENARIOS[scenario].plan });
    // The strategy sees prices only up to each decision day: no peeking ahead.
    const harness = `
import json as _json
_prices = pd.Series(${JSON.stringify(prices)}, name='price')
_out = []
for _t in range(${HISTORY - 1}, ${HISTORY - 1 + SANDBOX.days}, ${SANDBOX.step}):
    _v = strategy(_prices.iloc[:_t + 1].copy())
    try:
        _out.append(float(_v))
    except (TypeError, ValueError):
        raise TypeError(f'strategy() must return a number, it returned {_v!r}')
print('__POSITIONS__' + _json.dumps(_out))
`;
    try {
      kernel.current ??= createKernel({}, { onStatus: setStatus });
      await kernel.current.ready();
      setState('running');
      setStatus('');
      const res = await kernel.current.run(`${code}\n${harness}`, 30_000);
      const lines = res.stdout.split('\n');
      const mark = lines.find((l) => l.startsWith('__POSITIONS__'));
      const printed = lines.filter((l) => !l.startsWith('__POSITIONS__')).join('\n').trim();
      if (!mark) {
        setOut({ error: res.stderr || 'The strategy did not finish. Check that you defined strategy(prices).', printed });
      } else {
        const raw = JSON.parse(mark.slice('__POSITIONS__'.length));
        const decisions = raw.map((p) => Math.round(Math.min(1, Math.max(-SANDBOX.shortCap, p)) * 100) / 100);
        const equity = equityCurve(prices, decisions, SANDBOX);
        setOut({ prices, ticker, decisions, equity, score: scoreCurve(equity, decisions), clamped: raw.some((p, i) => p !== decisions[i]), printed });
      }
      setState('idle');
    } catch (e) {
      setStatus(e.message);
      setState('failed');
    }
  };

  const keys = useCodeKeys(code, setCode, () => state === 'idle' && run());

  return (
    <div className="pn sp rv">
      <div className="pane-h"><span><b>backtest.py</b></span><span>runs in your browser, never scored</span></div>
      <div className="pn-b">
        <p className="d">Write a strategy in Python and replay it on a made-up price series. It gets the same score as a round. Nothing here is saved or sent to the server.</p>
        <div className="qt-controls">
          <div>
            <label className="eyebrow" htmlFor="qt-scn" style={{ display: 'block' }}>Market</label>
            <select id="qt-scn" className="field" value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {Object.entries(SCENARIOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="eyebrow" htmlFor="qt-seed" style={{ display: 'block' }}>Seed</label>
            <input id="qt-seed" className="field" inputMode="numeric" value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '').slice(0, 15)) || 0)} />
          </div>
          <button type="button" className="btn" onClick={() => setSeed(randomSeed())}>New seed</button>
        </div>
        <label className="eyebrow" htmlFor="qt-code" style={{ display: 'block', marginTop: 14 }}>strategy.py</label>
        <textarea
          id="qt-code"
          className="mono dt-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          {...keys}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={Math.min(18, Math.max(8, code.split('\n').length + 1))}
        />
        <div className="ar-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn pri" disabled={state === 'loading' || state === 'running'} onClick={run}>
            {state === 'loading' ? 'Starting...' : state === 'running' ? 'Running...' : 'Run backtest'}
          </button>
          <span className="d" style={{ fontSize: 12 }}>Ctrl+Enter runs. The first run downloads pandas (about 20 MB).</span>
          {status && <span role="status" className={state === 'failed' ? 'dn' : 'd'}>{status}</span>}
        </div>
        {out && (
          <div className="dt-out" aria-live="polite">
            {out.printed && <pre>{out.printed}</pre>}
            {out.error ? (
              <pre className="dn">{out.error}</pre>
            ) : (
              <>
                <Chart values={out.prices} total={out.prices.length} split={HISTORY - 1} color="var(--gold)" label={`${out.ticker} price (made up)`} />
                <Chart values={out.equity} total={out.equity.length} color="var(--up)" label="Strategy balance in game dollars" fmt={(v) => money(v)} />
                <ScoreBox s={out.score} />
                <p className="ar-note">
                  Positions: {out.decisions.map(posLabel).join(', ')}.
                  {out.clamped && ' Some values were outside -0.5 to 1 and were clipped.'}
                  {!out.score.ranked && ` In a round this would not be ranked: hold a position on at least ${MIN_ACTIVE * 100}% of the steps.`}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Quant() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [box, setBox] = useState(() => ({ seed: randomSeed(), scenario: 'mixed' }));
  useReveal();

  const load = useCallback(() => {
    setError('');
    api.get('/quant/rounds').then((x) => {
      setD(x);
      setSel((s) => s ?? x.rounds.find((r) => r.status === 'open')?.id ?? x.rounds[0]?.id ?? null);
    }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="state-note bad">{error} <button className="btn" onClick={load}>Try again</button></div>;
  if (!d) return <div className="state-note">loading the game...</div>;
  const open = d.rounds.filter((r) => r.status === 'open');
  const current = d.rounds.find((r) => r.id === sel);

  return (
    <>
      <PageHead
        eyebrow="arena / quant"
        title="Quant game"
        lead="A simulated trading game on made-up prices. Pick how much to hold, watch the next days play out, and get scored on steady gains rather than lucky bets."
        kv={
          <div className="kv two2">
            <div><span>open rounds</span><strong>{open.length}</strong></div>
            <div><span>players this round</span><strong>{current?.players ?? 0}</strong></div>
          </div>
        }
      />
      <section className="sec">
        <div className="wrap">
          <p className="qt-banner" role="note">
            <b>This is a game.</b> Prices are synthetic (made up by a random generator), tickers are invented, no real money is involved, and nothing here is investment advice.
          </p>
          <p className="ar-note" style={{ marginBottom: 14 }}><Link className="uline" to="/arena">Back to the board</Link></p>
          <div className="dt-grid">
            <div className="dt-main">
              <div className="pn sp rv">
                <div className="pane-h"><span><b>round</b></span><span>{current ? current.title : 'none'}</span></div>
                <div className="pn-b">
                  {d.rounds.length > 1 && (
                    <div className="qt-rounds">
                      <label className="eyebrow" htmlFor="qt-round">Round</label>
                      <select id="qt-round" className="field" value={sel ?? ''} onChange={(e) => setSel(Number(e.target.value))}>
                        {d.rounds.map((r) => (
                          <option key={r.id} value={r.id}>{r.title} ({r.status === 'open' ? `open, ${r.decided}/${r.steps} decided` : 'ended'})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {sel ? <Round key={sel} id={sel} onSeed={(seed) => { setBox({ seed, scenario: 'mixed' }); document.getElementById('qt-code')?.scrollIntoView({ block: 'center' }); }} onChange={load} /> : <p className="d">No rounds yet.</p>}
                </div>
              </div>
              <Sandbox box={box} setBox={setBox} />
            </div>
            <aside className="dt-side">
              <HowScored />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
