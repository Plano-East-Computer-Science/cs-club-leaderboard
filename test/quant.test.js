/**
 * Quant sandbox (C14): the seeded price generator, the scoring math on
 * hand-checked examples, that going all in loses to a steady strategy through
 * a crash, and the routes against the fake D1 (the server scores from the
 * seed and ignores anything a browser reports, the seed stays hidden while a
 * round is open, no ledger rows, officer-only round control, export, purge).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { ensureWeekly } from '../worker/hub/quant.js';
import {
  HISTORY, SCENARIOS, makeSeries, equityCurve, scoreCurve, scoreRound, cleanPosition, visibleDays,
} from '../shared/quant.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

/* ------------------------------ generator ------------------------------ */

const a = makeSeries(12345, { days: 90 });
assert.deepEqual(makeSeries(12345, { days: 90 }), a, 'same seed, same series');
assert.equal(a.prices.length, 90);
assert.equal(a.regimes.length, 90);
assert.match(a.ticker, /^SIM-[A-Z]{3}$/, 'made-up ticker, marked synthetic');
assert.ok(a.prices.every((p) => p >= 1 && Math.abs(p * 100 - Math.round(p * 100)) < 1e-6), 'prices are in cents, never below 1');
assert.notDeepEqual(makeSeries(12346, { days: 90 }).prices, a.prices, 'another seed, another series');
assert.notDeepEqual(makeSeries(1 + 2 ** 40, { days: 90 }).prices, makeSeries(1, { days: 90 }).prices, 'the high bits of the seed matter');
const crashSeries = makeSeries(7, { days: 90, plan: SCENARIOS.crash.plan });
assert.equal(crashSeries.regimes[40], 'crash');
assert.ok(new Set(makeSeries(99, { days: 300 }).regimes).size >= 3, 'a mixed series moves through several regimes');

/* ------------------------------ scoring by hand ------------------------------ */

// Prices 100 -> 110 -> 99 -> 99 -> 108.9, one day of history, one day per step, no fee.
// Daily changes held: +10%, -10%, 0 (out), +10%.
{
  const prices = [100, 110, 99, 99, 108.9];
  const eq = equityCurve(prices, [1, 1, 0, 1], { step: 1, history: 1, cost: 0 });
  [1, 1.1, 0.99, 0.99, 1.089].forEach((v, i) => near(eq[i], v, `equity day ${i}`));
  const s = scoreCurve(eq, [1, 1, 0, 1]);
  // mean 0.025, population sd sqrt(0.006875) = 0.0829156, times sqrt(4) = 0.603023
  near(s.sharpe, 0.603023, 'sharpe');
  near(s.maxDrawdown, 0.1, 'drawdown from 1.1 to 0.99');
  near(s.score, 0.603023 - 0.4, 'score = sharpe - 4 x drawdown');
  near(s.totalReturn, 0.089, 'total return');
  assert.equal(s.active, 3);
  assert.equal(s.ranked, true);
}
// The fee is charged once, on the day the position changes.
{
  const eq = equityCurve([100, 110, 121], [0.5], { step: 2, history: 1, cost: 0.001 });
  near(eq[1], 1.0495, 'half in: +5% minus 0.0005 fee');
  near(eq[2], 1.0495 * 1.05, 'no fee while holding');
}
// A short gains when the price falls.
near(equityCurve([100, 90], [-0.5], { step: 1, history: 1, cost: 0 })[1], 1.05, 'short half through a 10% drop');
// Sitting out scores zero and is not ranked: doing nothing cannot win.
{
  const s = scoreCurve(equityCurve([100, 50, 25], [0, 0], { step: 1, history: 1, cost: 0 }), [0, 0]);
  assert.deepEqual([s.score, s.sharpe, s.maxDrawdown, s.ranked], [0, 0, 0, false]);
  assert.equal(scoreCurve([1, 1.1, 1.2, 1.3], [1, 0, 0, 0]).ranked, true, 'one step in four is enough');
  assert.equal(scoreCurve([1, 1.1, 1.2, 1.3, 1.4, 1.5], [1, 0, 0, 0, 0]).ranked, false, 'one in five is not');
}
assert.equal(cleanPosition(1, 0), 1);
assert.equal(cleanPosition(0.333, 0), 0.33);
assert.equal(cleanPosition(-0.5, 0.5), -0.5);
for (const [v, cap] of [[1.5, 0], [-0.25, 0], [-0.75, 0.5], ['1', 0], [NaN, 0], [null, 0], [undefined, 0.5]]) {
  assert.equal(cleanPosition(v, cap), null, `rejects ${v} with cap ${cap}`);
}
assert.equal(visibleDays({ days: 60, step: 5 }, 0), HISTORY);
assert.equal(visibleDays({ days: 60, step: 5 }, 12), HISTORY + 60);

/* ------------------------------ gambling loses ------------------------------ */

