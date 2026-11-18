/**
 * Ideas board. Members say what they want from the club and vote on each
 * other's ideas; officers mark them planned or done so people can see they
 * were heard.
 */
import { Hono } from 'hono';

import { currentUser, requireUser } from './users.js';
import { syncQuests } from './quests.js';

export const ideasRouter = new Hono();
export const ideasAdminRouter = new Hono();

export const KINDS = ['lesson', 'project', 'speaker', 'event', 'site'];
const STATUSES = ['open', 'planned', 'done', 'hidden'];
const PER_DAY = 3;

ideasRouter.get('/ideas', async (c) => {
  const user = await currentUser(c);
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT i.id, i.kind, i.body, i.status, i.created_at, u.name AS author, i.user_id,
                (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id) AS votes,
                EXISTS (SELECT 1 FROM idea_votes v WHERE v.idea_id = i.id AND v.user_id = ?) AS voted
         FROM ideas i JOIN users u ON u.id = i.user_id
         WHERE i.status != 'hidden'
         ORDER BY (i.status = 'done'), votes DESC, i.created_at DESC LIMIT 200`
      )
      .bind(user?.id ?? 0)
      .all()
  ).results;
  return c.json({
    kinds: KINDS,
    signedIn: Boolean(user),
    ideas: rows.map(({ user_id, author, ...r }) => ({
      ...r,
      voted: Boolean(r.voted),
      mine: user?.id === user_id,
      author: String(author).split(' ')[0], // first name only on a public page
    })),
  });
});

ideasRouter.post('/ideas', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = String(body?.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const kind = KINDS.includes(body?.kind) ? body.kind : 'lesson';
  if (text.length < 8) return c.json({ error: 'Say a little more (8 characters or so).' }, 400);

  const user = c.get('user');
  const db = c.env.DB;
  const today = await db
    .prepare(`SELECT COUNT(*) AS n FROM ideas WHERE user_id = ? AND created_at > datetime('now', '-1 day')`)
    .bind(user.id)
    .first();
  if (today.n >= PER_DAY) return c.json({ error: `${PER_DAY} ideas a day is the limit. Come back tomorrow.` }, 429);

  const res = await db.prepare('INSERT INTO ideas (user_id, kind, body) VALUES (?, ?, ?)').bind(user.id, kind, text).run();
  // Your own idea starts with your vote.
  await db.prepare('INSERT OR IGNORE INTO idea_votes (idea_id, user_id) VALUES (?, ?)').bind(res.meta.last_row_id, user.id).run();
  await syncQuests(db, user.id); // A4: a first idea finishes a quest
  return c.json({ id: res.meta.last_row_id });
});

/** Toggle this member's vote. */
ideasRouter.post('/ideas/:id/vote', requireUser, async (c) => {
  const id = Number(c.req.param('id'));
  const uid = c.get('user').id;
  const db = c.env.DB;
  const idea = await db.prepare(`SELECT id FROM ideas WHERE id = ? AND status != 'hidden'`).bind(id).first();
  if (!idea) return c.json({ error: 'No such idea.' }, 404);
  const gone = await db.prepare('DELETE FROM idea_votes WHERE idea_id = ? AND user_id = ?').bind(id, uid).run();
  if (!gone.meta.changes) await db.prepare('INSERT INTO idea_votes (idea_id, user_id) VALUES (?, ?)').bind(id, uid).run();
  return c.json({ voted: !gone.meta.changes });
});

ideasRouter.delete('/ideas/:id', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.get('user').id).run();
  return c.json({ ok: true });
});

/* -------------------------------- officers -------------------------------- */

ideasAdminRouter.post('/ideas/:id/status', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!STATUSES.includes(body?.status)) return c.json({ error: 'Unknown status.' }, 400);
  await c.env.DB.prepare('UPDATE ideas SET status = ? WHERE id = ?').bind(body.status, Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});
