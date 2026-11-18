/**
 * Editorials by members (C6) and ghost races (C7), both built on "who solved
 * this bank problem". A solve is a row in problem_solves (daily, problem page)
 * or a solved duel_results row. Judging is in the browser, so the server only
 * records the result and gates what is shown.
 *
 * Editorials: only members who solved the problem (and officers) can read them,
 * so they cannot be used to skip it. An officer accepting one pays the author a
 * `mentor` activity once. Ghosts: a ghost list is first names and times only;
 * nobody's solve code ever leaves this file.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { recordActivity } from './ledger.js';
import { firstName } from './names.js';
import { median } from '../../shared/daily.js';
import { raceResult } from '../../shared/ghost.js';

export const editorialsRouter = new Hono();
export const editorialsAdminRouter = new Hono();

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_BODY = 4000;
const MAX_CODE = 4000;
const MAX_MS = 86_400_000;

const isStaff = (u) => u?.role === 'officer' || u?.role === 'lead';

async function liveProblem(db, slug) {
  if (!SLUG.test(slug)) return null;
  return db.prepare(`SELECT slug, title FROM problems WHERE slug = ? AND status = 'live'`).bind(slug).first();
}

/** Has this account solved the problem, by any route? */
export async function hasSolved(db, userId, slug) {
  const a = await db.prepare('SELECT 1 AS x FROM problem_solves WHERE user_id = ? AND slug = ?').bind(userId, slug).first();
  if (a) return true;
  return Boolean(await db.prepare('SELECT 1 AS x FROM duel_results WHERE user_id = ? AND slug = ? AND solved_ms IS NOT NULL').bind(userId, slug).first());
}

/** Best time per member who has not deleted their account: [{ userId, name, ms }], fastest first, first names only. */
export async function solveTimes(db, slug) {
  const rows = (
    await db
      .prepare(
        `SELECT u.id AS userId, u.name AS name, MIN(t.ms) AS ms FROM (
           SELECT user_id, ms FROM problem_solves WHERE slug = ?
           UNION ALL
           SELECT user_id, solved_ms FROM duel_results WHERE slug = ? AND solved_ms IS NOT NULL
         ) t JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL
         GROUP BY u.id ORDER BY ms, u.id LIMIT 200`
      )
      .bind(slug, slug)
      .all()
  ).results;
  return rows.map((r) => ({ userId: r.userId, name: firstName(r.name), ms: r.ms }));
}

/* --------------------------------- solves --------------------------------- */

// Honour system, like /daily/result: the page judged it, we keep the fastest time.
editorialsRouter.post('/problems/:slug/solve', requireUser, async (c) => {
  const slug = c.req.param('slug');
  const ms = Number((await c.req.json().catch(() => null))?.ms);
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_MS) return c.json({ error: 'Time must be under a day.' }, 400);
  if (!(await liveProblem(c.env.DB, slug))) return c.json({ error: 'No such problem.' }, 404);
  await c.env.DB
    .prepare(
      `INSERT INTO problem_solves (user_id, slug, ms) VALUES (?, ?, ?)
       ON CONFLICT(user_id, slug) DO UPDATE SET ms = MIN(ms, excluded.ms)`
    )
    .bind(c.get('user').id, slug, ms)
    .run();
  return c.json({ ok: true });
});

/* -------------------------------- editorials ------------------------------- */

const shape = (r, me) => ({ id: r.id, name: firstName(r.name), body: r.body, code: r.code, mine: r.user_id === me, status: r.status });

editorialsRouter.get('/problems/:slug/editorials', requireUser, async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await liveProblem(db, slug))) return c.json({ error: 'No such problem.' }, 404);
  if (!isStaff(user) && !(await hasSolved(db, user.id, slug))) return c.json({ locked: true, editorials: [], mine: null });
  const accepted = (
    await db
      .prepare(
        `SELECT e.id, e.user_id, e.body, e.code, e.status, u.name FROM editorials e
         JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
         WHERE e.slug = ? AND e.status = 'accepted' ORDER BY e.id LIMIT 50`
      )
      .bind(slug)
      .all()
  ).results;
  const mine = await db.prepare('SELECT id, user_id, body, code, status FROM editorials WHERE slug = ? AND user_id = ?').bind(slug, user.id).first();
  return c.json({ locked: false, editorials: accepted.map((r) => shape(r, user.id)), mine: mine ? shape({ ...mine, name: user.name }, user.id) : null });
});

// Write or rewrite your own. An accepted editorial is final; a rejected one goes back to pending when edited.
editorialsRouter.post('/problems/:slug/editorials', requireUser, async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const user = c.get('user');
  const b = await c.req.json().catch(() => null);
  const body = typeof b?.body === 'string' ? b.body.trim() : '';
  const code = typeof b?.code === 'string' ? b.code.replace(/\s+$/, '') : '';
  if (body.length < 20) return c.json({ error: 'Write at least a couple of sentences explaining the idea.' }, 400);
  if (body.length > MAX_BODY || code.length > MAX_CODE) return c.json({ error: `Keep the text under ${MAX_BODY} characters and the code under ${MAX_CODE}.` }, 400);
  if (!(await liveProblem(db, slug))) return c.json({ error: 'No such problem.' }, 404);
  if (!(await hasSolved(db, user.id, slug))) return c.json({ error: 'Solve the problem first, then explain it.' }, 403);
  const old = await db.prepare('SELECT id, status FROM editorials WHERE slug = ? AND user_id = ?').bind(slug, user.id).first();
  if (old && (old.status === 'accepted' || old.status === 'hidden')) return c.json({ error: 'That editorial is already decided.' }, 409);
  if (old) await db.prepare(`UPDATE editorials SET body = ?, code = ?, status = 'pending' WHERE id = ?`).bind(body, code, old.id).run();
  else await db.prepare('INSERT INTO editorials (slug, user_id, body, code) VALUES (?, ?, ?, ?)').bind(slug, user.id, body, code).run();
  return c.json({ ok: true, status: 'pending' }, 201);
});

