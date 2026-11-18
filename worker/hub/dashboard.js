/**
 * Today (F1): the signed-in home, ranked. The next meeting, one next action
 * chosen here on the server, the season strip, and the small blocks below.
 * One request so the page paints in a single round trip.
 *
 * Also the compass answers (E1) and feed kudos (F2), since Today is the only
 * screen that writes them.
 */
import { Hono } from 'hono';

import { COURSES } from '../../shared/courses.js';
import { seasonOf, toDate, sqlTime } from '../../shared/points.js';
import { PATHS, BLOCK_ORDER, cleanAnswers, derivePath } from '../../shared/compass.js';
import { requireUser } from './users.js';
import { questProgress } from '../../shared/quests.js';
import { statsFor, streakOf } from './quests.js';
import { problemFor } from './daily.js';
import { chicagoDate } from '../../shared/daily.js';
import { getLeaderboard } from '../db.js';
import { rankInfo } from './standings.js';
import { nextPublicPlan } from './planner.js';
import { whenLabel } from '../../shared/planner.js';
import { pathwayNextFor } from './pathways.js';

export { streakOf };

export const dashboardRouter = new Hono();

const CHECK_CTA = { projects: 'Post a project', ideas: 'Open the ideas board', meetings: 'Join a room' };
const ORDER = {
  contest: ['daily', 'arena', 'firsts'],
  builder: ['firsts', 'daily', 'arena'],
  ai: ['arena', 'firsts', 'daily'],
  data: ['arena', 'firsts', 'daily'],
  cyber: ['arena', 'firsts', 'daily'],
  explorer: ['daily', 'firsts', 'arena'],
};

/**
 * The one next action. Pure, so every persona is testable.
 *   compassDone  answered or skipped the compass
 *   path         one of PATHS, or null (treated as explorer)
 *   openClaim    { id, title } an opportunity you marked whose deadline passed, unclaimed
 *   daily        { available, done } the daily problem exists / you solved it today
 *   arena        falsy when the Arena board is empty, else { rung: { title } | null } (a started, unfinished rung)
 *   firsts       the path's first things: [{ title, to, course?, check?, done, started }]
 *   quest        the unfinished quest closest to done, or null
 *   pathway      E5: { pathway: { id, title }, step: { title }, n, total } from a pathway you follow, or null.
 *                Following one is an explicit choice, so it beats what the compass path would suggest.
 * Returns { kind, title, why, to, cta, oppId? }.
 */
export function pickNext({ compassDone, path, openClaim, daily, arena, firsts = [], quest, pathway }) {
  if (!compassDone)
    return { kind: 'compass', title: 'Find your path', why: 'Six quick questions. Today changes to fit your answers.', to: '/compass', cta: 'Start the compass' };
  if (openClaim)
    return {
      kind: 'claim',
      title: `Did you compete in ${openClaim.title}?`,
      why: 'You marked it and the deadline has passed. Claim it and an officer will confirm the points.',
      to: '/?claim=1',
      cta: 'I competed',
      oppId: openClaim.id,
      oppTitle: openClaim.title,
    };
  if (pathway)
    return {
      kind: 'pathway',
      title: pathway.step.title,
      why: `Step ${pathway.n} of ${pathway.total} on your ${pathway.pathway.title} pathway.`,
      to: `/pathways/${pathway.pathway.id}`,
      cta: 'Open the pathway',
    };
  const p = PATHS[path] ? path : 'explorer';
  const tracked = firsts.filter((f) => f.course || f.check);
  const candidates = {
    daily: () =>
      daily?.available && !daily.done
        ? { kind: 'daily', title: "Solve today's problem", why: 'One short problem. It counts toward your week.', to: '/daily', cta: 'Open the problem' }
        : null,
    arena: () => {
      if (!arena) return null;
      if (arena.rung)
        return { kind: 'arena', title: arena.rung.title, why: 'You started this rung on the Arena. Finish it to move up the ladder.', to: '/arena', cta: 'Back to the rung' };
      return { kind: 'arena', title: 'Climb your next rung', why: `Your ${PATHS[p].name.toLowerCase()} ladder picks up where you stopped.`, to: '/arena', cta: 'Open the Arena' };
    },
    firsts: () => {
      const f = tracked.find((x) => !x.done);
      if (!f) return null;
      const n = firsts.indexOf(f) + 1;
      return {
        kind: 'path',
        title: f.title,
        why: `Step ${n} of ${firsts.length} on the ${PATHS[p].name} path.`,
        to: f.to,
        cta: f.course ? (f.started ? 'Continue the lesson' : 'Start the lesson') : CHECK_CTA[f.check] ?? 'Open',
      };
    },
  };
  for (const k of ORDER[p]) {
    const hit = candidates[k]();
    if (hit) return hit;
  }
  if (quest) return { kind: 'quest', title: quest.title, why: `${quest.have} of ${quest.need} done. ${quest.desc}`, to: quest.to, cta: 'Finish the quest' };
  return { kind: 'idle', title: 'Pick the next meeting', why: 'Nothing is waiting on you. Vote on what the club runs next.', to: '/ideas', cta: 'Open the ideas board' };
}

