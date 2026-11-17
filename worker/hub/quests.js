/**
 * Quests: reads a member's activity out of the tables that already exist and
 * hands it to the pure rules in shared/quests.js. Nothing is written here.
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { LINES, questProgress } from '../../shared/quests.js';
import { requireUser } from './users.js';

export const questsRouter = new Hono();

const DAY = 86_400_000;
const dayKey = (iso) => Math.floor(new Date(iso.replace(' ', 'T') + 'Z').getTime() / DAY);

/** Consecutive days with a passed step, ending today or yesterday. */
export function streakOf(passedAts, now = Date.now()) {
  const days = new Set(passedAts.map(dayKey));
  let d = Math.floor(now / DAY);
  if (!days.has(d)) d -= 1; // not having practised yet today does not break it
  let n = 0;
  while (days.has(d)) {
    n++;
    d--;
  }
  return n;
}

/** Counts from passed step rows ([{ course, step, passed_at }]). Pure, so it is testable. */
export function stepStats(rows, courses = COURSES, now = Date.now()) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.course)) by.set(r.course, new Set());
    by.get(r.course).add(r.step);
  }
  let steps = 0;
  let coursesDone = 0;
  let flags = 0;
  const tracks = new Set();
  for (const course of courses) {
    const done = by.get(course.slug);
    if (!done) continue;
    // Count only steps that still exist, so a renamed step cannot inflate XP.
    const live = course.steps.filter((s) => done.has(s.id));
    if (!live.length) continue;
    steps += live.length;
    flags += live.filter((s) => s.kind === 'flag').length;
    tracks.add(course.track);
    if (live.length === course.steps.length) coursesDone++;
  }
  return { steps, coursesDone, flags, tracks: tracks.size, streak: streakOf(rows.map((r) => r.passed_at), now) };
}

export async function statsFor(db, userId) {
  const rows = (
    await db
      .prepare('SELECT course, step, passed_at FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL')
      .bind(userId)
      .all()
  ).results;
  const n = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM room_checkins WHERE user_id = ?1) AS meetings,
              (SELECT COUNT(*) FROM projects WHERE user_id = ?1 AND hidden = 0) AS projects,
              (SELECT COUNT(*) FROM ideas WHERE user_id = ?1 AND status != 'hidden') AS ideas,
              (SELECT student_id FROM users WHERE id = ?1) AS student_id`
    )
    .bind(userId)
    .first();
  return { ...stepStats(rows), meetings: n.meetings, projects: n.projects, ideas: n.ideas, linked: Boolean(n.student_id) };
}

questsRouter.get('/me/quests', requireUser, async (c) => {
  const stats = await statsFor(c.env.DB, c.get('user').id);
  return c.json({ lines: LINES, stats, ...questProgress(stats) });
});
