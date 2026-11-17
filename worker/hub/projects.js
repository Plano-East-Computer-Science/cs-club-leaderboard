/**
 * Projects and portfolios. A project is a title, a blurb and links; the code
 * itself lives on GitHub (reachable from school through the gateway).
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { requireUser } from './users.js';
import { questProgress } from '../../shared/quests.js';
import { statsFor } from './quests.js';

export const projectsRouter = new Hono();

const httpsOrEmpty = (s) => {
  const v = String(s ?? '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

projectsRouter.get('/projects', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT p.id, p.title, p.description, p.track, p.repo_url, p.demo_url, p.created_at,
                u.id AS user_id, u.name AS author
         FROM projects p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = 0 ORDER BY p.created_at DESC LIMIT 100`
      )
      .all()
  ).results;
  return c.json({ projects: rows });
});

projectsRouter.post('/projects', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim().slice(0, 80);
  const description = String(body?.description ?? '').trim().slice(0, 600);
  const track = String(body?.track ?? '').trim().slice(0, 20);
  const repo = httpsOrEmpty(body?.repo_url);
  const demo = httpsOrEmpty(body?.demo_url);

  if (title.length < 3) return c.json({ error: 'Give the project a title.' }, 400);
  if (repo === null || demo === null) return c.json({ error: 'Links must start with https://' }, 400);

  const user = c.get('user');
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').bind(user.id).first();
  if (count.n >= 25) return c.json({ error: 'That is plenty of projects for now.' }, 400);

  const res = await c.env.DB
    .prepare('INSERT INTO projects (user_id, title, description, track, repo_url, demo_url) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(user.id, title, description, track, repo, demo)
    .run();
  return c.json({ id: res.meta.last_row_id });
});

projectsRouter.delete('/projects/:id', requireUser, async (c) => {
  await c.env.DB
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  return c.json({ ok: true });
});

/** Public portfolio: courses finished, steps passed, projects shipped. */
projectsRouter.get('/portfolio/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const user = await c.env.DB.prepare('SELECT id, name, created_at FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ error: 'No such member.' }, 404);

  const done = (
    await c.env.DB
      .prepare('SELECT course, COUNT(*) AS n FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL GROUP BY course')
      .bind(id)
      .all()
  ).results;
  const passed = new Map(done.map((r) => [r.course, r.n]));
  const courses = COURSES.map((course) => ({
    slug: course.slug,
    title: course.title,
    track: course.track,
    passed: passed.get(course.slug) ?? 0,
    steps: course.steps.length,
  })).filter((x) => x.passed > 0);

  const rooms = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM room_checkins WHERE user_id = ?').bind(id).first();
  const projects = (
    await c.env.DB
      .prepare(
        `SELECT id, title, description, track, repo_url, demo_url, created_at
         FROM projects WHERE user_id = ? AND hidden = 0 ORDER BY created_at DESC`
      )
      .bind(id)
      .all()
  ).results;

  const q = questProgress(await statsFor(c.env.DB, id));
  return c.json({
    name: user.name,
    rank: q.rank,
    xp: q.xp,
    badges: q.quests.filter((x) => x.done).map((x) => x.title),
    since: user.created_at,
    meetings: rooms.n,
    courses: courses.map((x) => ({ ...x, complete: x.passed === x.steps })),
    projects,
  });
});
