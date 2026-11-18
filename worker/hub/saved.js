/**
 * Who else is doing an opportunity (E2). Builds on the A3 `opportunity_interest`
 * table ("I'm doing this"); there is no second kind of save. Counts are public,
 * first names go only to signed-in members.
 */
import { Hono } from 'hono';

import { currentUser } from './users.js';

export const savedRouter = new Hono();

const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';

savedRouter.get('/opp-interest', async (c) => {
  const user = await currentUser(c);
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT i.opportunity_id AS id, i.user_id, u.name FROM opportunity_interest i JOIN users u ON u.id = i.user_id
         JOIN opportunities o ON o.id = i.opportunity_id WHERE o.status = 'live' ORDER BY i.created_at`
      )
      .all()
  ).results;
  const counts = {};
  const names = {};
  const mine = [];
  for (const r of rows) {
    counts[r.id] = (counts[r.id] ?? 0) + 1;
    if (r.user_id === user?.id) mine.push(r.id);
    else if (user) (names[r.id] ??= []).push(firstName(r.name));
  }
  return c.json({ counts, names, mine, signedIn: Boolean(user) });
});
