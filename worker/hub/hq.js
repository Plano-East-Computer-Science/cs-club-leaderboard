/**
 * Officer HQ (Wave 5): three read-only officer routes that gather what is
 * spread across the club's tables, so HQ's Home, Inbox and Members each load
 * in one call. Nothing here writes: approving, rejecting, awarding and closing
 * still go through the routes that own them (claims.js, editorials.js,
 * rooms.js, ...). Mounted on hubAdmin, so requireOfficer guards all of it.
 *
 *   GET /inbox   counts per kind and the newest items across the review queues
 *   GET /home    next meeting, readiness inputs, last meeting, inbox counts,
 *                drifting members, what is due this week
 *   GET /roster  every leaderboard entry with last seen and season points
 */
import { Hono } from 'hono';

import { loadRules } from './ledger.js';
import { PREVIEW } from './safety.js';
import { notSeen } from './analytics.js';
import { MEETING_KEYS, MEETING_DEFAULTS } from './club.js';
import { getAllSettings } from '../db.js';
import { seasonOf, seasonRange, POINT_LABELS } from '../../shared/points.js';
import { chicagoDate } from '../../shared/daily.js';
import { kindName } from '../../shared/planner.js';
import { INBOX_KINDS, readiness, nextWeekday, daysBetween, DIGEST_WEEKDAY, BACKUP_DAYS } from '../../shared/hq.js';

export const hqAdminRouter = new Hono();

const PER_KIND = 25;
const rows = (db, sql, ...args) => db.prepare(sql).bind(...args).all().then((r) => r.results);
const one = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to ms, so the screens can say "3 hours ago". */
const ms = (v) => (v == null ? null : typeof v === 'number' ? v : Date.parse(`${String(v).replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`) || null);
const meta = (s) => {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
};
const clip = (s, n = 240) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
};

/* ---------------------------------- inbox ---------------------------------- */

const COUNT_SQL = {
  claims: `SELECT COUNT(*) AS n FROM activity WHERE status = 'pending'`,
  editorials: `SELECT COUNT(*) AS n FROM editorials WHERE status = 'pending'`,
  ctf: `SELECT COUNT(*) AS n FROM ctf_challenges WHERE status = 'pending'`,
  links: `SELECT COUNT(*) AS n FROM link_requests`,
  reports: `SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`,
  opportunities: `SELECT COUNT(*) AS n FROM opportunities WHERE status = 'pending'`,
  alumni: `SELECT COUNT(*) AS n FROM alumni_questions q JOIN users u ON u.id = q.user_id WHERE q.status = 'new' AND u.deleted_at IS NULL`,
};

/** { claims: 2, editorials: 0, ... }, every kind present. */
export async function inboxCounts(db) {
  const out = {};
  for (const k of INBOX_KINDS) out[k] = (await one(db, COUNT_SQL[k]))?.n ?? 0;
  return out;
}

/**
 * The newest items of every kind, newest first. Each item is
 * { kind, id, who, what, detail, link, at, points } where `points` is what
 * approving would pay before caps (null when it pays nothing) and `at` is ms.
 */