/** [start, end) of a season as SQLite text times. Spring is Jan to May, fall is June to December. */
export function seasonRange(now = new Date()) {
  const [y, half] = seasonOf(now).split('-');
  return half === 'spring' ? [`${y}-01-01 00:00:00`, `${y}-06-01 00:00:00`] : [`${y}-06-01 00:00:00`, `${Number(y) + 1}-01-01 00:00:00`];
}

/** Monday 00:00 UTC of this week, matching the ledger's weekly caps. */
export function weekStart(now = new Date()) {
  const d = toDate(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return sqlTime(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

/**
 * You and up to two either side, from rows sorted by points. Ties share a rank.
 * Others show first names only: Today is not the standings page.
 */
export function neighbours(rows, me) {
  let last = null;
  let rank = 0;
  const ranked = rows.map((r, i) => {
    if (r.points !== last) rank = i + 1;
    last = r.points;
    return { ...r, rank };
  });
  const i = ranked.findIndex((r) => r.id === me);
  if (i < 0) return { rank: null, of: ranked.length, near: [] };
  const near = ranked.slice(Math.max(0, i - 2), i + 3).map((r) => ({
    rank: r.rank,
    name: String(r.name ?? '').trim().split(/\s+/)[0] || 'Member',
    points: r.points,
    me: r.id === me,
  }));
  return { rank: ranked[i].rank, of: ranked.length, near };
}

/** Compass path to Arena track (shared/board.js names). */
const TRACK = { contest: 'contest', builder: 'build', ai: 'ai', data: 'data', cyber: 'cyber' };

dashboardRouter.get('/me/dashboard', requireUser, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const me = await db.prepare('SELECT path, compass_at FROM users WHERE id = ?').bind(user.id).first();
  const path = PATHS[me?.path] ? me.path : null;

  /* 1. next meeting: a live room, else what officers wrote on the Join page */
  // ponytail: a room left open overnight would show as live; the 8 hour window hides it. G1 planned sessions replace the fallback.
  const live = await db
    .prepare(
      `SELECT r.code, r.title, r.created_at,
              EXISTS (SELECT 1 FROM room_checkins k WHERE k.code = r.code AND k.user_id = ?) AS here
       FROM rooms r WHERE r.closed_at IS NULL AND r.created_at > datetime('now', '-8 hours')
       ORDER BY r.created_at DESC LIMIT 1`
    )
    .bind(user.id)
    .first();
  let meeting = { kind: 'none' };
  if (live) meeting = { kind: 'live', code: live.code, title: live.title, since: live.created_at, here: Boolean(live.here) };
  else {
    // G1: the next planned session (member-safe fields only), else what officers wrote on the Join page
    const plan = await nextPublicPlan(db);
    const info = (await db.prepare(`SELECT value FROM settings WHERE key = 'join_meeting_info'`).first())?.value?.trim();
    if (plan) meeting = { kind: 'planned', info: `${whenLabel(plan.date)}: ${plan.title} (${plan.kind})`, plan: { date: plan.date, title: plan.title, kind: plan.kind }, extra: info || '' };
    else if (info) meeting = { kind: 'planned', info };
  }

  /* 2. next action */
  const steps = (
    await db.prepare('SELECT course, step, passed_at FROM step_progress WHERE user_id = ? AND passed_at IS NOT NULL').bind(user.id).all()
  ).results;
  const stats = await statsFor(db, user.id);
  const q = questProgress(stats);
  const life = user.student_id ? (await getLeaderboard(db, 'all')).find((r) => r.id === user.student_id) : null;
  const passed = (slug) => new Set(steps.filter((s) => s.course === slug).map((s) => s.step)).size;
  const firsts = PATHS[path ?? 'explorer'].first.map((f) => {
    if (f.course) {
      const total = COURSES.find((x) => x.slug === f.course)?.steps.length ?? 0;
      const n = passed(f.course);
      return { ...f, started: n > 0, done: total > 0 && n >= total };
    }
    return { ...f, done: f.check ? (stats[f.check] ?? 0) > 0 : false };
  });

  // Daily problem (C3): offered when the bank has one today and you have not solved it.
  const dailyDate = chicagoDate(now);
  const dailyOn = Boolean(await problemFor(db, dailyDate));
  const dailyDone = dailyOn && Boolean(await db.prepare('SELECT 1 AS x FROM daily_results WHERE user_id = ? AND date = ?').bind(user.id, dailyDate).first());
  // Arena (C1): offered when the board has rungs; an unfinished one on your track comes back first.
  const arenaOn = Boolean(await db.prepare('SELECT 1 AS x FROM rungs WHERE hidden = 0 LIMIT 1').first());
  const rung = arenaOn
    ? await db
        .prepare(
          `SELECT r.title FROM rung_progress g JOIN rungs r ON r.id = g.rung_id AND r.hidden = 0
           WHERE g.user_id = ? AND g.status = 'started' ORDER BY r.track = ? DESC, r.difficulty LIMIT 1`
        )
        .bind(user.id, TRACK[path] ?? 'contest')
        .first()
    : null;
  const openClaim = await db
    .prepare(
      `SELECT o.id, o.title FROM opportunity_interest i JOIN opportunities o ON o.id = i.opportunity_id
       WHERE i.user_id = ? AND o.deadline IS NOT NULL AND o.deadline < ? AND o.deadline >= date(?, '-60 days')
         AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.student_id = ? AND a.kind = 'compete' AND a.ref = 'opp:' || o.id)
       ORDER BY o.deadline DESC LIMIT 1`
    )
    .bind(user.id, today, today, user.student_id ?? 0)
    .first();
  const open = q.quests.filter((x) => !x.done && x.have > 0).sort((a, b) => b.have / b.need - a.have / a.need);

  const next = pickNext({
    compassDone: Boolean(me?.compass_at),
    path,
    openClaim,
    daily: { available: dailyOn, done: dailyDone },
    arena: arenaOn && { rung },
    firsts,
    quest: open[0] ?? null,
    pathway: await pathwayNextFor(db, user),
  });

  /* 3. season strip */
  const [from, to] = seasonRange(now);
  const board = (
    await db
      .prepare(
        `SELECT s.id, s.name, COALESCE(SUM(e.delta), 0) AS points
         FROM students s LEFT JOIN point_events e ON e.student_id = s.id AND e.created_at >= ? AND e.created_at < ?
         WHERE s.active = 1 GROUP BY s.id ORDER BY points DESC, s.name`
      )
      .bind(from, to)
      .all()
  ).results;
  const standing = neighbours(board, user.student_id);
  const week = user.student_id
    ? (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM activity WHERE student_id = ? AND status = 'approved' AND created_at >= ?`)
          .bind(user.student_id, weekStart(now))
          .first()
      ).n
    : 0;

  /* 5. small blocks */
  const deadlines = (
    await db
      .prepare(
        `SELECT o.id, o.title, o.deadline FROM opportunity_interest i JOIN opportunities o ON o.id = i.opportunity_id
         WHERE i.user_id = ? AND (o.deadline IS NULL OR o.deadline >= ?)
         ORDER BY o.deadline IS NULL, o.deadline LIMIT 4`
      )
      .bind(user.id, today)
      .all()
  ).results;
  const projects = (
    await db.prepare('SELECT id, title, track FROM projects WHERE user_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 3').bind(user.id).all()
  ).results;

  return c.json({
    user: { id: user.id, name: user.name, student_id: user.student_id },
    path,
    compassDue: !me?.compass_at,
    meeting,
    next,
    season: { id: seasonOf(now), points: board.find((r) => r.id === user.student_id)?.points ?? 0, week, ...standing },
    order: BLOCK_ORDER[path ?? 'explorer'],
    deadlines,
    projects,
    meetings: stats.meetings,
    // A4: no XP; the rank is the lifetime label from the ledger.
    quests: { points: life?.lifetime ?? 0, ...rankInfo(life), done: q.quests.filter((x) => x.done).length, total: q.quests.length, open: open.slice(0, 2) },
  });
});

/* ---------------------------------- compass (E1) --------------------------------- */

dashboardRouter.get('/me/compass', requireUser, async (c) => {
  const row = await c.env.DB.prepare('SELECT compass, path, compass_at FROM users WHERE id = ?').bind(c.get('user').id).first();
  let answers = null;
  try {
    answers = row?.compass ? JSON.parse(row.compass) : null;
  } catch {
    answers = null;
  }
  return c.json({ answers, path: row?.path ?? null, at: row?.compass_at ?? null });
});

dashboardRouter.put('/me/compass', requireUser, async (c) => {
  const body = await c.req.json().catch(() => null);
  const { answers, error } = cleanAnswers(body?.answers);
  if (error) return c.json({ error }, 400);
  const path = derivePath(answers);
  await c.env.DB
    .prepare(`UPDATE users SET compass = ?, path = ?, compass_at = datetime('now') WHERE id = ?`)
    .bind(JSON.stringify(answers), path, c.get('user').id)
    .run();
  return c.json({ path });
});

/** Skipping counts as answered (so Today stops sending you there) and leaves you an explorer. */
dashboardRouter.post('/me/compass/skip', requireUser, async (c) => {
  await c.env.DB
    .prepare(`UPDATE users SET path = COALESCE(path, 'explorer'), compass_at = COALESCE(compass_at, datetime('now')) WHERE id = ?`)
    .bind(c.get('user').id)
    .run();
  return c.json({ ok: true });
});

/* ----------------------------------- kudos (F2) ---------------------------------- */

async function kudosTarget(c) {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) return { error: c.json({ error: 'No such activity.' }, 404) };
  const act = await c.env.DB.prepare(`SELECT id, student_id FROM activity WHERE id = ? AND status = 'approved' AND hidden = 0`).bind(id).first();
  if (!act) return { error: c.json({ error: 'No such activity.' }, 404) };
  return { act };
}

const kudosCount = async (db, id) => (await db.prepare('SELECT COUNT(*) AS n FROM kudos WHERE activity_id = ?').bind(id).first()).n;

dashboardRouter.post('/feed/:id/kudos', requireUser, async (c) => {
  const { act, error } = await kudosTarget(c);
  if (error) return error;
  const user = c.get('user');
  if (act.student_id === user.student_id) return c.json({ error: 'That one is yours. Kudos are for clubmates.' }, 403);
  await c.env.DB.prepare('INSERT OR IGNORE INTO kudos (activity_id, user_id) VALUES (?, ?)').bind(act.id, user.id).run();
  return c.json({ kudos: await kudosCount(c.env.DB, act.id), mine: true });
});

dashboardRouter.delete('/feed/:id/kudos', requireUser, async (c) => {
  const { act, error } = await kudosTarget(c);
  if (error) return error;
  await c.env.DB.prepare('DELETE FROM kudos WHERE activity_id = ? AND user_id = ?').bind(act.id, c.get('user').id).run();
  return c.json({ kudos: await kudosCount(c.env.DB, act.id), mine: false });
});
