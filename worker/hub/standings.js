/**
 * Standings (A4, A5, A6): the season view of the ledger, squads and the raffle.
 *
 * The public page gets the top five, counts per season tier, squad scores and,
 * for a signed-in member, their own row with two either side. The full ranked
 * list is officer-only. The rules themselves are pure functions in
 * shared/standings.js; this file reads the tables and guards the routes.
 */
import { Hono } from 'hono';

import { getLeaderboard, getSetting, setSetting } from '../db.js';
import { seasonOf, seasonRange, prevSeason, seasonLabel } from '../../shared/points.js';
import { rankFor } from '../../shared/ranks.js';
import {
  tiersFrom, cleanTiers, tierOf, tierCounts, neighbours, raffleTickets, drawWinner, median, suggestSquads, pairKey,
} from '../../shared/standings.js';
import { currentUser, requireUser } from './users.js';
import { officerOf } from './ledger.js';

export const standingsRouter = new Hono();
export const standingsAdminRouter = new Hono();

const SEASON_RE = /^\d{4}-(fall|spring)$/;
const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';

/** ?season= value -> a season key. Empty means the current season. null if invalid. */
export function seasonParam(v, allowAll = true, now = new Date()) {
  if (!v || v === 'current') return seasonOf(now);
  if (v === 'all') return allowAll ? 'all' : null;
  return SEASON_RE.test(v) ? v : null;
}

export const loadTiers = async (db) => tiersFrom(await getSetting(db, 'season_tiers', ''));

