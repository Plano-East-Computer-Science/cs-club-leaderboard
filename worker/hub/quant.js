/**
 * Quant sandbox (C14): a paper-trading game on synthetic prices. Simulated
 * only: no real money, no real market data, no brokerage, no advice.
 *
 * A round is a seed plus settings. Members decide one position per step and
 * see the next prices only after deciding, so the server stores decisions
 * append-only and recomputes the equity curve and score from the seed itself
 * (shared/quant.js). No route reads a return, balance or score from a browser,
 * and the game writes nothing to the points ledger.
 *
 * The seed stays on the server until the round closes. When no round is open,
 * the first visit of the week opens a default one.
 */
import { Hono } from 'hono';

import {
  HISTORY, SHORT_CAPS, MAX_SEED, makeSeries, stepsOf, visibleDays, cleanPosition, equityCurve, scoreRound, randomSeed,
} from '../../shared/quant.js';
import { currentUser, requireUser } from './users.js';
import { firstName } from './names.js';

export const quantRouter = new Hono();
export const quantAdminRouter = new Hono();

const DAY_MS = 86_400_000;
const isOpen = (r, now = Date.now()) => r.status === 'open' && r.closes_at > now;

const roundById = (db, id) => db.prepare('SELECT * FROM quant_rounds WHERE id = ?').bind(Number(id) || 0).first();

/** Monday 00:00 UTC of the week holding `now`. */
function weekStart(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** Opens this week's default round if nothing is open. The unique `week` keeps it to one. */
export async function ensureWeekly(db, now = Date.now()) {
  if (await db.prepare(`SELECT 1 AS x FROM quant_rounds WHERE status = 'open' AND closes_at > ?`).bind(now).first()) return;
  const mon = weekStart(now);
  const label = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  await db
    .prepare(`INSERT OR IGNORE INTO quant_rounds (title, seed, days, step, short_cap, closes_at, week) VALUES (?, ?, 60, 5, 0, ?, ?)`)
    .bind(`Week of ${label}`, randomSeed(), mon.getTime() + 7 * DAY_MS, mon.toISOString().slice(0, 10))
    .run();
}

const summary = (r, now) => ({
  id: r.id,
  title: r.title,
  days: r.days,
  step: r.step,
  steps: stepsOf(r),
  shortCap: r.short_cap,
  status: isOpen(r, now) ? 'open' : 'closed',
  closesAt: r.closes_at,
});

/** Finished entries, best score first, first names only. Unranked entries are counted, not listed. */
async function leaderboard(db, roundId, userId) {
  const rows = (
    await db
      .prepare(
        `SELECT e.user_id, e.score, e.total_return, e.max_drawdown, e.ranked, u.name
         FROM quant_entries e JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
         WHERE e.round_id = ? AND e.finished_at IS NOT NULL`
      )
      .bind(roundId)
      .all()
  ).results;
  const ranked = rows.filter((r) => r.ranked).sort((a, b) => b.score - a.score || firstName(a.name).localeCompare(firstName(b.name)));
  return {
    rows: ranked.slice(0, 50).map((r, i) => ({
      rank: i + 1,
      name: firstName(r.name),
      score: r.score,
      totalReturn: r.total_return,
      maxDrawdown: r.max_drawdown,
      mine: r.user_id === userId,
    })),
    unranked: rows.length - ranked.length,
  };
}

/** What one viewer may see of a round: prices only up to their own next decision while it is open. */
async function roundView(db, round, user, now = Date.now()) {
  const open = isOpen(round, now);
  const entry = user
    ? await db.prepare('SELECT * FROM quant_entries WHERE round_id = ? AND user_id = ?').bind(round.id, user.id).first()
    : null;
  const decisions = entry ? JSON.parse(entry.positions) : [];
  const done = decisions.length >= stepsOf(round);
  const series = makeSeries(round.seed, { days: HISTORY + round.days });
  const shown = open && !done ? visibleDays(round, decisions.length) : series.prices.length;
  const result = entry?.finished_at
    ? { score: entry.score, sharpe: entry.sharpe, maxDrawdown: entry.max_drawdown, totalReturn: entry.total_return, ranked: Boolean(entry.ranked) }
    : null;
  return {
    ...summary(round, now),
    history: HISTORY,
    ticker: series.ticker,
    prices: series.prices.slice(0, shown),
    // Revealed once the round is over, so anyone can re-create the series and check every score.
    seed: open ? null : round.seed,
    regimes: open ? null : series.regimes,
    mine: user ? { decisions, equity: equityCurve(series.prices, decisions, round), result } : null,
    leaderboard: await leaderboard(db, round.id, user?.id),
    signedIn: Boolean(user),
  };
}

/* --------------------------------- members -------------------------------- */

quantRouter.get('/quant/rounds', async (c) => {
  const db = c.env.DB;
  const now = Date.now();
  await ensureWeekly(db, now);
  const user = await currentUser(c);
  const rounds = (await db.prepare('SELECT * FROM quant_rounds ORDER BY id DESC LIMIT 20').all()).results;
  const counts = Object.fromEntries(
    (await db.prepare('SELECT round_id, COUNT(*) AS n FROM quant_entries WHERE finished_at IS NOT NULL GROUP BY round_id').all()).results.map((r) => [r.round_id, r.n])
  );
  const mine = user
    ? Object.fromEntries((await db.prepare('SELECT round_id, positions FROM quant_entries WHERE user_id = ?').bind(user.id).all()).results.map((r) => [r.round_id, JSON.parse(r.positions).length]))
    : {};
  return c.json({
    rounds: rounds.map((r) => ({ ...summary(r, now), players: counts[r.id] ?? 0, decided: mine[r.id] ?? 0 })),
    signedIn: Boolean(user),
  });
});

quantRouter.get('/quant/rounds/:id', async (c) => {
  const round = await roundById(c.env.DB, c.req.param('id'));
  if (!round) return c.json({ error: 'No such round.' }, 404);
  return c.json(await roundView(c.env.DB, round, await currentUser(c)));
});

/**
 * One decision: { step, position }. `step` must be the next undecided step, so
 * a decision can never be changed after its prices are seen. Anything else in
 * the body (a balance, a return, a score) is ignored.
 */
quantRouter.post('/quant/rounds/:id/decide', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const round = await roundById(db, c.req.param('id'));
  if (!round) return c.json({ error: 'No such round.' }, 404);
  if (!isOpen(round)) return c.json({ error: 'This round is over.' }, 409);
  const body = (await c.req.json().catch(() => null)) ?? {};
  const position = cleanPosition(body.position, round.short_cap);
  if (position === null) {
    return c.json({ error: round.short_cap ? `Pick a position from -${round.short_cap} (short) to 1 (all in).` : 'Pick a position from 0 (out) to 1 (all in). This round has no shorting.' }, 400);
  }

  await db.prepare('INSERT OR IGNORE INTO quant_entries (round_id, user_id) VALUES (?, ?)').bind(round.id, user.id).run();
  const entry = await db.prepare('SELECT positions FROM quant_entries WHERE round_id = ? AND user_id = ?').bind(round.id, user.id).first();
  const decisions = JSON.parse(entry.positions);
  if (decisions.length >= stepsOf(round)) return c.json({ error: 'You have finished this round.' }, 409);
  if (body.step !== decisions.length) return c.json({ error: 'That step is already decided. Reload to see where you are.' }, 409);

  const next = [...decisions, position];
  const finished = next.length === stepsOf(round);
  const s = finished ? scoreRound(round, next) : null;
  // Compare-and-set on the old list, so two tabs racing cannot both append.
  const res = await db
    .prepare(
      `UPDATE quant_entries SET positions = ?, score = ?, sharpe = ?, max_drawdown = ?, total_return = ?, ranked = ?,
         finished_at = CASE WHEN ? THEN datetime('now') END, updated_at = datetime('now')
       WHERE round_id = ? AND user_id = ? AND positions = ?`
    )
    .bind(JSON.stringify(next), s?.score ?? null, s?.sharpe ?? null, s?.maxDrawdown ?? null, s?.totalReturn ?? null, s?.ranked ? 1 : 0, finished ? 1 : 0, round.id, user.id, entry.positions)
    .run();
  if (!res.meta.changes) return c.json({ error: 'That step is already decided. Reload to see where you are.' }, 409);
  return c.json(await roundView(db, round, user));
});

