/**
 * Handoff (G4): the year archive, the officer application, and contribution
 * based eligibility, so officer positions are earned visibly and the club
 * outlives its current officers.
 *
 * The archive is built from existing tables only (rooms, check-ins, the ledger,
 * competitions, projects); officers add one short written summary per year. It
 * is public, so it shows first names (publicName / PUBLIC_NAME_SQL, G5) and
 * nothing a member did not already make public.
 *
 * Applications are private to the member and officers. Policy: any member may
 * apply while the window is open, and officers see the eligibility summary next
 * to the answers. Gating on eligibility would lock everyone out in a young club;
 * showing it keeps the decision visible without a rule that can be gamed.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { hitOrRefuse } from './ratelimit.js';
import { publicName, PUBLIC_NAME_SQL } from './names.js';
import { byTemplate } from './analytics.js';
import { getSetting, setSetting } from '../db.js';
import {
  schoolYearOf, yearRange, yearLabel, eligibility, thresholdsFrom, cleanThresholds, cleanAnswers, DEFAULT_THRESHOLDS, QUESTIONS,
} from '../../shared/handoff.js';

export const handoffRouter = new Hono();
export const handoffAdminRouter = new Hono();

const SUMMARY_MAX = 1500;
const NOTE_MAX = 300;
const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const parse = (s) => {
  try { return JSON.parse(s); } catch { return {}; }
};

/** One member's counts for a school year, the input to eligibility(). */
export async function gatherRecord(db, userId, studentId, year) {
  const { start, end } = yearRange(year);
  const one = async (sql, ...args) => (await db.prepare(sql).bind(...args).first()).n;
  return {
    meetings: await one(
      `SELECT COUNT(*) AS n FROM room_checkins k JOIN rooms r ON r.code = k.code
       WHERE k.user_id = ? AND r.kind = 'meeting' AND r.created_at >= ? AND r.created_at < ?`, userId, start, end),
    mentor: studentId
      ? await one(`SELECT COUNT(*) AS n FROM activity WHERE student_id = ? AND kind = 'mentor' AND status = 'approved' AND created_at >= ? AND created_at < ?`, studentId, start, end)
      : 0,
    content:
      (await one(`SELECT COUNT(*) AS n FROM editorials WHERE user_id = ? AND status = 'accepted' AND created_at >= ? AND created_at < ?`, userId, start, end)) +
      (await one(`SELECT COUNT(*) AS n FROM ctf_challenges WHERE author_user_id = ? AND status = 'live' AND created_at >= ? AND created_at < ?`, userId, start, end)),
    reviews: await one(`SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND status != 'hidden' AND created_at >= ? AND created_at < ?`, userId, start, end),
    // exit_kind 'show' (presented) and 'help' (answered the help queue) are the ways a member runs part of a meeting.
    hosted: await one(
      `SELECT COUNT(*) AS n FROM room_checkins k JOIN rooms r ON r.code = k.code
       WHERE k.user_id = ? AND k.exit_kind IN ('show', 'help') AND r.created_at >= ? AND r.created_at < ?`, userId, start, end),
  };
}

const thresholds = async (db) => thresholdsFrom(await getSetting(db, 'handoff_thresholds', ''));
const windowOpen = async (db) => (await getSetting(db, 'handoff_open', '0')) === '1';

/* --------------------------------- archive --------------------------------- */

/** Top three first names for one category: [{ name, n }]. kinds comes from a fixed list, never input. */
async function top(db, kinds, range) {
  const marks = kinds.map(() => '?').join(',');
  return rows(
    db,
    `SELECT ${PUBLIC_NAME_SQL} AS name, COUNT(*) AS n FROM activity a JOIN students s ON s.id = a.student_id
     WHERE a.kind IN (${marks}) AND a.status = 'approved' AND a.created_at >= ? AND a.created_at < ? AND s.name != 'Former member'
     GROUP BY s.id ORDER BY n DESC, name LIMIT 3`,
    ...kinds, range.start, range.end
  );
}

