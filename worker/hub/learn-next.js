/**
 * Lesson progress for the `next` Learn area, mounted at /api/lessons.
 * One row per student per lesson (table lesson_progress). Lessons themselves
 * are static data in shared/next/learn/courses/; the browser keeps progress in
 * localStorage and syncs here when signed in.
 *
 *   GET  /api/lessons/progress  -> { progress: [{ course, lesson, step, done }] }
 *   POST /api/lessons/progress  { items: [{ course, lesson, step, done }] } (or one item)
 *                               -> the same shape, after saving
 *
 * The user is always the signed-in one; a body cannot name anybody else.
 * `done` only ever goes from false to true.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { findLesson } from '../../shared/next/learn/courses/index.js';

export const learnNextRouter = new Hono();
learnNextRouter.use('/progress', requireUser);

const MAX_ITEMS = 100;

async function list(db, userId) {
  const rows = (
    await db
      .prepare('SELECT course, lesson, step, done_at FROM lesson_progress WHERE user_id = ? ORDER BY updated_at')
      .bind(userId)
      .all()
  ).results;
  return rows.map((r) => ({ course: r.course, lesson: r.lesson, step: r.step, done: Boolean(r.done_at) }));
}

/** One item from the body -> a clean row, or an error sentence. Exported for the tests. */
export function cleanItem(it) {
  if (!it || typeof it !== 'object') return { error: 'Each item needs a course and a lesson.' };
  const found = typeof it.course === 'string' && typeof it.lesson === 'string' ? findLesson(it.course, it.lesson) : null;
  if (!found) return { error: 'That lesson does not exist.' };
  const steps = found.lesson.steps.length;
  const step = it.step ?? 0;
  if (!Number.isInteger(step) || step < 0 || step >= steps) return { error: `Step must be a whole number from 0 to ${steps - 1}.` };
  if (it.done != null && typeof it.done !== 'boolean') return { error: 'done must be true or false.' };
  return { course: it.course, lesson: it.lesson, step, done: it.done === true };
}

learnNextRouter.get('/progress', async (c) => c.json({ progress: await list(c.env.DB, c.get('user').id) }));

learnNextRouter.post('/progress', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Send progress as JSON.' }, 400);
  const items = Array.isArray(body.items) ? body.items : [body];
  if (!items.length || items.length > MAX_ITEMS) return c.json({ error: `Send 1 to ${MAX_ITEMS} lessons at a time.` }, 400);
  const clean = items.map(cleanItem);
  const bad = clean.find((x) => x.error);
  if (bad) return c.json({ error: bad.error }, 400);

  const db = c.env.DB;
  const userId = c.get('user').id;
  await db.batch(
    clean.map((x) =>
      db
        .prepare(
          `INSERT INTO lesson_progress (user_id, course, lesson, step, done_at, updated_at)
           VALUES (?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END, datetime('now'))
           ON CONFLICT (user_id, course, lesson) DO UPDATE SET
             step = excluded.step,
             done_at = COALESCE(lesson_progress.done_at, excluded.done_at),
             updated_at = excluded.updated_at`
        )
        .bind(userId, x.course, x.lesson, x.step, x.done ? 1 : 0)
    )
  );
  return c.json({ progress: await list(db, userId) });
});