/* ---------------------------------- ghosts --------------------------------- */

// First names and times only. The member's own time is left out: a ghost is someone else.
editorialsRouter.get('/problems/:slug/ghosts', requireUser, async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await liveProblem(db, slug))) return c.json({ error: 'No such problem.' }, 404);
  const all = await solveTimes(db, slug);
  const history = (
    await db.prepare('SELECT ghost_name, ghost_ms, ms, won, created_at FROM ghost_races WHERE user_id = ? AND slug = ? ORDER BY id DESC LIMIT 20').bind(user.id, slug).all()
  ).results;
  return c.json({
    ghosts: all.filter((g) => g.userId !== user.id).slice(0, 12).map((g) => ({ id: g.userId, name: g.name, ms: g.ms })),
    medianMs: median(all.map((g) => g.ms)),
    history,
  });
});

editorialsRouter.post('/problems/:slug/ghost-result', requireUser, async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const user = c.get('user');
  const b = await c.req.json().catch(() => null);
  const ms = Number(b?.ms);
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_MS) return c.json({ error: 'Time must be under a day.' }, 400);
  if (!(await liveProblem(db, slug))) return c.json({ error: 'No such problem.' }, 404);
  // The server looks the ghost's time up itself; the page cannot choose its own opponent time.
  const all = await solveTimes(db, slug);
  let name;
  let ghostMs;
  if (b?.ghost === 'median') {
    ghostMs = median(all.map((g) => g.ms));
    name = 'the club median';
  } else {
    const g = all.find((x) => x.userId === Number(b?.ghost) && x.userId !== user.id);
    ghostMs = g?.ms;
    name = g?.name;
  }
  if (ghostMs == null) return c.json({ error: 'That ghost is not available any more.' }, 404);
  const { won, diffMs } = raceResult(ms, ghostMs);
  await db.prepare('INSERT INTO ghost_races (user_id, slug, ghost_name, ghost_ms, ms, won) VALUES (?, ?, ?, ?, ?, ?)').bind(user.id, slug, name, ghostMs, ms, won ? 1 : 0).run();
  return c.json({ won, diffMs, ghostMs, ghostName: name });
});

/* -------------------------------- officers -------------------------------- */

editorialsAdminRouter.get('/editorials', async (c) => {
  const status = ['pending', 'accepted', 'rejected', 'hidden'].includes(c.req.query('status')) ? c.req.query('status') : 'pending';
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT e.id, e.slug, e.body, e.code, e.status, e.created_at, e.decided_name, u.name AS author, p.title
         FROM editorials e JOIN users u ON u.id = e.user_id LEFT JOIN problems p ON p.slug = e.slug
         WHERE e.status = ? ORDER BY e.id DESC LIMIT 100`
      )
      .bind(status)
      .all()
  ).results;
  return c.json({ editorials: rows });
});

async function decide(c, status) {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const e = await db
    .prepare('SELECT e.id, e.slug, e.status, e.user_id, u.student_id FROM editorials e JOIN users u ON u.id = e.user_id WHERE e.id = ?')
    .bind(id)
    .first();
  if (!e) return c.json({ error: 'No such editorial.' }, 404);
  if (e.status !== 'pending') return c.json({ error: `That was already ${e.status}.` }, 409);
  const officer = c.get('officer');
  if (status === 'accepted' && officer?.userId != null && officer.userId === e.user_id) {
    return c.json({ error: 'You cannot accept your own editorial. Ask another officer.' }, 403);
  }
  const res = await db
    .prepare(`UPDATE editorials SET status = ?, decided_name = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`)
    .bind(status, officer?.name ?? 'officer', id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'That was already decided.' }, 409);
  let awarded = 0;
  if (status === 'accepted' && Number.isInteger(e.student_id)) {
    const p = await db.prepare('SELECT title FROM problems WHERE slug = ?').bind(e.slug).first();
    // ref makes it pay once, however many times anyone clicks.
    const r = await recordActivity(db, {
      studentId: e.student_id, kind: 'mentor', ref: `editorial:${id}`, meta: { title: `Editorial: ${p?.title ?? e.slug}`, slug: e.slug }, status: 'approved',
    });
    awarded = r.awarded;
  }
  return c.json({ ok: true, awarded });
}

editorialsAdminRouter.post('/editorials/:id/accept', (c) => decide(c, 'accepted'));
editorialsAdminRouter.post('/editorials/:id/reject', (c) => decide(c, 'rejected'));