/** Uniform whole number in [0, n) from the platform CSPRNG (rejection sampling, no modulo bias). */
export function cryptoInt(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

/** The rank block every page shows: lifetime label from the peak, plus what comes next. */
export function rankInfo(row) {
  const r = rankFor(row?.peak ?? 0);
  return { rank: r.rank, rankName: r.name, color: r.color, peak: row?.peak ?? 0, next: r.next && { id: r.next.id, name: r.next.name, min: r.next.min } };
}

/**
 * Squads of a season with their members' season points and the median score,
 * best first. `board` is getLeaderboard(db, season), passed in so a page that
 * already has it does not query twice.
 */
export async function squadStandings(db, season, board) {
  const rows = (
    await db
      .prepare(
        `SELECT q.id, q.name, q.color, m.student_id FROM squads q
         LEFT JOIN squad_members m ON m.squad_id = q.id
         WHERE q.season = ? ORDER BY q.id`
      )
      .bind(season)
      .all()
  ).results;
  const byId = new Map(board.map((r) => [r.id, r]));
  const squads = new Map();
  for (const r of rows) {
    if (!squads.has(r.id)) squads.set(r.id, { id: r.id, name: r.name, color: r.color, members: [] });
    const m = byId.get(r.student_id);
    if (m) squads.get(r.id).members.push({ id: m.id, name: m.name, points: m.points, lifetime: m.lifetime });
  }
  const list = [...squads.values()].map((s) => ({ ...s, score: median(s.members.map((m) => m.points)) }));
  list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let last = null;
  let place = 0;
  return list.map((s, i) => {
    if (s.score !== last) place = i + 1;
    last = s.score;
    return { ...s, place };
  });
}

/* --------------------------------- public --------------------------------- */

standingsRouter.get('/standings', async (c) => {
  const db = c.env.DB;
  const season = seasonParam(c.req.query('season'));
  if (!season) return c.json({ error: 'Unknown season.' }, 400);
  const current = seasonOf(new Date());
  const [board, tiers, user, prize] = await Promise.all([
    getLeaderboard(db, season, { publicNames: true }), // G5: this page is public, so first names unless opted in
    loadTiers(db),
    currentUser(c),
    getSetting(db, 'prize_title', ''),
  ]);

  const pub = (r) => ({ id: r.id, name: r.name, points: r.points, place: r.place, rank: r.rank });
  const top = board.slice(0, 5);
  const topIds = new Set(top.map((r) => r.id));

  let me = null;
  const mine = user?.student_id && board.find((r) => r.id === user.student_id);
  if (mine) {
    const t = tierOf(mine.points, tiers);
    me = {
      ...pub(mine),
      lifetime: mine.lifetime,
      ...rankInfo(mine),
      tier: t,
      nextTier: t + 1 < tiers.length ? { index: t + 1, min: tiers[t + 1], gap: tiers[t + 1] - mine.points } : null,
      tickets: mine.points >= tiers[0] ? mine.points : 0,
      window: neighbours(board, mine.id).map((r) => ({ ...pub(r), you: r.id === mine.id })),
    };
  }

  // Events only for the top five: enough for the rank race, small enough to stay fast.
  const race = top.length
    ? (
        await db
          .prepare(
            `SELECT student_id, delta, reason, created_at FROM point_events
             WHERE student_id IN (${top.map(() => '?').join(',')}) AND created_at >= ? AND created_at < ?
             ORDER BY created_at, id`
          )
          .bind(...topIds, seasonRange(season).start, seasonRange(season).end)
          .all()
      ).results
    : [];

  const tickets = raffleTickets(board, tiers[0]);
  const draw =
    season === 'all'
      ? null
      : await db.prepare('SELECT student_name, drawn_at FROM raffle_draws WHERE season = ? ORDER BY id DESC LIMIT 1').bind(season).first();

  return c.json({
    season,
    label: seasonLabel(season),
    seasons: [current, prevSeason(current), 'all'].map((key) => ({ key, label: seasonLabel(key) })),
    prize,
    members: board.length,
    totalPoints: board.reduce((a, r) => a + r.points, 0),
    tiers,
    counts: tierCounts(board, tiers),
    top: top.map(pub),
    race,
    me,
    officer: user?.role === 'officer' || user?.role === 'lead',
    squads:
      season === 'all'
        ? []
        : (await squadStandings(db, season, board)).map(({ members, ...s }) => ({ ...s, size: members.length, mine: Boolean(mine && members.some((m) => m.id === mine.id)) })),
    raffle: { entrants: tickets.length, tickets: tickets.reduce((a, e) => a + e.tickets, 0), winner: draw ? firstName(draw.student_name) : null },
  });
});

/** The signed-in member's squad this season, for the Today page. First names only. */
standingsRouter.get('/me/squad', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const season = seasonOf(new Date());
  if (!user.student_id) return c.json({ season, squad: null });
  const board = await getLeaderboard(db, season);
  const squads = await squadStandings(db, season, board);
  const s = squads.find((q) => q.members.some((m) => m.id === user.student_id));
  if (!s) return c.json({ season, squad: null });
  return c.json({
    season,
    squad: {
      id: s.id,
      name: s.name,
      color: s.color,
      score: s.score,
      place: s.place,
      of: squads.length,
      members: s.members
        .map((m) => ({ id: m.id, name: firstName(m.name), points: m.points, you: m.id === user.student_id }))
        .sort((a, b) => b.points - a.points),
    },
  });
});

/* --------------------------------- officers -------------------------------- */

standingsAdminRouter.get('/standings/full', async (c) => {
  const season = seasonParam(c.req.query('season'));
  if (!season) return c.json({ error: 'Unknown season.' }, 400);
  const board = await getLeaderboard(c.env.DB, season);
  return c.json({
    season,
    rows: board.map((r) => ({ id: r.id, name: r.name, grade: r.grade, place: r.place, points: r.points, lifetime: r.lifetime, rank: r.rank })),
  });
});

standingsAdminRouter.get('/season-tiers', async (c) => c.json({ tiers: await loadTiers(c.env.DB) }));

standingsAdminRouter.put('/season-tiers', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { tiers, error } = cleanTiers(body?.tiers);
  if (error) return c.json({ error }, 400);
  await setSetting(c.env.DB, 'season_tiers', JSON.stringify(tiers));
  return c.json({ tiers });
});

