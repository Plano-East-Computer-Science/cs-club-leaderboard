/**
 * C15 research track: a paper of the month with short member annotations, each
 * member's private science-fair project card, and the research opportunities
 * already on the board (filtered, not a second opportunity system).
 *
 * Members are minors: annotations show first names to signed-in members only,
 * and the project card is read by its owner and officers, nobody else.
 */
import { Hono } from 'hono';

import { currentUser, requireUser } from './users.js';
import { firstName } from './names.js';

export const researchRouter = new Hono();
export const researchAdminRouter = new Hono();

export const STAGES = ['question', 'mentor', 'data', 'writeup', 'done'];
const NOTES_PER_DAY = 8;
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** https links only, so a paper link can never be javascript: or a plain-http page. */
export function httpsUrl(v) {
  try {
    const u = new URL(String(v ?? '').trim());
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const SELECT_MY_PROJECT = 'SELECT question, mentor, data_plan, writeup, deadline, stage, updated_at FROM science_projects WHERE user_id = ?';
const TEXT = `lower(title || ' ' || description)`;

researchRouter.get('/research', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c);
  const paper = await db.prepare('SELECT id, title, url, why, created_at FROM research_papers ORDER BY id DESC LIMIT 1').first();
  // Research opportunities are the live ones whose text says so; no new category column.
  const opportunities = (
    await db
      .prepare(
        `SELECT id, title, org, url, type, deadline, cost, format FROM opportunities
         WHERE status = 'live' AND (${TEXT} LIKE '%research%' OR ${TEXT} LIKE '%science fair%' OR ${TEXT} LIKE '%isef%')
         ORDER BY (deadline IS NULL), deadline, title LIMIT 40`
      )
      .all()
  ).results;
  let notes = [];
  if (user && paper) {
    notes = (
      await db
        .prepare(
          `SELECT n.id, n.quote, n.comment, n.created_at, n.user_id, u.name FROM paper_notes n JOIN users u ON u.id = n.user_id
           WHERE n.paper_id = ? AND n.status = 'posted' AND u.deleted_at IS NULL ORDER BY n.id DESC LIMIT 100`
        )
        .bind(paper.id)
        .all()
    ).results.map(({ user_id, name, ...n }) => ({ ...n, author: firstName(name), mine: user_id === user.id }));
  }
  return c.json({
    signedIn: Boolean(user),
    stages: STAGES,
    paper: paper ?? null,
    notes,
    opportunities,
    project: user ? ((await db.prepare(SELECT_MY_PROJECT).bind(user.id).first()) ?? null) : null,
  });
});

researchRouter.post('/research/notes', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const quote = clean(body?.quote, 200);
  const comment = clean(body?.comment, 400);
  if (comment.length < 3) return c.json({ error: 'Write a short comment.' }, 400);
  const db = c.env.DB;
  const user = c.get('user');
  const paper = await db.prepare('SELECT id FROM research_papers ORDER BY id DESC LIMIT 1').first();
  if (!paper) return c.json({ error: 'There is no paper of the month yet.' }, 404);
  const today = await db
    .prepare(`SELECT COUNT(*) AS n FROM paper_notes WHERE user_id = ? AND created_at > datetime('now', '-1 day')`)
    .bind(user.id)
    .first();
  if (today.n >= NOTES_PER_DAY) return c.json({ error: 'That is plenty of notes for today. Come back tomorrow.' }, 429);
  const res = await db.prepare('INSERT INTO paper_notes (paper_id, user_id, quote, comment) VALUES (?, ?, ?, ?)').bind(paper.id, user.id, quote, comment).run();
  return c.json({ id: res.meta.last_row_id });
});

researchRouter.delete('/research/notes/:id', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM paper_notes WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.get('user').id).run();
  return c.json({ ok: true });
});

researchRouter.put('/research/project', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const stage = STAGES.includes(b?.stage) ? b.stage : 'question';
  const deadline = b?.deadline ? String(b.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return c.json({ error: 'Use a date like 2027-01-15.' }, 400);
  await c.env.DB
    .prepare(
      `INSERT INTO science_projects (user_id, question, mentor, data_plan, writeup, deadline, stage, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET question = excluded.question, mentor = excluded.mentor, data_plan = excluded.data_plan,
         writeup = excluded.writeup, deadline = excluded.deadline, stage = excluded.stage, updated_at = excluded.updated_at`
    )
    .bind(c.get('user').id, clean(b?.question, 300), clean(b?.mentor, 120), clean(b?.data_plan, 400), clean(b?.writeup, 400), deadline, stage)
    .run();
  return c.json({ ok: true });
});

researchRouter.delete('/research/project', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM science_projects WHERE user_id = ?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});

/* -------------------------------- officers -------------------------------- */

researchAdminRouter.post('/research/paper', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const title = clean(b?.title, 160);
  const url = httpsUrl(b?.url);
  if (!title) return c.json({ error: 'Give the paper a title.' }, 400);
  if (!url) return c.json({ error: 'The link must start with https://.' }, 400);
  const res = await c.env.DB.prepare('INSERT INTO research_papers (title, url, why) VALUES (?, ?, ?)').bind(title, url, clean(b?.why, 400)).run();
  return c.json({ id: res.meta.last_row_id });
});

/** Everyone's project cards, soonest deadline first, so an officer can follow up. */
researchAdminRouter.get('/research/projects', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT p.user_id, u.name, p.question, p.mentor, p.data_plan, p.writeup, p.deadline, p.stage, p.updated_at
         FROM science_projects p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL
         ORDER BY (p.stage = 'done'), (p.deadline IS NULL), p.deadline, p.updated_at DESC`
      )
      .all()
  ).results;
  return c.json({ projects: rows });
});