// Through a crash, all in every step scores worse than a steady trend-follower
// that holds half when the price is above its 10-day average.
{
  let worse = 0;
  let sumAll = 0;
  let sumSteady = 0;
  const N = 60;
  for (let seed = 1; seed <= N; seed++) {
    const round = { seed, days: 60, step: 5 };
    const { prices } = makeSeries(seed, { days: HISTORY + 60, plan: SCENARIOS.crash.plan });
    const steady = Array.from({ length: 12 }, (_, k) => {
      const t = HISTORY - 1 + k * 5;
      const avg = prices.slice(t - 9, t + 1).reduce((x, y) => x + y, 0) / 10;
      return prices[t] > avg ? 0.5 : 0;
    });
    const all = scoreRound(round, Array(12).fill(1), SCENARIOS.crash.plan);
    const st = scoreRound(round, steady, SCENARIOS.crash.plan);
    if (all.score < st.score) worse++;
    sumAll += all.score;
    sumSteady += st.score;
  }
  assert.ok(worse >= N * 0.8, `all in loses in ${worse} of ${N} crash rounds`);
  assert.ok(sumAll / N < sumSteady / N - 1, 'and by a wide margin on average');
}

/* ------------------------------------ routes ------------------------------------ */

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const addUser = async (name, role = 'member') =>
  (await db.prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?)').bind(`${name.split(' ')[0].toLowerCase()}@example.com`, name, role).run()).meta.last_row_id;
const cookie = async (id) => `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}`;