/* -------------------------------- officers -------------------------------- */

quantAdminRouter.get('/quant/rounds', async (c) => {
  const now = Date.now();
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.*, (SELECT COUNT(*) FROM quant_entries WHERE round_id = r.id) AS players,
           (SELECT COUNT(*) FROM quant_entries WHERE round_id = r.id AND finished_at IS NOT NULL) AS finished
         FROM quant_rounds r ORDER BY r.id DESC LIMIT 50`
      )
      .all()
  ).results;
  // The seed shows only after closing, here too, so an officer who plays has no edge.
  return c.json({ rounds: rows.map((r) => ({ ...summary(r, now), players: r.players, finished: r.finished, weekly: Boolean(r.week), seed: isOpen(r, now) ? null : r.seed })) });
});

quantAdminRouter.post('/quant/rounds', async (c) => {
  const b = (await c.req.json().catch(() => null)) ?? {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const days = Number(b.days ?? 60);
  const step = Number(b.step ?? 5);
  const shortCap = Number(b.shortCap ?? 0);
  const closeDays = Number(b.closesInDays ?? 7);
  if (!title || title.length > 80) return c.json({ error: 'Give the round a title of up to 80 characters.' }, 400);
  if (!Number.isInteger(step) || step < 1 || step > 10) return c.json({ error: 'Days per step is a whole number from 1 to 10.' }, 400);
  if (!Number.isInteger(days) || days < 20 || days > 120 || days % step) return c.json({ error: 'Days to play is 20 to 120 and a multiple of days per step.' }, 400);
  if (!SHORT_CAPS.includes(shortCap)) return c.json({ error: `The short limit is one of ${SHORT_CAPS.join(', ')}.` }, 400);
  if (!Number.isInteger(closeDays) || closeDays < 1 || closeDays > 30) return c.json({ error: 'A round runs for 1 to 30 days.' }, 400);
  let seed = randomSeed();
  if (b.seed != null && b.seed !== '') {
    seed = Number(b.seed);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= MAX_SEED) return c.json({ error: 'A seed is a whole number from 0 to 4503599627370495.' }, 400);
  }
  const res = await c.env.DB
    .prepare('INSERT INTO quant_rounds (title, seed, days, step, short_cap, closes_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(title, seed, days, step, shortCap, Date.now() + closeDays * DAY_MS, c.get('officer')?.name ?? 'officer')
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

/** Closing ends play and reveals the seed, so there is no reopening: open a new round instead. */
quantAdminRouter.post('/quant/rounds/:id/close', async (c) => {
  const res = await c.env.DB.prepare(`UPDATE quant_rounds SET status = 'closed' WHERE id = ?`).bind(Number(c.req.param('id')) || 0).run();
  if (!res.meta.changes) return c.json({ error: 'No such round.' }, 404);
  return c.json({ ok: true });
});
