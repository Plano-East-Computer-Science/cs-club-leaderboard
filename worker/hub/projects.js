/**
 * Projects and portfolios. A project is a title, a blurb and links; the code
 * itself lives on GitHub (reachable from school through the gateway).
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { requireUser, currentUser } from './users.js';
import { isPortfolioPublic, signoffsFor } from './portfolio.js';
import { questProgress } from '../../shared/quests.js';
import { withRepoStats } from './github.js';
import { statsFor, syncQuests } from './quests.js';
import { getLeaderboard } from '../db.js';
import { rankInfo } from './standings.js';
import { publicName } from './names.js';

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
                u.id AS user_id, u.name AS author, u.show_full_name AS full
         FROM projects p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = 0 AND u.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 100`
      )
      .all()
  ).results.map(({ full, author, ...p }) => ({ ...p, author: publicName(author, full) }));
  return c.json({ projects: await withRepoStats(c.env.DB, rows) });
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
  await syncQuests(c.env.DB, user.id); // A4: posting can finish a quest
  return c.json({ id: res.meta.last_row_id });
});

projectsRouter.delete('/projects/:id', requireUser, async (c) => {
  await c.env.DB
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  return c.json({ ok: true });
});

/**
 * Portfolio (D6): attendance, approved results, courses, projects with cached
 * repository data, rank and officer-signed lines. Private unless the member
 * turned it on; a private one answers exactly like a missing one, except to
 * its owner. Only approved, unhidden ledger rows count as results.
 */
projectsRouter.get('/portfolio/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const user = await c.env.DB.prepare('SELECT id, name, student_id, created_at, show_full_name FROM users WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  const viewer = await currentUser(c);
  const owner = Boolean(user && viewer?.id === user.id);
  if (!user || !(owner || (await isPortfolioPublic(c.env.DB, id)))) return c.json({ error: 'No such portfolio.' }, 404);
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');

  const results = user.student_id
    ? (
        await c.env.DB
          .prepare(
            `SELECT kind, json_extract(meta, '$.title') AS title, json_extract(meta, '$.place') AS place, substr(decided_at, 1, 10) AS date
             FROM activity WHERE student_id = ? AND status = 'approved' AND hidden = 0 AND kind IN ('compete', 'place', 'ship')
             ORDER BY decided_at DESC, id DESC LIMIT 40`
          )
          .bind(user.student_id)
          .all()
      ).results.map((r) => ({ kind: r.kind, title: r.title ?? '', place: r.place ?? null, date: r.date ?? '' }))
    : [];

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

  // B6: what they showed in meetings. Newest first, with the meeting it came from.
  const artifacts = (
    await c.env.DB
      .prepare(
        `SELECT a.id, a.kind, a.url, a.line, a.result, a.kudos, a.shown, a.created_at, r.title AS meeting
         FROM artifacts a LEFT JOIN rooms r ON r.code = a.room_code
         WHERE a.user_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 50`
      )
      .bind(id)
      .all()
  ).results;

  const stats = await statsFor(c.env.DB, id);
  const q = questProgress(stats);
  // A4: the portfolio label is the lifetime rank, which never drops.
  const me = stats.studentId ? (await getLeaderboard(c.env.DB, 'all')).find((r) => r.id === stats.studentId) : null;
  return c.json({
    name: publicName(user.name, user.show_full_name),
    rank: rankInfo(me).rankName,
    points: me?.lifetime ?? 0,
    badges: q.quests.filter((x) => x.done).map((x) => x.title),
    since: user.created_at,
    meetings: rooms.n,
    courses: courses.map((x) => ({ ...x, complete: x.passed === x.steps })),
    projects: await withRepoStats(c.env.DB, projects),
    artifacts,
    results,
    signoffs: await signoffsFor(c.env.DB, id),
    owner,
    public: await isPortfolioPublic(c.env.DB, id),
  });
});