export async function inboxItems(db) {
  const rules = await loadRules(db);
  const items = [];

  for (const a of await rows(
    db,
    `SELECT a.id, a.kind, a.meta, a.created_at, s.name AS student FROM activity a JOIN students s ON s.id = a.student_id
     WHERE a.status = 'pending' ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    PER_KIND
  )) {
    const m = meta(a.meta);
    const pts = a.kind === 'manual' ? Number(m.points) || 0 : rules[a.kind]?.points ?? 0;
    items.push({
      kind: 'claims',
      id: a.id,
      who: a.student,
      what: `${POINT_LABELS[a.kind] ?? a.kind}${m.title ? `: ${m.title}` : ''}${m.place ? ` (place ${m.place})` : ''}`,
      detail: clip(m.note),
      link: m.proof_url || null,
      at: ms(a.created_at),
      points: pts || null,
    });
  }

  for (const e of await rows(
    db,
    `SELECT e.id, e.slug, e.body, e.created_at, u.name AS author, p.title FROM editorials e
     JOIN users u ON u.id = e.user_id LEFT JOIN problems p ON p.slug = e.slug
     WHERE e.status = 'pending' ORDER BY e.id DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({ kind: 'editorials', id: e.id, who: e.author, what: `Editorial for ${e.title ?? e.slug}`, detail: clip(e.body), link: `/p/${e.slug}`, at: ms(e.created_at), points: rules.mentor.points });
  }

  for (const c of await rows(
    db,
    `SELECT id, title, category, difficulty, body, author_name, created_at FROM ctf_challenges WHERE status = 'pending' ORDER BY id DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({
      kind: 'ctf',
      id: c.id,
      who: c.author_name || 'Member',
      what: `CTF challenge: ${c.title}`,
      detail: clip(`${c.category}, difficulty ${c.difficulty}. ${c.body ?? ''}`),
      link: null,
      at: ms(c.created_at),
      points: rules.ship.points,
    });
  }

  for (const l of await rows(
    db,
    `SELECT r.user_id, r.created_at, u.name AS user_name, u.email, s.name AS student_name FROM link_requests r
     JOIN users u ON u.id = r.user_id JOIN students s ON s.id = r.student_id ORDER BY r.created_at DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({ kind: 'links', id: l.user_id, who: l.user_name, what: `Wants to be ${l.student_name} on the board`, detail: l.email, link: null, at: ms(l.created_at), points: null });
  }

  for (const r of await rows(
    db,
    `SELECT r.id, r.kind, r.reason, r.created_at, ru.name AS reporter, ${PREVIEW}
     FROM reports r LEFT JOIN users ru ON ru.id = r.reporter_user_id
     WHERE r.status = 'open' ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({
      kind: 'reports',
      id: r.id,
      who: r.reporter || 'A member',
      what: `Reported ${r.kind.replace('_', ' ')}${r.author ? ` by ${r.author}` : ''}: ${clip(r.reason, 120)}`,
      detail: clip(r.content),
      link: null,
      at: ms(r.created_at),
      points: null,
    });
  }

  for (const o of await rows(
    db,
    `SELECT id, title, org, description, url, deadline, created_at FROM opportunities WHERE status = 'pending' ORDER BY created_at DESC, id DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({
      kind: 'opportunities',
      id: o.id,
      who: o.org || 'The weekly scraper',
      what: o.title,
      detail: clip(`${o.deadline ? `Closes ${new Date(`${o.deadline}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}. ` : ''}${o.description ?? ''}`),
      link: o.url || null,
      at: ms(o.created_at),
      points: null,
    });
  }

  for (const q of await rows(
    db,
    `SELECT q.id, q.question, q.created_at, a.name AS alumni_name, a.contact, u.name AS member
     FROM alumni_questions q JOIN alumni a ON a.id = q.alumni_id JOIN users u ON u.id = q.user_id
     WHERE q.status = 'new' AND u.deleted_at IS NULL ORDER BY q.created_at DESC LIMIT ?`,
    PER_KIND
  )) {
    items.push({
      kind: 'alumni',
      id: q.id,
      who: q.member,
      what: `Question for ${q.alumni_name}`,
      detail: clip(`${q.question}${q.contact ? ` (forward to ${q.contact})` : ''}`, 400),
      link: null,
      at: ms(q.created_at),
      points: null,
    });
  }

  return items.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

hqAdminRouter.get('/inbox', async (c) => {
  const db = c.env.DB;
  const counts = await inboxCounts(db);
  return c.json({ counts, total: Object.values(counts).reduce((n, v) => n + v, 0), items: await inboxItems(db) });
});

/* --------------------------------- roster --------------------------------- */

/**
 * Every leaderboard entry with what an officer needs to find someone: the
 * linked account, season and all-time points, the last check-in and the last
 * time they were seen at all (a check-in or any point award). Leaderboard-only
 * entries with point history count, so nobody drifts off unseen.
 */
export async function roster(db, now = new Date()) {
  const range = seasonRange(seasonOf(now));
  const list = await rows(
    db,
    `SELECT s.id, s.name, s.grade, s.active, s.joined_at,
            (SELECT u.id FROM users u WHERE u.student_id = s.id AND u.deleted_at IS NULL LIMIT 1) AS user_id,
            (SELECT u.email FROM users u WHERE u.student_id = s.id AND u.deleted_at IS NULL LIMIT 1) AS email,
            (SELECT COALESCE(SUM(e.delta), 0) FROM point_events e WHERE e.student_id = s.id) AS points,
            (SELECT COALESCE(SUM(e.delta), 0) FROM point_events e WHERE e.student_id = s.id AND e.created_at >= ? AND e.created_at < ?) AS season_points,
            (SELECT MAX(e.created_at) FROM point_events e WHERE e.student_id = s.id) AS last_points,
            (SELECT MAX(k.joined_at) FROM room_checkins k JOIN users u ON u.id = k.user_id WHERE u.student_id = s.id) AS last_checkin
     FROM students s ORDER BY s.active DESC, s.name`,
    range.start,
    range.end
  );
  return list.map((s) => {
    const last = [s.last_points, s.last_checkin].filter(Boolean).sort().pop() ?? null;
    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      active: Boolean(s.active),
      joinedAt: s.joined_at,
      userId: s.user_id,
      email: s.email,
      points: s.points,
      seasonPoints: s.season_points,
      lastCheckin: ms(s.last_checkin),
      lastSeen: ms(last),
      lastSeenDate: last ? String(last).slice(0, 10) : null,
    };
  });
}

/** Active entries not seen in 3+ weeks, longest gone first. Entries never seen at all are left out. */
export const drifting = (list, now = new Date()) =>
  notSeen(
    list.filter((s) => s.active && s.lastSeenDate).map((s) => ({ userId: s.id, name: s.name, last: s.lastSeenDate })),
    now
  ).map((r) => ({ id: r.userId, name: r.name, last: r.last, days: r.days }));

hqAdminRouter.get('/roster', async (c) => {
  const now = new Date();
  const list = await roster(c.env.DB, now);
  const gone = new Set(drifting(list, now).map((d) => d.id));
  return c.json({ season: seasonOf(now), members: list.map((m) => ({ ...m, drifting: gone.has(m.id) })) });
});

/* -------------------------------- meetings -------------------------------- */

/** Columns for a room row: who came, who did something, and what closing paid. */
const ROOM_COLS = `r.code, r.title, r.kind, r.template, r.created_at, r.closed_at, r.takeaways,
  (SELECT COUNT(*) FROM room_checkins k WHERE k.code = r.code) AS attendees,
  (SELECT COUNT(k.exit_kind) FROM room_checkins k WHERE k.code = r.code) AS eligible,
  (SELECT COALESCE(SUM(a.points), 0) FROM activity a WHERE a.ref = 'room:' || r.code AND a.status = 'approved') AS paid,
  (SELECT COUNT(DISTINCT a.student_id) FROM activity a WHERE a.ref = 'room:' || r.code AND a.status = 'approved' AND a.kind IN ('attend', 'dropin')) AS paidMembers`;
const roomShape = (r) => ({ ...r, created_at: ms(r.created_at), closed_at: ms(r.closed_at) });

/** Rooms for the Meetings timeline, newest first. Plans come from GET /planner. */
hqAdminRouter.get('/meetings', async (c) => {
  const rooms = (await rows(c.env.DB, `SELECT ${ROOM_COLS} FROM rooms r ORDER BY r.created_at DESC LIMIT 40`)).map(roomShape);
  // The club day, so a new plan starts on the next one instead of today.
  const day = String((await one(c.env.DB, `SELECT value FROM settings WHERE key = 'meeting_day'`))?.value ?? '').trim() || MEETING_DEFAULTS.meeting_day;
  return c.json({ rooms, meetingDay: day });
});

/* ---------------------------------- home ---------------------------------- */

hqAdminRouter.get('/home', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const today = chicagoDate(now);
  const settings = await getAllSettings(db);
  const meeting = Object.fromEntries(MEETING_KEYS.map((k) => [k.replace('meeting_', ''), String(settings[k] ?? '').trim() || MEETING_DEFAULTS[k]]));

  const planRow = await one(db, 'SELECT * FROM planned_sessions WHERE date >= ? AND room_code IS NULL ORDER BY date, id LIMIT 1', today);
  const packs = (await one(db, `SELECT COUNT(*) AS n FROM problem_sets WHERE kind = 'duel' AND status = 'live'`))?.n ?? 0;
  let next = null;
  if (planRow) {
    const plan = { id: planRow.id, date: planRow.date, title: planRow.title, template: planRow.template, blocks: meta(planRow.blocks), roomCode: planRow.room_code };
    if (!Array.isArray(plan.blocks)) plan.blocks = [];
    next = {
      id: plan.id,
      date: plan.date,
      title: plan.title,
      kind: kindName(plan.template),
      minutes: plan.blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0),
      blocks: plan.blocks.length,
      isToday: plan.date === today,
      inDays: daysBetween(today, plan.date),
      checks: readiness(plan, { packs }),
    };
  }

  const open = (await rows(db, `SELECT ${ROOM_COLS} FROM rooms r WHERE r.closed_at IS NULL ORDER BY r.created_at DESC LIMIT 5`)).map(roomShape);
  const lastRow = await one(db, `SELECT ${ROOM_COLS} FROM rooms r WHERE r.closed_at IS NOT NULL AND r.kind = 'meeting' ORDER BY r.closed_at DESC LIMIT 1`);

  const list = await roster(db, now);
  const drift = drifting(list, now);
  const backup = await one(db, `SELECT MAX(ts) AS ts FROM officer_log WHERE action = 'backup'`);
  const digestDate = nextWeekday(today, DIGEST_WEEKDAY);
  const counts = await inboxCounts(db);

  return c.json({
    today,
    meeting,
    next,
    open,
    last: lastRow ? roomShape(lastRow) : null,
    inbox: { counts, total: Object.values(counts).reduce((n, v) => n + v, 0) },
    drifting: { total: drift.length, members: drift.slice(0, 8) },
    due: {
      digest: { date: digestDate, inDays: daysBetween(today, digestDate) },
      backup: { last: backup?.ts ?? null, due: !backup?.ts || now.getTime() - backup.ts > BACKUP_DAYS * 86_400_000 },
    },
  });
});
