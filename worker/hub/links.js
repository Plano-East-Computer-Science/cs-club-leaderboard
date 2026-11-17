/**
 * Connecting an account to a leaderboard entry. The student asks, an officer
 * approves: otherwise anyone could claim someone else's points.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';

export const linksRouter = new Hono();
export const linksAdminRouter = new Hono();

/** Active students nobody has linked yet (the ones a new account can claim). */
const CLAIMABLE = `SELECT s.id, s.name FROM students s
  WHERE s.active = 1 AND NOT EXISTS (SELECT 1 FROM users u WHERE u.student_id = s.id)
  ORDER BY s.name`;

linksRouter.get('/me/link', requireUser, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const pending = await db
    .prepare('SELECT s.id, s.name FROM link_requests r JOIN students s ON s.id = r.student_id WHERE r.user_id = ?')
    .bind(user.id)
    .first();
  const students = user.student_id || pending ? [] : (await db.prepare(CLAIMABLE).all()).results;
  return c.json({ linked: Boolean(user.student_id), pending, students });
});

linksRouter.post('/me/link', requireUser, async (c) => {
  const user = c.get('user');
  if (user.student_id) return c.json({ error: 'Already linked.' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const ok = (await c.env.DB.prepare(CLAIMABLE).all()).results.some((s) => s.id === Number(body?.student_id));
  if (!ok) return c.json({ error: 'That entry is not available to link.' }, 400);
  await c.env.DB
    .prepare(
      `INSERT INTO link_requests (user_id, student_id) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET student_id = excluded.student_id, created_at = datetime('now')`
    )
    .bind(user.id, Number(body.student_id))
    .run();
  return c.json({ ok: true });
});

linksRouter.delete('/me/link', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM link_requests WHERE user_id = ?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});

/* ---- officer side (mounted behind the admin-cookie lock) ---- */

linksAdminRouter.get('/links', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.user_id, u.name AS user_name, u.email, s.id AS student_id, s.name AS student_name, r.created_at
         FROM link_requests r JOIN users u ON u.id = r.user_id JOIN students s ON s.id = r.student_id
         ORDER BY r.created_at`
      )
      .all()
  ).results;
  return c.json({ requests: rows });
});

linksAdminRouter.post('/links/:userId/approve', async (c) => {
  const db = c.env.DB;
  const userId = Number(c.req.param('userId'));
  const req = await db.prepare('SELECT student_id FROM link_requests WHERE user_id = ?').bind(userId).first();
  if (!req) return c.json({ error: 'No such request.' }, 404);
  const taken = await db
    .prepare('SELECT 1 AS x FROM users WHERE student_id = ? AND id != ?')
    .bind(req.student_id, userId)
    .first();
  if (taken) return c.json({ error: 'Another account is already linked to that entry.' }, 409);
  await db.batch([
    db.prepare('UPDATE users SET student_id = ? WHERE id = ?').bind(req.student_id, userId),
    db.prepare('DELETE FROM link_requests WHERE user_id = ?').bind(userId),
  ]);
  return c.json({ ok: true });
});

linksAdminRouter.post('/links/:userId/reject', async (c) => {
  await c.env.DB.prepare('DELETE FROM link_requests WHERE user_id = ?').bind(Number(c.req.param('userId'))).run();
  return c.json({ ok: true });
});

/** Officers can also detach an account (wrong person linked). */
linksAdminRouter.post('/links/:userId/unlink', async (c) => {
  await c.env.DB.prepare('UPDATE users SET student_id = NULL WHERE id = ?').bind(Number(c.req.param('userId'))).run();
  return c.json({ ok: true });
});
