/**
 * Officer analytics (G2). One endpoint, computed here so the page only draws.
 * Attendance is room_checkins: a person "came" to a meeting if they checked in
 * to its room. The pure maths (season bounds, retention, not-seen) is exported
 * for test/compete.test.js.
 */
import { Hono } from 'hono';

import { seasonOf } from '../../shared/points.js';

export const analyticsAdminRouter = new Hono();

const DAY = 86_400_000;
const dayMs = (v) => Date.parse(`${String(v).slice(0, 10)}T00:00:00Z`);
const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';

/** "2026-fall" -> { start, end } as 'YYYY-MM-DD' (end exclusive). Matches seasonOf in shared/points.js. */
export function seasonRange(season) {
  const m = /^(\d{4})-(fall|spring)$/.exec(season);
  if (!m) return null;
  const y = Number(m[1]);
  return m[2] === 'fall' ? { start: `${y}-06-01`, end: `${y + 1}-01-01` } : { start: `${y}-01-01`, end: `${y}-06-01` };
}

/**
 * Of the people who came in the first 30 days of meetings, how many came in
 * the last 4 weeks. The first month starts at the season's first meeting (not
 * June 1) because June and July have none. `meetings` is [{ date, userIds }].
 * `overlap` is true when the season is so young the two windows share days.
 */
export function retention(meetings, now = new Date()) {
  if (!meetings.length) return { base: 0, kept: 0, pct: null, firstMeeting: null, recentFrom: null, overlap: false };
  const first = Math.min(...meetings.map((m) => dayMs(m.date)));
  const today = dayMs(now.toISOString());
  const recentFrom = today - 28 * DAY;
  const base = new Set();
  const recent = new Set();
  for (const m of meetings) {
    const t = dayMs(m.date);
    for (const u of m.userIds) {
      if (t - first < 30 * DAY) base.add(u);
      if (t >= recentFrom && t <= today) recent.add(u);
    }
  }
  const kept = [...base].filter((u) => recent.has(u)).length;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return {
    base: base.size,
    kept,
    pct: base.size ? Math.round((kept / base.size) * 100) : null,
    firstMeeting: iso(first),
    recentFrom: iso(recentFrom),
    overlap: first + 30 * DAY > recentFrom,
  };
}

/**
 * Members whose most recent meeting was `weeks` or more ago, oldest first.
 * Whole days compared, so time of day never tips the edge: a meeting exactly 21
 * days back counts, 20 does not. `last` is [{ userId, name, last }].
 */
export function notSeen(last, now = new Date(), weeks = 3) {
  const today = dayMs(now.toISOString());
  return last
    .map((r) => ({ userId: r.userId, name: r.name, last: String(r.last).slice(0, 10), days: Math.floor((today - dayMs(r.last)) / DAY) }))
    .filter((r) => r.days >= weeks * 7)
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
}

export async function buildAnalytics(db, season, now = new Date()) {
  const range = seasonRange(season);
  const q = (sql, ...args) => db.prepare(sql).bind(...args).all().then((r) => r.results);

  const meetings = await q(
    `SELECT r.code, r.title, substr(r.created_at, 1, 10) AS date, COUNT(k.user_id) AS n
     FROM rooms r LEFT JOIN room_checkins k ON k.code = r.code
     WHERE r.created_at >= ? AND r.created_at < ? GROUP BY r.code ORDER BY r.created_at`,
    range.start,
    range.end
  );
  const checkins = await q(
    `SELECT r.code, k.user_id FROM room_checkins k JOIN rooms r ON r.code = k.code WHERE r.created_at >= ? AND r.created_at < ?`,
    range.start,
    range.end
  );
  const byCode = new Map(meetings.map((m) => [m.code, { date: m.date, userIds: [] }]));
  for (const c of checkins) byCode.get(c.code)?.userIds.push(c.user_id);

  const last = await q(
    `SELECT u.id AS userId, u.name, MAX(r.created_at) AS last FROM room_checkins k
     JOIN rooms r ON r.code = k.code JOIN users u ON u.id = k.user_id GROUP BY u.id`
  );
  const never = (
    await db.prepare('SELECT COUNT(*) AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM room_checkins k WHERE k.user_id = u.id)').first()
  ).n;
  const activity = await q(
    `SELECT kind, COUNT(*) AS n, COALESCE(SUM(points), 0) AS points FROM activity
     WHERE status = 'approved' AND created_at >= ? AND created_at < ? GROUP BY kind ORDER BY n DESC, kind`,
    range.start,
    range.end
  );
  const ideas = await q(
    `SELECT i.id, i.body, i.status, u.name AS author, (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id) AS votes
     FROM ideas i JOIN users u ON u.id = i.user_id WHERE i.status IN ('planned', 'done')
     ORDER BY (i.status = 'done'), votes DESC, i.id`
  );
  const seasons = [...new Set([seasonOf(now), ...(await q('SELECT created_at FROM rooms')).map((r) => seasonOf(r.created_at))])].sort().reverse();

  return {
    season,
    seasons,
    meetings,
    // A finished season is judged at its own end, not against today.
    retention: retention([...byCode.values()], new Date(Math.min(now.getTime(), dayMs(range.end) - DAY))),
    notSeen: notSeen(last.map((r) => ({ ...r, name: firstName(r.name) })), now),
    neverCame: never,
    activity,
    ideas: ideas.map((i) => ({ ...i, author: firstName(i.author) })),
  };
}

analyticsAdminRouter.get('/analytics', async (c) => {
  const season = c.req.query('season') || seasonOf(new Date());
  if (!seasonRange(season)) return c.json({ error: 'Season looks like 2026-fall or 2027-spring.' }, 400);
  return c.json(await buildAnalytics(c.env.DB, season));
});