async function call(path, { as, method = 'GET', body } = {}) {
  const headers = {};
  if (as) headers.Cookie = as;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} });
  const text = await res.text();
  return { status: res.status, text, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

const officerId = await addUser('Olive Park', 'officer');
const ana = await addUser('Ana Lopez');
const ben = await addUser('Ben Kim');
const [O, A, B] = [await cookie(officerId), await cookie(ana), await cookie(ben)];
const ledgerRows = async () => (await db.prepare('SELECT (SELECT COUNT(*) FROM activity) + (SELECT COUNT(*) FROM point_events) AS n').first()).n;
const before = await ledgerRows();

// The first visit opens the weekly default round.
let r = await call('/quant/rounds');
assert.equal(r.status, 200);
assert.equal(r.body.rounds.length, 1);
const weekly = r.body.rounds[0];
assert.equal(weekly.status, 'open');
assert.equal(weekly.steps, 12);
assert.equal((await call('/quant/rounds')).body.rounds.length, 1, 'only one weekly round');
const seed = (await db.prepare('SELECT seed FROM quant_rounds WHERE id = ?').bind(weekly.id).first()).seed;
const wround = { seed, days: 60, step: 5 };
const series = makeSeries(seed, { days: HISTORY + 60 });

// Signed out: only the history days, no seed, no play.
r = await call(`/quant/rounds/${weekly.id}`);
assert.deepEqual(r.body.prices, series.prices.slice(0, HISTORY));
assert.equal(r.body.seed, null);
assert.equal(r.body.mine, null);
assert.equal((await call(`/quant/rounds/${weekly.id}/decide`, { method: 'POST', body: { step: 0, position: 1 } })).status, 401);
assert.equal((await call('/quant/rounds/999')).status, 404);

// Decisions are validated, in order, and reveal the next step only after deciding.
const decide = (as, id, step, position, extra = {}) => call(`/quant/rounds/${id}/decide`, { method: 'POST', as, body: { step, position, ...extra } });
assert.equal((await decide(A, weekly.id, 0, 2)).status, 400, 'more than all in');
assert.equal((await decide(A, weekly.id, 0, -0.5)).status, 400, 'no shorting in this round');
assert.equal((await decide(A, weekly.id, 0, '1')).status, 400, 'a number, not a string');
assert.equal((await decide(A, weekly.id, 1, 1)).status, 409, 'cannot skip ahead');
// A browser that reports its own balance, return or score is ignored.
const lies = { equity: [1, 1000], totalReturn: 999, score: 1e9, finalBalance: 1e12 };
r = await decide(A, weekly.id, 0, 1, lies);
assert.equal(r.status, 200);
assert.deepEqual(r.body.prices, series.prices.slice(0, HISTORY + 5));
assert.deepEqual(r.body.mine.equity, equityCurve(series.prices, [1], wround));
assert.equal((await decide(A, weekly.id, 0, 0)).status, 409, 'a decision cannot be changed after its prices are seen');
assert.ok(!r.text.includes(String(seed)), 'the seed stays hidden while the round is open');

const anaPlan = [1, 1, 0.5, 0, 0, 0.5, 1, 1, 0.5, 0, 1, 0.5];
for (let k = 1; k < 12; k++) {
  r = await decide(A, weekly.id, k, anaPlan[k], lies);
  assert.equal(r.status, 200);
}
const expected = scoreRound(wround, anaPlan);
assert.equal(r.body.mine.result.score, expected.score, 'the score is the server recomputing from the seed');
assert.equal(r.body.prices.length, HISTORY + 60, 'a finished player sees the whole round');
const row = await db.prepare('SELECT * FROM quant_entries WHERE user_id = ?').bind(ana).first();
assert.deepEqual(JSON.parse(row.positions), anaPlan);
assert.deepEqual([row.score, row.total_return, row.max_drawdown, row.ranked], [expected.score, expected.totalReturn, expected.maxDrawdown, 1]);
assert.ok(!/1e\+?9|999/.test(JSON.stringify(row)), 'nothing reported by the browser was stored');
assert.equal((await decide(A, weekly.id, 12, 1)).status, 409, 'finished');

// Ben sits out: finished but unranked.
for (let k = 0; k < 12; k++) await decide(B, weekly.id, k, 0);
r = await call(`/quant/rounds/${weekly.id}`, { as: B });
assert.equal(r.body.mine.result.ranked, false);
assert.deepEqual(r.body.leaderboard.rows.map((x) => [x.rank, x.name]), [[1, 'Ana']]);
assert.equal(r.body.leaderboard.unranked, 1);
assert.ok(!/Lopez|Kim|@example|user_id/.test(r.text), 'first names only');

// The game is not a points source.
assert.equal(await ledgerRows(), before, 'no activity or point_events rows');

// Officer-only round control.
const newRound = { title: 'Crash course', days: 20, step: 5, shortCap: 0.5, closesInDays: 3, seed: 42 };
assert.equal((await call('/admin/hub/quant/rounds', { method: 'POST', body: newRound })).status, 401, 'anonymous');
assert.equal((await call('/admin/hub/quant/rounds', { method: 'POST', body: newRound, as: A })).status, 401, 'member');
assert.equal((await call('/admin/hub/quant/rounds', { as: A })).status, 401, 'member cannot list');
assert.equal((await call(`/admin/hub/quant/rounds/${weekly.id}/close`, { method: 'POST', as: A })).status, 401, 'member cannot close');
for (const bad of [{ days: 21 }, { step: 0 }, { shortCap: 0.3 }, { title: '' }, { seed: -1 }, { seed: 1.5 }, { closesInDays: 0 }]) {
  assert.equal((await call('/admin/hub/quant/rounds', { method: 'POST', body: { ...newRound, ...bad }, as: O })).status, 400, JSON.stringify(bad));
}
r = await call('/admin/hub/quant/rounds', { method: 'POST', body: newRound, as: O });
assert.equal(r.status, 201);
const rid = r.body.id;
r = await call('/admin/hub/quant/rounds', { as: O });
assert.equal(r.body.rounds.find((x) => x.id === rid).seed, null, 'officers do not see an open seed either');
assert.equal((await decide(A, rid, 0, -0.5)).status, 200, 'shorting allowed up to the cap');
assert.equal((await decide(A, rid, 1, -0.75)).status, 400, 'but not past it');

assert.equal((await call(`/admin/hub/quant/rounds/${rid}/close`, { method: 'POST', as: O })).status, 200);
assert.equal((await call('/admin/hub/quant/rounds/999/close', { method: 'POST', as: O })).status, 404);
assert.equal((await decide(A, rid, 1, 0)).status, 409, 'closed rounds take no decisions');
r = await call(`/quant/rounds/${rid}`);
assert.equal(r.body.status, 'closed');
assert.equal(r.body.seed, 42, 'the seed is revealed after closing');
assert.deepEqual(r.body.prices, makeSeries(42, { days: HISTORY + 20 }).prices);
assert.equal(r.body.regimes.length, HISTORY + 20);

// The weekly default: one per week, and only when nothing is open.
const later = Date.now() + 30 * 86_400_000;
const count = async () => (await db.prepare('SELECT COUNT(*) AS n FROM quant_rounds').first()).n;
const n0 = await count();
await ensureWeekly(db, later);
await ensureWeekly(db, later);
assert.equal(await count(), n0 + 1, 'one new round for a later week');
await ensureWeekly(db, Date.now());
assert.equal(await count(), n0 + 1, 'nothing new while a round is open');

// Export and purge.
r = await call('/me/export', { as: A });
assert.equal(r.body.quant_entries.length, 2);
assert.deepEqual(JSON.parse(r.body.quant_entries.find((e) => e.round_id === weekly.id).positions), anaPlan);
const { purgeUser, softDelete } = await import('../worker/hub/safety.js');
await softDelete(db, await db.prepare('SELECT * FROM users WHERE id = ?').bind(ana).first(), false);
await purgeUser(db, ana);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quant_entries WHERE user_id = ?').bind(ana).first()).n, 0);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quant_entries WHERE user_id = ?').bind(ben).first()).n, 1, 'other members keep theirs');

console.log('quant: ok');
