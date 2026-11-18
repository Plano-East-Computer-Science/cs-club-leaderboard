/**
 * Quant sandbox (C14): a game on made-up prices. Pure and seeded, so the
 * server can re-create any round's series from its seed and score a member's
 * decisions itself, and the browser sandbox scores a strategy the same way.
 *
 * Prices are synthetic on purpose: geometric Brownian motion through a few
 * regimes (calm, trend, crash, recovery) under invented "SIM-" tickers. No real
 * market data, no real companies, nothing that reads as advice.
 */

export const HISTORY = 30; // days shown before the first decision
export const START_BALANCE = 10_000; // game dollars, display only (the math runs on 1.0)
export const COST = 0.001; // fee per unit of position changed, so flipping every step is not free
export const DD_PENALTY = 4; // score points lost per 100% drawdown (a 10% drop costs 0.4)
export const MIN_ACTIVE = 0.25; // share of steps that must hold a position to be ranked
export const SHORT_CAPS = [0, 0.25, 0.5];

/** Daily drift and volatility per regime. */
export const REGIMES = {
  calm: { mu: 0.0004, sigma: 0.008, len: [12, 25] },
  trend: { mu: 0.0025, sigma: 0.012, len: [10, 20] },
  crash: { mu: -0.03, sigma: 0.04, len: [6, 10] },
  recovery: { mu: 0.004, sigma: 0.02, len: [10, 20] },
};

/** Fixed regime plans for the sandbox; `mixed` draws its plan from the seed. */
export const SCENARIOS = {
  mixed: { label: 'Mixed (from the seed)', plan: null },
  crash: { label: 'Calm, then a crash', plan: [['calm', 38], ['crash', 10], ['recovery', 22], ['calm', 30]] },
  calm: { label: 'Calm all the way', plan: [['calm', 200]] },
};

export const MAX_SEED = 2 ** 52;

/**
 * sfc32, seeded from up to 52 bits. A 32-bit seed could be brute-forced from
 * the history days an open round shows, which would reveal the future prices.
 */
export function rng(seed) {
  let a = seed >>> 0;
  let b = Math.floor(seed / 4294967296) >>> 0;
  let c = 0x9e3779b9;
  let d = 1;
  const next = () => {
    d = (d + 1) | 0;
    const t = (((a + b) | 0) + d) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next(); // mix the seed through the state first
  return next;
}

/** A fresh round seed (server) or sandbox seed (browser). */
export const randomSeed = () => {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2));
  return (hi & 0xfffff) * 4294967296 + lo;
};

const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

/** -> { ticker, prices: number[] (cents), regimes: string[] } of length `days`. */
export function makeSeries(seed, { days = 90, plan = null } = {}) {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const ticker = 'SIM-' + Array.from({ length: 3 }, () => LETTERS[int(0, LETTERS.length - 1)]).join('');

  const regimes = [];
  if (plan) {
    for (const [name, n] of plan) for (let i = 0; i < n && regimes.length < days; i++) regimes.push(name);
    while (regimes.length < days) regimes.push(plan[plan.length - 1][0]);
  } else {
    let prev = null;
    while (regimes.length < days) {
      // A crash is always followed by a recovery; otherwise any regime but a repeat.
      const options = prev === 'crash' ? ['recovery'] : Object.keys(REGIMES).filter((x) => x !== prev);
      const name = options[int(0, options.length - 1)];
      const [lo, hi] = REGIMES[name].len;
      for (let i = int(lo, hi); i > 0 && regimes.length < days; i--) regimes.push(name);
      prev = name;
    }
  }

  const prices = [];
  let p = int(40, 160);
  for (let t = 0; t < days; t++) {
    if (t > 0) {
      const { mu, sigma } = REGIMES[regimes[t]];
      const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
      p *= Math.exp(mu - (sigma * sigma) / 2 + sigma * z);
    }
    p = Math.max(1, Math.round(p * 100) / 100);
    prices.push(p);
  }
  return { ticker, prices, regimes };
}

/** Round settings -> derived counts. `days` must be a multiple of `step`. */
export const stepsOf = (round) => round.days / round.step;

/** Prices a player may see after `decided` decisions (the future stays hidden). */
export const visibleDays = (round, decided) => Math.min(HISTORY + round.days, HISTORY + decided * round.step);

/** A position is a number from -shortCap (short) to 1 (all in), to two places. */
export function cleanPosition(v, shortCap) {
  const n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n) || n > 1 || n < -shortCap) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Equity (starting at 1.0) through the decided part of the round. Decision k
 * is made at the close of day HISTORY-1+k*step, seeing only prices up to then,
 * and is held for the next `step` days. Changing position costs COST per unit.
 */
export function equityCurve(prices, decisions, { step, cost = COST, history = HISTORY }) {
  const eq = [1];
  let held = 0;
  decisions.forEach((pos, k) => {
    for (let i = 0; i < step; i++) {
      const t = history - 1 + k * step + i;
      if (t + 1 >= prices.length) return;
      const r = prices[t + 1] / prices[t] - 1;
      const fee = i === 0 ? cost * Math.abs(pos - held) : 0;
      eq.push(eq[eq.length - 1] * (1 + pos * r - fee));
    }
    held = pos;
  });
  return eq;
}

const round6 = (x) => Math.round(x * 1e6) / 1e6;

/**
 * Score for an equity curve: a Sharpe-like ratio (average daily change divided
 * by its spread, times the square root of the number of days) minus
 * DD_PENALTY times the largest drop from a high. Ranked only if the player held
 * a position on at least MIN_ACTIVE of the steps, so sitting out does not win.
 */
export function scoreCurve(eq, decisions) {
  const rets = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const n = rets.length;
  const mean = n ? rets.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
  const sharpe = sd > 1e-12 ? (mean / sd) * Math.sqrt(n) : 0;
  let peak = eq[0];
  let maxDrawdown = 0;
  for (const v of eq) {
    peak = Math.max(peak, v);
    maxDrawdown = Math.max(maxDrawdown, 1 - v / peak);
  }
  const active = decisions.filter((p) => p !== 0).length;
  const ranked = decisions.length > 0 && active >= Math.ceil(MIN_ACTIVE * decisions.length);
  return {
    score: round6(sharpe - DD_PENALTY * maxDrawdown),
    sharpe: round6(sharpe),
    maxDrawdown: round6(maxDrawdown),
    totalReturn: round6(eq[eq.length - 1] - 1),
    active,
    ranked,
  };
}

/** The server's whole check: series from the seed, curve from the decisions, score. */
export function scoreRound(round, decisions, plan = null) {
  const { prices } = makeSeries(round.seed, { days: HISTORY + round.days, plan });
  const eq = equityCurve(prices, decisions, round);
  return { equity: eq, ...scoreCurve(eq, decisions) };
}
