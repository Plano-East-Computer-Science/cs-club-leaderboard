/**
 * E6 alumni and mentors. Graduates are adults and members are minors, so a
 * member never sees how to reach anyone: the directory lists name, year, what
 * they do and topics, and a member sends a question through the club. Officers
 * read the question and forward it. `contact` is selected only on officer routes.
 *
 * Ask-me-anything sessions are ordinary planned sessions with the speaker
 * template (G1/B8); this page only links to the upcoming ones.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';

export const alumniRouter = new Hono();
export const alumniAdminRouter = new Hono();

const QUESTIONS_PER_DAY = 3;
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Signed-in members only: even names of adults are not for the open web.
alumniRouter.get('/alumni', requireUser, async (c) => {
  const db = c.env.DB;
  const alumni = (await db.prepare('SELECT id, name, grad_year, doing, topics FROM alumni WHERE active = 1 ORDER BY grad_year DESC, name').all()).results;
  const today = new Date().toISOString().slice(0, 10);
  const sessions = (
    await db.prepare(`SELECT id, date, title FROM planned_sessions WHERE template = 'speaker' AND date >= ? ORDER BY date LIMIT 5`).bind(today).all()
  ).results;
  return c.json({ alumni, sessions });
});

alumniRouter.post('/alumni/:id/ask', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const question = clean(body?.question, 500);
  if (question.length < 10) return c.json({ error: 'Say a little more (10 characters or so).' }, 400);
  if (!(await db.prepare('SELECT 1 AS x FROM alumni WHERE id = ? AND active = 1').bind(id).first())) return c.json({ error: 'No such person.' }, 404);
  const n = await db.prepare(`SELECT COUNT(*) AS n FROM alumni_questions WHERE user_id = ? AND created_at > datetime('now', '-1 day')`).bind(user.id).first();
  if (n.n >= QUESTIONS_PER_DAY) return c.json({ error: `${QUESTIONS_PER_DAY} questions a day is the limit. Come back tomorrow.` }, 429);
  await db.prepare('INSERT INTO alumni_questions (alumni_id, user_id, question) VALUES (?, ?, ?)').bind(id, user.id, question).run();
  return c.json({ ok: true });
});

/* -------------------------------- officers -------------------------------- */

function fields(b) {
  const name = clean(b?.name, 80);
  if (!name) return { error: 'Give the person a name.' };
  const year = b?.grad_year === '' || b?.grad_year == null ? null : Number(b.grad_year);
  if (year !== null && (!Number.isInteger(year) || year < 1990 || year > 2100)) return { error: 'Graduation year looks wrong.' };
  return { v: [name, year, clean(b?.doing, 200), clean(b?.topics, 200), clean(b?.contact, 200), b?.active === false ? 0 : 1] };
}

alumniAdminRouter.get('/alumni', async (c) => {
  const db = c.env.DB;
  const alumni = (await db.prepare('SELECT * FROM alumni ORDER BY active DESC, grad_year DESC, name').all()).results;
  const questions = (
    await db
      .prepare(
        `SELECT q.id, q.question, q.status, q.created_at, a.name AS alumni_name, a.contact, u.name AS member
         FROM alumni_questions q JOIN alumni a ON a.id = q.alumni_id JOIN users u ON u.id = q.user_id
         WHERE u.deleted_at IS NULL ORDER BY (q.status = 'forwarded'), q.created_at DESC LIMIT 100`
      )
      .all()
  ).results;
  return c.json({ alumni, questions });
});

alumniAdminRouter.post('/alumni', async (c) => {
  const f = fields(await c.req.json().catch(() => ({})));
  if (f.error) return c.json({ error: f.error }, 400);
  const res = await c.env.DB.prepare('INSERT INTO alumni (name, grad_year, doing, topics, contact, active) VALUES (?, ?, ?, ?, ?, ?)').bind(...f.v).run();
  return c.json({ id: res.meta.last_row_id });
});

alumniAdminRouter.patch('/alumni/:id', async (c) => {
  const f = fields(await c.req.json().catch(() => ({})));
  if (f.error) return c.json({ error: f.error }, 400);
  await c.env.DB.prepare('UPDATE alumni SET name = ?, grad_year = ?, doing = ?, topics = ?, contact = ?, active = ? WHERE id = ?').bind(...f.v, Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

alumniAdminRouter.delete('/alumni/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM alumni WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

alumniAdminRouter.post('/alumni/questions/:id/forwarded', async (c) => {
  await c.env.DB.prepare(`UPDATE alumni_questions SET status = 'forwarded' WHERE id = ?`).bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});
