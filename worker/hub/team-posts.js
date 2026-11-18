/**
 * Teammate board (D4). A short "looking for a teammate" post attached to a
 * ship cycle or an opportunity. Readers see a first name that links to the
 * author's portfolio; there is no private messaging, the post says how to
 * reach the author (Discord handle, "find me at the meeting").
 */
import { Hono } from 'hono';

import { currentUser, requireUser } from './users.js';

export const teamPostsRouter = new Hono();

export const TARGETS = ['cycle', 'opp'];
const MAX_OPEN = 3;
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function cleanPost(input) {
  const text = clip(input?.text, 200);
  if (text.length < 8) return { error: 'Say what you are building and who you need (8 characters or more).' };
  const type = String(input?.target_type ?? '');
  const id = Number(input?.target_id);
  if (!TARGETS.includes(type) || !Number.isInteger(id) || id < 1) return { error: 'Pick a cycle or an opportunity.' };
  return { value: { text, skills: clip(input?.skills, 60), type, id } };
}

teamPostsRouter.get('/team-posts', async (c) => {
  const type = c.req.query('type');
  const id = Number(c.req.query('id'));
  if (!TARGETS.includes(type) || !Number.isInteger(id)) return c.json({ error: 'Pick a cycle or an opportunity.' }, 400);
  const user = await currentUser(c);
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT t.id, t.text, t.skills, t.created_at, t.user_id, u.name FROM team_posts t JOIN users u ON u.id = t.user_id
         WHERE t.target_type = ? AND t.target_id = ? AND t.status = 'open' ORDER BY t.id DESC LIMIT 30`
      )
      .bind(type, id)
      .all()
  ).results;
  return c.json({
    signedIn: Boolean(user),
    posts: rows.map(({ name, user_id, ...r }) => ({ ...r, author_id: user_id, author: String(name).split(' ')[0], mine: user?.id === user_id })),
  });
});

/** How many open posts each opportunity has, for the small link on its card. */
teamPostsRouter.get('/team-posts/counts', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(`SELECT target_id, COUNT(*) AS n FROM team_posts WHERE target_type = 'opp' AND status = 'open' GROUP BY target_id`)
      .all()
  ).results;
  return c.json({ counts: Object.fromEntries(rows.map((r) => [r.target_id, r.n])) });
});

teamPostsRouter.post('/team-posts', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const p = cleanPost(await c.req.json().catch(() => ({})));
  if (p.error) return c.json({ error: p.error }, 400);
  const { text, skills, type, id } = p.value;
  const target =
    type === 'cycle'
      ? await db.prepare(`SELECT 1 AS x FROM cycles WHERE id = ? AND status IN ('open', 'demo')`).bind(id).first()
      : await db.prepare('SELECT 1 AS x FROM opportunities WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: type === 'cycle' ? 'That cycle is not running.' : 'No such opportunity.' }, 404);
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM team_posts WHERE user_id = ? AND status = 'open'`).bind(user.id).first();
  if (open.n >= MAX_OPEN) return c.json({ error: `You have ${MAX_OPEN} posts open. Close one first.` }, 429);
  const res = await db
    .prepare('INSERT INTO team_posts (user_id, target_type, target_id, text, skills) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, type, id, text, skills)
    .run();
  return c.json({ id: res.meta.last_row_id });
});

/** Close (found someone) or delete: both just take the post down, and only its author can. */
teamPostsRouter.post('/team-posts/:id/close', requireUser, async (c) => {
  const res = await c.env.DB
    .prepare(`UPDATE team_posts SET status = 'closed' WHERE id = ? AND user_id = ?`)
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'No such post of yours.' }, 404);
  return c.json({ ok: true });
});
