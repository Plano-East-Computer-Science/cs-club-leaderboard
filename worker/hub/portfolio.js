/**
 * Portfolio v2 (D6): who may see a portfolio, and the officer-signed line.
 * A portfolio is private until its owner switches it on. Officers can write
 * a sentence about a member that appears on it with the officer's name and
 * the date; members cannot sign for themselves.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { officerOf } from './ledger.js';

export const portfolioRouter = new Hono();
export const portfolioAdminRouter = new Hono();

const MAX_SIGNOFFS = 3; // per member; keeps the page a page, not a testimonial wall
const LINE_MIN = 10;
const LINE_MAX = 200;

/** One line of plain text: whitespace collapsed, no newlines. */
export const cleanLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, LINE_MAX);

export const isPortfolioPublic = async (db, userId) =>
  Boolean(await db.prepare('SELECT 1 AS x FROM portfolio_public WHERE user_id = ?').bind(userId).first());

/** The signed lines for a member, newest first. The shared login reads as "Club officers". */
export async function signoffsFor(db, userId) {
  const rows = (
    await db
      .prepare('SELECT id, line, officer_name, substr(created_at, 1, 10) AS date FROM portfolio_signoffs WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .bind(userId, MAX_SIGNOFFS)
      .all()
  ).results;
  return rows.map((r) => ({ id: r.id, line: r.line, date: r.date, by: r.officer_name === 'shared login' ? 'Club officers' : r.officer_name }));
}

/* --------------------------------- member --------------------------------- */

portfolioRouter.put('/me/portfolio', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (typeof body?.public !== 'boolean') return c.json({ error: 'Say whether the portfolio is public.' }, 400);
  const id = c.get('user').id;
  const db = c.env.DB;
  if (body.public) await db.prepare('INSERT OR IGNORE INTO portfolio_public (user_id) VALUES (?)').bind(id).run();
  else await db.prepare('DELETE FROM portfolio_public WHERE user_id = ?').bind(id).run();
  return c.json({ public: body.public });
});

/* -------------------------------- officers -------------------------------- */

portfolioAdminRouter.get('/portfolio/signoffs', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT g.id, g.line, g.officer_name, substr(g.created_at, 1, 10) AS date, u.name AS member
         FROM portfolio_signoffs g JOIN users u ON u.id = g.user_id ORDER BY g.id DESC LIMIT 100`
      )
      .all()
  ).results;
  return c.json({ signoffs: rows });
});

portfolioAdminRouter.post('/portfolio/signoffs', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const userId = Number(body?.user_id);
  const line = cleanLine(body?.line);
  const db = c.env.DB;
  if (line.length < LINE_MIN) return c.json({ error: 'Write one full sentence about the member.' }, 400);
  const user = Number.isInteger(userId) ? await db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').bind(userId).first() : null;
  if (!user) return c.json({ error: 'No such member.' }, 404);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM portfolio_signoffs WHERE user_id = ?').bind(userId).first();
  if (n.n >= MAX_SIGNOFFS) return c.json({ error: `A member can have ${MAX_SIGNOFFS} signed lines. Remove one first.` }, 409);
  const officer = officerOf(c);
  const res = await db
    .prepare('INSERT INTO portfolio_signoffs (user_id, line, officer_id, officer_name) VALUES (?, ?, ?, ?)')
    .bind(userId, line, officer.userId ?? null, officer.name)
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

portfolioAdminRouter.delete('/portfolio/signoffs/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM portfolio_signoffs WHERE id = ?').bind(Number(c.req.param('id'))).run();
  if (!res.meta.changes) return c.json({ error: 'No such line.' }, 404);
  return c.json({ ok: true });
});
