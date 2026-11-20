/**
 * Future door API, mounted at /api/future. Today it only syncs the
 * student's own tracker; curated programs and colleges ship as static data
 * in shared/next/future. Every row is keyed by (user_id, id), so a member can
 * only ever read or write their own items.
 */
import { Hono } from 'hono';

import { cleanItem, LIMITS } from '../../shared/next/future/tracker.js';
import { requireUser } from './users.js';

export const futureRouter = new Hono();

futureRouter.use('/tracker', requireUser);
futureRouter.use('/tracker/*', requireUser);

futureRouter.get('/tracker', async (c) => {
  const rows = (
    await c.env.DB.prepare('SELECT data FROM future_tracker WHERE user_id = ? ORDER BY created_at, rowid').bind(c.get('user').id).all()
  ).results;
  const items = [];
  for (const r of rows) {
    try {
      items.push(JSON.parse(r.data));
    } catch {
      /* a row we cannot read is skipped, not fatal */
    }
  }
  return c.json({ items });
});

futureRouter.put('/tracker/:id', async (c) => {
  const text = await c.req.text();
  if (text.length > LIMITS.bytes) return c.json({ error: 'That item is too large.' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return c.json({ error: 'Send the item as JSON.' }, 400);
  }
  const { item, error } = cleanItem({ ...body, id: c.req.param('id') });
  if (error) return c.json({ error }, 400);
  item.updatedAt = item.updatedAt || Date.now();

  const db = c.env.DB;
  const uid = c.get('user').id;
  const exists = await db.prepare('SELECT 1 AS x FROM future_tracker WHERE user_id = ? AND id = ?').bind(uid, item.id).first();
  if (!exists) {
    const { n } = await db.prepare('SELECT COUNT(*) AS n FROM future_tracker WHERE user_id = ?').bind(uid).first();
    if (n >= LIMITS.items) return c.json({ error: `Your tracker is full (${LIMITS.items} items). Remove a few first.` }, 409);
  }
  await db
    .prepare(
      `INSERT INTO future_tracker (user_id, id, data, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .bind(uid, item.id, JSON.stringify(item))
    .run();
  return c.json({ item });
});

futureRouter.delete('/tracker/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM future_tracker WHERE user_id = ? AND id = ?').bind(c.get('user').id, c.req.param('id')).run();
  return c.json({ ok: true });
});
