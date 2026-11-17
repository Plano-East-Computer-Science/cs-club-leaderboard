/**
 * Courses: list, read, and check answers.
 *
 * Content is in shared/courses.js. Anything that would reveal an answer stays
 * on this side of the wire; the browser gets `publicStep` copies. mcq and flag
 * steps are checked here. code steps are checked in the student's browser
 * (Python via WebAssembly) and the result is reported, which is an honour
 * system by design.
 */
import { Hono } from 'hono';

import { COURSES, TRACKS, findCourse, publicStep } from '../../shared/courses.js';
import { currentUser, requireUser } from './users.js';

export const learnRouter = new Hono();

const MAX_CODE = 20_000;

const passedSteps = async (db, userId) => {
  const rows = (
    await db
      .prepare('SELECT course, step FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL')
      .bind(userId)
      .all()
  ).results;
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.course)) by.set(r.course, new Set());
    by.get(r.course).add(r.step);
  }
  return by;
};

/** Tracks with their courses, plus this student's progress when signed in. */
learnRouter.get('/learn', async (c) => {
  const user = await currentUser(c);
  const done = user ? await passedSteps(c.env.DB, user.id) : new Map();

  const courses = COURSES.map((course) => ({
    slug: course.slug,
    track: course.track,
    title: course.title,
    level: course.level,
    minutes: course.minutes,
    blurb: course.blurb,
    steps: course.steps.length,
    passed: done.get(course.slug)?.size ?? 0,
  }));
  return c.json({ tracks: TRACKS, courses, signedIn: Boolean(user) });
});

learnRouter.get('/learn/:slug', async (c) => {
  const course = findCourse(c.req.param('slug'));
  if (!course) return c.json({ error: 'No such course.' }, 404);

  const user = await currentUser(c);
  let progress = {};
  if (user) {
    const rows = (
      await c.env.DB
        .prepare('SELECT step, passed_at, attempts, code FROM step_progress WHERE user_id = ? AND course = ?')
        .bind(user.id, course.slug)
        .all()
    ).results;
    progress = Object.fromEntries(
      rows.map((r) => [r.step, { passed: Boolean(r.passed_at), attempts: r.attempts, code: r.code }])
    );
  }

  return c.json({
    slug: course.slug,
    track: course.track,
    title: course.title,
    level: course.level,
    minutes: course.minutes,
    blurb: course.blurb,
    steps: course.steps.map(publicStep),
    progress,
    signedIn: Boolean(user),
  });
});

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Body: { step, answer?, code?, passed? }
 *   read -> marks done
 *   mcq  -> answer is an index
 *   flag -> answer is a string
 *   code -> client reports `passed` after running the cases locally
 */
learnRouter.post('/learn/:slug/check', requireUser, async (c) => {
  const course = findCourse(c.req.param('slug'));
  if (!course) return c.json({ error: 'No such course.' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const step = course.steps.find((s) => s.id === body?.step);
  if (!step) return c.json({ error: 'No such step.' }, 404);

  let correct;
  let explain;
  switch (step.kind) {
    case 'read':
      correct = true;
      break;
    case 'mcq':
      correct = Number(body.answer) === step.answer;
      explain = step.explain; // safe to show once they have answered
      break;
    case 'flag':
      correct = norm(body.answer) === norm(step.flag);
      break;
    case 'code':
      correct = body.passed === true;
      break;
    default:
      return c.json({ error: 'Unknown step kind.' }, 500);
  }

  const user = c.get('user');
  const code = step.kind === 'code' ? String(body.code ?? '').slice(0, MAX_CODE) : '';
  // Never un-pass a step; a later wrong answer does not erase earlier success.
  await c.env.DB
    .prepare(
      `INSERT INTO step_progress (user_id, course, step, passed_at, attempts, code)
       VALUES (?, ?, ?, CASE WHEN ? THEN datetime('now') END, 1, ?)
       ON CONFLICT(user_id, course, step) DO UPDATE SET
         attempts  = attempts + 1,
         passed_at = COALESCE(passed_at, CASE WHEN ? THEN datetime('now') END),
         code      = CASE WHEN ? != '' THEN ? ELSE code END`
    )
    .bind(user.id, course.slug, step.id, correct ? 1 : 0, code, correct ? 1 : 0, code, code)
    .run();

  return c.json({ correct, ...(explain && { explain }) });
});

/** Saves in-progress code without counting it as an attempt. */
learnRouter.put('/learn/:slug/draft', requireUser, async (c) => {
  const course = findCourse(c.req.param('slug'));
  const body = await c.req.json().catch(() => ({}));
  const step = course?.steps.find((s) => s.id === body?.step && s.kind === 'code');
  if (!step) return c.json({ error: 'No such code step.' }, 404);

  await c.env.DB
    .prepare(
      `INSERT INTO step_progress (user_id, course, step, code) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, course, step) DO UPDATE SET code = excluded.code`
    )
    .bind(c.get('user').id, course.slug, step.id, String(body.code ?? '').slice(0, MAX_CODE))
    .run();
  return c.json({ ok: true });
});