async function raffleState(db, season) {
  const [board, tiers] = await Promise.all([getLeaderboard(db, season), loadTiers(db)]);
  const entries = raffleTickets(board, tiers[0]).sort((a, b) => b.tickets - a.tickets);
  const draws = (await db.prepare('SELECT * FROM raffle_draws WHERE season = ? ORDER BY id DESC').bind(season).all()).results;
  return { season, label: seasonLabel(season), firstTier: tiers[0], entries, total: entries.reduce((a, e) => a + e.tickets, 0), draws };
}

standingsAdminRouter.get('/raffle', async (c) => {
  const season = seasonParam(c.req.query('season'), false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  return c.json(await raffleState(c.env.DB, season));
});

/** Draws a winner server-side. A second draw for a season is a redraw and needs a reason. */
standingsAdminRouter.post('/raffle/draw', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const season = seasonParam(body?.season, false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  const reason = String(body?.reason ?? '').trim().slice(0, 200);
  const state = await raffleState(db, season);
  if (state.draws.length && reason.length < 3) return c.json({ error: 'A winner was already drawn. Give a reason for the redraw.' }, 400);
  const win = drawWinner(state.entries, cryptoInt);
  if (!win) return c.json({ error: 'Nobody holds a ticket yet.' }, 400);
  const officer = officerOf(c);
  await db
    .prepare(
      `INSERT INTO raffle_draws (season, student_id, student_name, tickets, total_tickets, entrants, reason, drawn_by, drawn_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(season, win.id, win.name, win.tickets, win.total, state.entries.length, reason, officer.userId ?? null, officer.name)
    .run();
  return c.json({ winner: { id: win.id, name: win.name, tickets: win.tickets }, ...(await raffleState(db, season)) });
});

/* ---------------------------------- squads --------------------------------- */

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const cleanSquad = (b) => {
  const name = String(b?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const color = String(b?.color ?? '#ffc20e');
  if (name.length < 2) return { error: 'Give the squad a name of at least 2 characters.' };
  if (!COLOR_RE.test(color)) return { error: 'Colour must look like #ffc20e.' };
  return { name, color };
};

standingsAdminRouter.get('/squads', async (c) => {
  const db = c.env.DB;
  const season = seasonParam(c.req.query('season'), false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  const board = await getLeaderboard(db, season);
  const lifetime = await getLeaderboard(db, 'all');
  const life = new Map(lifetime.map((r) => [r.id, r.lifetime]));
  const squads = await squadStandings(db, season, board);
  const placed = new Set(squads.flatMap((s) => s.members.map((m) => m.id)));
  return c.json({
    season,
    label: seasonLabel(season),
    squads,
    unassigned: board.filter((r) => !placed.has(r.id)).map((r) => ({ id: r.id, name: r.name, points: r.points, lifetime: life.get(r.id) ?? 0 })),
  });
});

standingsAdminRouter.post('/squads', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const season = seasonParam(body?.season, false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  const s = cleanSquad(body);
  if (s.error) return c.json(s, 400);
  const res = await c.env.DB.prepare('INSERT INTO squads (season, name, color) VALUES (?, ?, ?)').bind(season, s.name, s.color).run();
  return c.json({ id: res.meta.last_row_id });
});

standingsAdminRouter.patch('/squads/:id', async (c) => {
  const s = cleanSquad(await c.req.json().catch(() => ({})));
  if (s.error) return c.json(s, 400);
  const res = await c.env.DB.prepare('UPDATE squads SET name = ?, color = ? WHERE id = ?').bind(s.name, s.color, Number(c.req.param('id'))).run();
  if (!res.meta.changes) return c.json({ error: 'No such squad.' }, 404);
  return c.json({ ok: true });
});

standingsAdminRouter.delete('/squads/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM squads WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

/** Moves a member into a squad (squadId) or out of every squad that season (squadId null). */
standingsAdminRouter.post('/squads/move', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const studentId = Number(body?.studentId);
  if (!Number.isInteger(studentId)) return c.json({ error: 'Pick a member.' }, 400);
  if (body?.squadId == null) {
    const season = seasonParam(body?.season, false);
    if (!season) return c.json({ error: 'Pick a season.' }, 400);
    await db.prepare('DELETE FROM squad_members WHERE student_id = ? AND season = ?').bind(studentId, season).run();
    return c.json({ ok: true });
  }
  const squad = await db.prepare('SELECT id, season FROM squads WHERE id = ?').bind(Number(body.squadId)).first();
  if (!squad) return c.json({ error: 'No such squad.' }, 404);
  const student = await db.prepare('SELECT id FROM students WHERE id = ? AND active = 1').bind(studentId).first();
  if (!student) return c.json({ error: 'No such member.' }, 404);
  await db
    .prepare(
      `INSERT INTO squad_members (squad_id, student_id, season) VALUES (?, ?, ?)
       ON CONFLICT(student_id, season) DO UPDATE SET squad_id = excluded.squad_id`
    )
    .bind(squad.id, studentId, squad.season)
    .run();
  return c.json({ ok: true });
});

/** Pairs of members who shared a squad in `season`, as pairKey strings. */
async function pairsIn(db, season) {
  const rows = (await db.prepare('SELECT squad_id, student_id FROM squad_members WHERE season = ?').bind(season).all()).results;
  const by = new Map();
  for (const r of rows) by.set(r.squad_id, [...(by.get(r.squad_id) ?? []), r.student_id]);
  const pairs = new Set();
  for (const ids of by.values()) for (const a of ids) for (const b of ids) if (a < b) pairs.add(pairKey(a, b));
  return pairs;
}

/** A proposal only; nothing is saved until the officer applies it. */
standingsAdminRouter.post('/squads/suggest', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const season = seasonParam(body?.season, false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  const members = await getLeaderboard(db, 'all');
  const count = Number(body?.count) || Math.max(1, Math.round(members.length / 5));
  if (!Number.isInteger(count) || count < 1 || count > 30) return c.json({ error: 'Squad count must be 1 to 30.' }, 400);
  const past = await pairsIn(db, prevSeason(season));
  const byId = new Map(members.map((m) => [m.id, m]));
  const plan = suggestSquads(members.map((m) => ({ id: m.id, lifetime: m.lifetime })), count, past);
  return c.json({
    season,
    squads: plan.map((ids) => ({
      members: ids.map((id) => ({ id, name: byId.get(id).name, lifetime: byId.get(id).lifetime })),
      median: median(ids.map((id) => byId.get(id).lifetime)),
      repeats: ids.filter((a, i) => ids.slice(i + 1).some((b) => past.has(pairKey(a, b)))).length,
    })),
  });
});

/** Replaces a season's squads with the given list in one transaction (reshuffle). */
standingsAdminRouter.post('/squads/apply', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const season = seasonParam(body?.season, false);
  if (!season) return c.json({ error: 'Pick a season.' }, 400);
  const list = Array.isArray(body?.squads) ? body.squads : null;
  if (!list || !list.length || list.length > 30) return c.json({ error: 'Send between 1 and 30 squads.' }, 400);
  const seen = new Set();
  const clean = [];
  for (const s of list) {
    const v = cleanSquad(s);
    if (v.error) return c.json(v, 400);
    const ids = Array.isArray(s.members) ? s.members.map(Number) : [];
    if (ids.some((id) => !Number.isInteger(id) || seen.has(id))) return c.json({ error: 'Each member can be in one squad only.' }, 400);
    ids.forEach((id) => seen.add(id));
    clean.push({ ...v, ids });
  }
  const stmts = [
    db.prepare('DELETE FROM squad_members WHERE season = ?').bind(season),
    db.prepare('DELETE FROM squads WHERE season = ?').bind(season),
  ];
  for (const s of clean) {
    stmts.push(db.prepare('INSERT INTO squads (season, name, color) VALUES (?, ?, ?)').bind(season, s.name, s.color));
    for (const id of s.ids) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO squad_members (squad_id, student_id, season)
             SELECT (SELECT MAX(id) FROM squads), id, ? FROM students WHERE id = ? AND active = 1`
          )
          .bind(season, id)
      );
    }
  }
  await db.batch(stmts);
  return c.json({ ok: true });
});
