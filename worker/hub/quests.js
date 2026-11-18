/**
 * Quests: reads a member's activity out of the tables that already exist and
 * hands it to the pure rules in shared/quests.js. Since A4 a finished quest is
 * written to the ledger as a `quest` activity (syncQuests).
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { LINES, questProgress } from '../../shared/quests.js';
import { requireUser } from './users.js';
import { recordActivity, loadRules } from './ledger.js';
import { getLeaderboard } from '../db.js';
import { seasonOf } from '../../shared/points.js';
import { rankInfo } from './standings.js';

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
      `SELECT (SELECT COUNT(*) FROM room_checkins WHERE user_id = ?) AS meetings,
              (SELECT COUNT(*) FROM projects WHERE user_id = ? AND hidden = 0) AS projects,
              (SELECT COUNT(*) FROM ideas WHERE user_id = ? AND status != 'hidden') AS ideas,
              (SELECT student_id FROM users WHERE id = ?) AS student_id`
    )
    .bind(userId, userId, userId, userId)
    .first();
  return { ...stepStats(rows), meetings: n.meetings, projects: n.projects, ideas: n.ideas, studentId: n.student_id };
}

/**
 * A4: records a `quest` activity for every finished quest not yet on the
 * ledger, which pays the small, season-capped bonus from shared/points.js.
 * The ref is the quest id, so each quest pays at most once, ever. Called after
 * anything that can finish a quest and when the quests page loads. Points must
 * never break the action that earned them, so a failure is logged, not thrown.
 * Returns { stats, paid: Map(questId -> points) }.
 */
export async function syncQuests(db, userId) {
  const stats = await statsFor(db, userId);
  const paid = new Map();
  if (!stats.studentId) return { stats, paid };
  try {
    const had = (await db.prepare(`SELECT ref, points FROM activity WHERE student_id = ? AND kind = 'quest'`).bind(stats.studentId).all()).results;
    had.forEach((r) => paid.set(r.ref, r.points));
    for (const q of questProgress(stats).quests) {
      if (!q.done || paid.has(q.id)) continue;
      const r = await recordActivity(db, { studentId: stats.studentId, kind: 'quest', ref: q.id, meta: { title: q.title } });
      paid.set(q.id, r.awarded);
    }
  } catch (err) {
    console.error('[quests]', err?.message ?? err);
  }
  return { stats, paid };
}

questsRouter.get('/me/quests', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { stats, paid } = await syncQuests(db, user.id);
  const rule = (await loadRules(db)).quest;
  const season = seasonOf(new Date());
  const me = user.student_id ? (await getLeaderboard(db, season)).find((r) => r.id === user.student_id) : null;
  return c.json({
    lines: LINES,
    stats,
    quests: questProgress(stats).quests.map((q) => ({ ...q, points: paid.get(q.id) ?? null })),
    bonus: rule.points,
    seasonCap: rule.seasonPoints,
    points: me?.points ?? 0,
    lifetime: me?.lifetime ?? 0,
    ...rankInfo(me),
  });
});
