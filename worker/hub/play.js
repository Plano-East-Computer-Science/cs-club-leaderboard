/**
 * Play (/api/play): finished daily games for signed-in players, their streak,
 * and a weekly board. One result per game per day per player (unique index).
 * Honour system like the daily problem: the browser plays, we record. Play
 * scores never feed season points.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { publicName } from './names.js';
import { addDays, chicagoDate, dateOpen, resultError, streakOf, weekStart } from '../../shared/next/play/core.js';

export const playRouter = new Hono();

const HISTORY_DAYS = 60;

async function mine(db, userId, today) {
  const results = (
    await db
      .prepare('SELECT game, date, score, guesses, ms, detail FROM play_results WHERE user_id = ? AND date >= ? ORDER BY date DESC')
      .bind(userId, addDays(today, -HISTORY_DAYS))
      .all()
  ).results;
  return { today, results, streak: streakOf(results.map((r) => r.date), today) };
}

playRouter.get('/play/me', requireUser, async (c) => c.json(await mine(c.env.DB, c.get('user').id, chicagoDate())));

playRouter.post('/play/results', requireUser, async (c) => {
  const b = await c.req.json().catch(() => null);
  const err = resultError(b);
  if (err) return c.json({ error: err }, 400);
  const today = chicagoDate();
  if (!dateOpen(b.date, today)) return c.json({ error: 'Only today\'s and yesterday\'s puzzles can be saved.' }, 400);
  const user = c.get('user');
  const r = await c.env.DB
    .prepare(
      `INSERT INTO play_results (user_id, game, date, score, guesses, ms, detail) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, game, date) DO NOTHING`
    )
    .bind(user.id, b.game, b.date, b.score, b.guesses ?? null, b.ms ?? null, b.detail ?? null)
    .run();
  if (!r.meta.changes) return c.json({ error: 'You already finished this puzzle.' }, 409);
  return c.json(await mine(c.env.DB, user.id, today));
});

// This week (Monday to today, Chicago): top 10 by points. Public names only, no ids or emails.
playRouter.get('/play/board', requireUser, async (c) => {
  const today = chicagoDate();
  const me = c.get('user').id;
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.user_id AS uid, u.name, u.show_full_name AS full, SUM(r.score) AS points, COUNT(*) AS games
         FROM play_results r JOIN users u ON u.id = r.user_id
         WHERE r.date >= ? AND r.date <= ? AND u.deleted_at IS NULL
         GROUP BY r.user_id
         ORDER BY points DESC, games DESC, MIN(r.created_at) ASC
         LIMIT 10`
      )
      .bind(weekStart(today), today)
      .all()
  ).results;
  return c.json({
    week: weekStart(today),
    rows: rows.map((r) => ({ name: publicName(r.name, r.full), points: r.points, games: r.games, me: r.uid === me })),
  });
});
