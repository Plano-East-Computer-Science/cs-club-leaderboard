/**
 * Daily problem (C3). One problem per club-timezone day for everyone, drawn
 * from live easy problems unless an officer pinned one. Judging is in the
 * browser, so the server only stores who solved it and how fast.
 */
import { Hono } from 'hono';

import { currentUser, requireUser } from './users.js';
import { publicProblem } from './problems.js';
import { awardFromUser } from './award.js';
import { dailyActivity } from './daily-awards.js';
import { addDays, chicagoDate, median, pickDaily, weekStart, weeklyCount } from '../../shared/daily.js';

export const dailyRouter = new Hono();
export const dailyAdminRouter = new Hono();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_DAYS = 14;

async function poolAndPins(db) {
  const pool = (await db.prepare(`SELECT id, slug FROM problems WHERE status = 'live' AND difficulty BETWEEN 1 AND 3`).all()).results;
  const pins = {};
  for (const r of (await db.prepare('SELECT date, problem_id FROM daily_pins').all()).results) pins[r.date] = r.problem_id;
  return { pool, pins };
}

/** The problem row for a date, or null when the bank has nothing to offer. */
export async function problemFor(db, date) {
  const { pool, pins } = await poolAndPins(db);
  const id = pickDaily(date, pool, pins);
  return id == null ? null : db.prepare('SELECT * FROM problems WHERE id = ?').bind(id).first();
}

async function state(c, user, date) {
  const db = c.env.DB;
  const row = await problemFor(db, date);
  const times = (await db.prepare('SELECT ms FROM daily_results WHERE date = ?').bind(date).all()).results.map((r) => r.ms);
  const out = {
    date,
    problem: row ? publicProblem(row) : null,
    stats: { solved: times.length, medianMs: median(times) },
    signedIn: Boolean(user),
    mine: null,
    week: null,
  };
  if (user) {
    out.mine = await db.prepare('SELECT attempts, ms, solved_at FROM daily_results WHERE user_id = ? AND date = ?').bind(user.id, date).first();
    const mine = (await db.prepare('SELECT date FROM daily_results WHERE user_id = ? AND date >= ? AND date <= ?').bind(user.id, weekStart(date), date).all()).results;
    out.week = weeklyCount(mine.map((r) => r.date), date);
  }
  return out;
}

dailyRouter.get('/daily', async (c) => c.json(await state(c, await currentUser(c), chicagoDate())));

// Honour system like the rest of the bank: the browser judged it, we record it. First solve of the day wins.
dailyRouter.post('/daily/result', requireUser, async (c) => {
  const b = await c.req.json().catch(() => null);
  const attempts = Number(b?.attempts);
  const ms = Number(b?.ms);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 99) return c.json({ error: 'Attempts must be a whole number from 1 to 99.' }, 400);
  if (!Number.isInteger(ms) || ms < 0 || ms > 86_400_000) return c.json({ error: 'Time must be under a day.' }, 400);
  const user = c.get('user');
  const date = chicagoDate();
  if (!(await problemFor(c.env.DB, date))) return c.json({ error: 'There is no daily problem today.' }, 409);
  await c.env.DB
    .prepare(`INSERT OR IGNORE INTO daily_results (user_id, date, attempts, solved_at, ms) VALUES (?, ?, ?, datetime('now'), ?)`)
    .bind(user.id, date, attempts, ms)
    .run();
  await awardFromUser(c.env.DB, user, dailyActivity({ userId: user.id, date, attempts, ms, solvedAt: true }));
  return c.json(await state(c, user, date));
});

/* -------------------------------- officers -------------------------------- */

// The next 14 days with whatever each would show, and which are pinned.
dailyAdminRouter.get('/daily/plan', async (c) => {
  const db = c.env.DB;
  const ctx = await poolAndPins(db);
  const today = chicagoDate();
  const titles = new Map((await db.prepare('SELECT id, slug, title, difficulty FROM problems').all()).results.map((p) => [p.id, p]));
  const days = [];
  for (let i = 0; i < PLAN_DAYS; i++) {
    const date = addDays(today, i);
    const id = pickDaily(date, ctx.pool, ctx.pins);
    days.push({ date, pinned: ctx.pins[date] != null, problem: id == null ? null : titles.get(id) ?? null });
  }
  const options = (await db.prepare(`SELECT id, slug, title, difficulty FROM problems WHERE status = 'live' ORDER BY difficulty, title`).all()).results;
  return c.json({ days, options });
});

dailyAdminRouter.put('/daily/pins/:date', async (c) => {
  const date = c.req.param('date');
  const today = chicagoDate();
  if (!DATE.test(date) || date < today || date > addDays(today, 90)) return c.json({ error: 'Pick a date from today to 90 days out.' }, 400);
  const b = await c.req.json().catch(() => null);
  const p = await c.env.DB.prepare(`SELECT id FROM problems WHERE id = ? AND status = 'live'`).bind(Number(b?.problemId)).first();
  if (!p) return c.json({ error: 'Pick a live problem.' }, 400);
  await c.env.DB.prepare('INSERT INTO daily_pins (date, problem_id) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET problem_id = excluded.problem_id').bind(date, p.id).run();
  return c.json({ ok: true });
});

dailyAdminRouter.delete('/daily/pins/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM daily_pins WHERE date = ?').bind(c.req.param('date')).run();
  return c.json({ ok: true });
});