export async function buildArchive(db, year) {
  const range = yearRange(year);
  const meetings = await rows(
    db,
    `SELECT r.kind, r.template, COUNT(k.user_id) AS n FROM rooms r LEFT JOIN room_checkins k ON k.code = r.code
     WHERE r.created_at >= ? AND r.created_at < ? GROUP BY r.code`,
    range.start, range.end
  );
  const real = meetings.filter((m) => m.kind !== 'dropin');
  const people = (
    await db.prepare(
      `SELECT COUNT(DISTINCT k.user_id) AS n FROM room_checkins k JOIN rooms r ON r.code = k.code
       WHERE r.created_at >= ? AND r.created_at < ?`
    ).bind(range.start, range.end).first()
  ).n;
  const [d0, d1] = [range.start.slice(0, 10), range.end.slice(0, 10)];
  const competitions = await rows(
    db,
    `SELECT c.name, c.result, c.event_date, (SELECT COUNT(*) FROM competition_roster p WHERE p.competition_id = c.id AND p.placement IS NOT NULL) AS placed
     FROM competitions c WHERE c.status = 'past' AND c.event_date >= ? AND c.event_date < ? ORDER BY c.event_date`,
    d0, d1
  );
  const projects = await rows(
    db,
    `SELECT p.title, u.name, u.show_full_name FROM projects p JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
     WHERE p.hidden = 0 AND p.created_at >= ? AND p.created_at < ? ORDER BY p.created_at, p.id`,
    range.start, range.end
  );
  const summary = await db.prepare('SELECT body, updated_at FROM year_summaries WHERE year = ?').bind(year).first();
  return {
    year,
    label: yearLabel(year),
    current: schoolYearOf(new Date()) === year,
    summary: summary?.body ?? '',
    totals: { meetings: real.length, dropins: meetings.length - real.length, checkins: real.reduce((n, m) => n + m.n, 0), people },
    templates: byTemplate(real.map((m) => ({ ...m, n: m.n }))),
    competitions,
    placements: competitions.reduce((n, c) => n + c.placed, 0),
    projects: { count: projects.length, list: projects.slice(0, 12).map((p) => ({ title: p.title, by: publicName(p.name, p.show_full_name) })) },
    top: {
      attendance: await top(db, ['attend'], range),
      mentoring: await top(db, ['mentor'], range),
      projects: await top(db, ['ship'], range),
      competing: await top(db, ['compete', 'place'], range),
    },
  };
}

/** Years worth listing: the current one, and every year with a meeting or a written summary. Newest first. */
async function archiveYears(db) {
  const set = new Set([schoolYearOf(new Date())]);
  for (const r of await rows(db, 'SELECT created_at FROM rooms')) set.add(schoolYearOf(r.created_at));
  for (const r of await rows(db, 'SELECT year FROM year_summaries')) set.add(r.year);
  return [...set].sort().reverse();
}

handoffRouter.get('/archive', async (c) => {
  const years = await archiveYears(c.env.DB);
  return c.json({ years: years.map((y) => ({ year: y, label: yearLabel(y) })) });
});

handoffRouter.get('/archive/:year', async (c) => {
  const year = c.req.param('year');
  if (!yearRange(year)) return c.json({ error: 'A school year looks like 2026.' }, 400);
  return c.json(await buildArchive(c.env.DB, year));
});

/* ------------------------------ member: apply ------------------------------ */

const mineFor = (db, userId, year) =>
  db.prepare('SELECT id, answers, status, created_at, updated_at FROM officer_applications WHERE user_id = ? AND year = ?').bind(userId, year).first();

handoffRouter.get('/handoff/me', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const year = schoolYearOf(new Date());
  const th = await thresholds(db);
  const mine = await mineFor(db, user.id, year);
  return c.json({
    year,
    label: yearLabel(year),
    open: await windowOpen(db),
    isMember: user.role === 'member',
    thresholds: th,
    eligibility: eligibility(await gatherRecord(db, user.id, user.student_id, year), th),
    questions: QUESTIONS,
    // The officers' note is never sent here.
    application: mine ? { status: mine.status, answers: parse(mine.answers), updated_at: mine.updated_at } : null,
  });
});

