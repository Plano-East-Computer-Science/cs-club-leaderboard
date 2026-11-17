/**
 * The signed-in student's home: where they left off, their standing, their
 * projects. One request so the dashboard paints in a single round trip.
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { getLeaderboard } from '../db.js';
import { requireUser } from './users.js';
import { questProgress } from '../../shared/quests.js';
import { statsFor, streakOf } from './quests.js';

export { streakOf };

export const dashboardRouter = new Hono();

dashboardRouter.get('/me/dashboard', requireUser, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const rows = (
    await db
      .prepare('SELECT course, step, passed_at FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL')
      .bind(user.id)
      .all()
  ).results;
  const done = new Map();
  for (const r of rows) {
    if (!done.has(r.course)) done.set(r.course, new Set());
    done.get(r.course).add(r.step);
  }

  const courses = COURSES.map((course) => ({
    slug: course.slug,
    title: course.title,
    track: course.track,
    steps: course.steps.length,
    passed: done.get(course.slug)?.size ?? 0,
  }));

  // Resume the course already under way; otherwise suggest the first untouched one.
  const target = courses.find((x) => x.passed > 0 && x.passed < x.steps) ?? courses.find((x) => x.passed === 0);
  let next = null;
  if (target) {
    const course = COURSES.find((x) => x.slug === target.slug);
    const step = course.steps.find((s) => !done.get(course.slug)?.has(s.id));
    next = { course: target.slug, courseTitle: target.title, step: step?.title ?? '', started: target.passed > 0 };
  }

  let standing = null;
  if (user.student_id) {
    const board = await getLeaderboard(db);
    const me = board.find((s) => s.id === user.student_id);
    if (me) standing = { name: me.name, rank: me.rank, points: me.points, of: board.length };
  }

  const projects = (
    await db
      .prepare('SELECT id, title, track, repo_url, demo_url FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
      .bind(user.id)
      .all()
  ).results;
  const stats = await statsFor(db, user.id);
  const q = questProgress(stats);

  return c.json({
    user,
    standing,
    courses: courses.filter((x) => x.passed > 0),
    stepsPassed: rows.length,
    streak: streakOf(rows.map((r) => r.passed_at)),
    next,
    projects,
    meetings: stats.meetings,
    xp: q.xp,
    rank: q.rank,
    nextRank: q.next,
    // The closest unfinished quests, so the dashboard always has a next thing to do.
    quests: q.quests.filter((x) => !x.done).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3),
    questsDone: q.quests.filter((x) => x.done).length,
    questsTotal: q.quests.length,
  });
});