handoffRouter.post('/handoff/apply', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (user.role !== 'member') return c.json({ error: 'You are already an officer.' }, 409);
  if (!(await windowOpen(db))) return c.json({ error: 'Applications are closed right now.' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const clean = cleanAnswers(body?.answers);
  if (clean.error) return c.json({ error: clean.error }, 400);
  const year = schoolYearOf(new Date());
  const had = await mineFor(db, user.id, year);
  if (had && had.status !== 'new') return c.json({ error: 'The officers have already decided on this one.' }, 409);
  if (await hitOrRefuse(db, `apply:${user.id}`, 20, 86_400_000)) return c.json({ error: 'That is plenty of edits for today.' }, 429);
  await db
    .prepare(
      `INSERT INTO officer_applications (user_id, year, answers) VALUES (?, ?, ?)
       ON CONFLICT(user_id, year) DO UPDATE SET answers = excluded.answers, updated_at = datetime('now')`
    )
    .bind(user.id, year, JSON.stringify(clean.answers))
    .run();
  return c.json({ ok: true }, had ? 200 : 201);
});

handoffRouter.delete('/handoff/apply', requireUser, async (c) => {
  const user = c.get('user');
  await c.env.DB
    .prepare(`DELETE FROM officer_applications WHERE user_id = ? AND year = ? AND status = 'new'`)
    .bind(user.id, schoolYearOf(new Date()))
    .run();
  return c.json({ ok: true });
});

/* ------------------------------ officer routes ------------------------------ */

handoffAdminRouter.get('/handoff', async (c) => {
  const db = c.env.DB;
  const year = c.req.query('year') || schoolYearOf(new Date());
  if (!yearRange(year)) return c.json({ error: 'A school year looks like 2026.' }, 400);
  const th = await thresholds(db);
  const apps = await rows(
    db,
    `SELECT a.id, a.user_id, a.answers, a.status, a.note, a.decided_name, a.decided_at, a.created_at, a.updated_at, u.name, u.email, u.student_id
     FROM officer_applications a JOIN users u ON u.id = a.user_id WHERE a.year = ? ORDER BY a.created_at, a.id`,
    year
  );
  const applications = [];
  for (const a of apps) {
    applications.push({
      id: a.id, name: a.name, email: a.email, status: a.status, note: a.note, decided_name: a.decided_name, decided_at: a.decided_at,
      created_at: a.created_at, answers: parse(a.answers),
      eligibility: eligibility(await gatherRecord(db, a.user_id, a.student_id, year), th),
    });
  }
  const summary = await db.prepare('SELECT body FROM year_summaries WHERE year = ?').bind(year).first();
  return c.json({
    year, label: yearLabel(year), years: await archiveYears(db), open: await windowOpen(db),
    thresholds: th, defaults: DEFAULT_THRESHOLDS, questions: QUESTIONS, applications, summary: summary?.body ?? '',
  });
});

handoffAdminRouter.put('/handoff/settings', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  if (body?.thresholds !== undefined) {
    const clean = cleanThresholds(body.thresholds);
    if (clean.error) return c.json({ error: clean.error }, 400);
    await setSetting(db, 'handoff_thresholds', JSON.stringify(clean.thresholds));
  }
  if (body?.open !== undefined) {
    if (typeof body.open !== 'boolean') return c.json({ error: 'open must be true or false.' }, 400);
    await setSetting(db, 'handoff_open', body.open ? '1' : '0');
  }
  return c.json({ ok: true, open: await windowOpen(db), thresholds: await thresholds(db) });
});

handoffAdminRouter.post('/handoff/applications/:id/decide', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  if (!['accepted', 'declined', 'new'].includes(body?.status)) return c.json({ error: 'Choose accepted, declined or new.' }, 400);
  const note = String(body?.note ?? '').trim().slice(0, NOTE_MAX);
  const by = c.get('officer')?.name ?? 'officer';
  const r = await db
    .prepare(
      `UPDATE officer_applications SET status = ?, note = ?, decided_name = ?, decided_at = ${body.status === 'new' ? 'NULL' : "datetime('now')"} WHERE id = ?`
    )
    .bind(body.status, note, body.status === 'new' ? null : by, Number(c.req.param('id')))
    .run();
  if (!r.meta.changes) return c.json({ error: 'No such application.' }, 404);
  return c.json({ ok: true });
});

handoffAdminRouter.put('/handoff/summary/:year', async (c) => {
  const db = c.env.DB;
  const year = c.req.param('year');
  if (!yearRange(year)) return c.json({ error: 'A school year looks like 2026.' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const text = String(body?.body ?? '').replace(/\r/g, '').trim();
  if (text.length > SUMMARY_MAX) return c.json({ error: `Keep the summary under ${SUMMARY_MAX} characters.` }, 400);
  if (!text) await db.prepare('DELETE FROM year_summaries WHERE year = ?').bind(year).run();
  else {
    await db
      .prepare(
        `INSERT INTO year_summaries (year, body, updated_by) VALUES (?, ?, ?)
         ON CONFLICT(year) DO UPDATE SET body = excluded.body, updated_by = excluded.updated_by, updated_at = datetime('now')`
      )
      .bind(year, text, c.get('officer')?.name ?? 'officer')
      .run();
  }
  return c.json({ ok: true });
});
