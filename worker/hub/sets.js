/**
 * Problem sets (V3-B): duel packs and contest sets. A set is a fixed, checked
 * choice of bank problems, so a meeting block starts in one tap instead of an
 * officer picking nine problems live.
 *
 * Duel body:    { practice, new: [slug x3], comfortable: [slug x3], contest: [slug x3], final: slug|null }
 * Contest body: { problems: [slug, ...] } in play order
 *
 * Every slug must be a live bank problem and appear once per set. A draft may
 * be incomplete; going live needs the full shape (3 per division, a practice).
 */
import { Hono } from 'hono';
import { DIVISIONS } from './duel.js';

export const setsAdminRouter = new Hono();

export const SET_KINDS = ['duel', 'contest'];
export const SET_STATUSES = ['draft', 'live'];
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PER_DIVISION = 3;
const MAX_CONTEST = 12;

const parse = (text) => {
  try {
    const o = JSON.parse(text || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
};

/** Every problem slug a set body names, in display order. */
export function slugsOf(kind, body) {
  if (kind === 'contest') return [...(body.problems ?? [])];
  return [body.practice, ...DIVISIONS.flatMap((d) => body[d] ?? []), body.final].filter(Boolean);
}

/**
 * Pure shape check. Returns { error } or { value: { slug?, kind, title, status, body } }
 * with body normalised. `kind` comes from the stored row on update (it never changes).
 */
export function checkSet(input, { partial = false, kind: fixedKind } = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 120) return { error: 'Give the set a title (up to 120 characters).' };

  let slug;
  if (!partial) {
    slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '';
    if (!SLUG.test(slug)) return { error: 'Slug: lowercase letters, numbers and dashes only, up to 80 characters.' };
  }
  const kind = fixedKind ?? b.kind;
  if (!SET_KINDS.includes(kind)) return { error: 'Kind is duel or contest.' };
  const status = b.status ?? 'draft';
  if (!SET_STATUSES.includes(status)) return { error: 'Status is draft or live.' };
  const live = status === 'live';

  const raw = b.body && typeof b.body === 'object' && !Array.isArray(b.body) ? b.body : {};
  const one = (v) => (v == null || v === '' ? null : v);
  const list = (v) => (v == null ? [] : v);
  let body;
  if (kind === 'duel') {
    body = { practice: one(raw.practice), final: one(raw.final) };
    for (const d of DIVISIONS) body[d] = list(raw[d]);
    for (const d of DIVISIONS) {
      if (!Array.isArray(body[d])) return { error: `The ${d} division must be a list of problems.` };
      if (body[d].length > PER_DIVISION) return { error: `A division has at most ${PER_DIVISION} problems.` };
      if (live && body[d].length !== PER_DIVISION) return { error: `A live duel pack needs ${PER_DIVISION} problems in every division.` };
    }
    if (live && !body.practice) return { error: 'A live duel pack needs a practice problem.' };
  } else {
    body = { problems: list(raw.problems) };
    if (!Array.isArray(body.problems)) return { error: 'Problems must be a list.' };
    if (body.problems.length > MAX_CONTEST) return { error: `A contest set has at most ${MAX_CONTEST} problems.` };
    if (live && !body.problems.length) return { error: 'A live contest set needs at least one problem.' };
  }

  const slugs = slugsOf(kind, body);
  if (slugs.some((s) => typeof s !== 'string' || !SLUG.test(s))) return { error: 'Every problem is named by its slug.' };
  if (new Set(slugs).size !== slugs.length) return { error: 'A problem can appear only once in a set.' };
  return { value: { slug, kind, title, status, body } };
}

/** Every slug must exist in the bank and be live. Returns an error sentence or null. */
export async function checkBank(db, slugs) {
  if (!slugs.length) return null;
  const rows = (
    await db.prepare(`SELECT slug FROM problems WHERE status = 'live' AND slug IN (${slugs.map(() => '?').join(',')})`).bind(...slugs).all()
  ).results;
  const have = new Set(rows.map((r) => r.slug));
  const missing = slugs.filter((s) => !have.has(s));
  return missing.length ? `Not live in the problem bank: ${missing.join(', ')}.` : null;
}

/**
 * For the room (duel_setup with { set }): a live duel pack's problems per
 * division, as the setup message would have listed them. { error } or { asked }.
 */
export async function duelPackProblems(db, slug) {
  const row = await db.prepare(`SELECT body FROM problem_sets WHERE slug = ? AND kind = 'duel' AND status = 'live'`).bind(String(slug ?? '')).first();
  if (!row) return { error: 'That duel pack is not live.' };
  const body = parse(row.body);
  return { asked: Object.fromEntries(DIVISIONS.map((d) => [d, (Array.isArray(body[d]) ? body[d] : []).map(String).slice(0, PER_DIVISION)])) };
}

const shape = (r) => ({ ...r, body: parse(r.body) });
const idOf = (c) => {
  const n = Number(c.req.param('id'));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/* -------------------------------- officers -------------------------------- */

// The picker: live problems with how many members have solved each (practice or duel).
// Registered before /sets/:id so "bank" is not read as an id.
setsAdminRouter.get('/sets/bank', async (c) => {
  const db = c.env.DB;
  const problems = (await db.prepare(`SELECT id, slug, title, difficulty, tags FROM problems WHERE status = 'live' ORDER BY difficulty, title LIMIT 1000`).all()).results;
  const solved = (
    await db
      .prepare(
        `SELECT slug, COUNT(DISTINCT user_id) AS n FROM (
           SELECT user_id, slug FROM problem_solves
           UNION ALL SELECT user_id, slug FROM duel_results WHERE solved_ms IS NOT NULL
         ) GROUP BY slug`
      )
      .all()
  ).results;
  const n = Object.fromEntries(solved.map((r) => [r.slug, r.n]));
  return c.json({ problems: problems.map((p) => ({ ...p, tags: p.tags ? p.tags.split(',') : [], solvers: n[p.slug] ?? 0 })) });
});

setsAdminRouter.get('/sets', async (c) => {
  const where = [];
  const args = [];
  if (SET_KINDS.includes(c.req.query('kind'))) {
    where.push('kind = ?');
    args.push(c.req.query('kind'));
  }
  if (SET_STATUSES.includes(c.req.query('status'))) {
    where.push('status = ?');
    args.push(c.req.query('status'));
  }
  const rows = (
    await c.env.DB
      .prepare(`SELECT id, slug, kind, title, body, status, created_by, updated_at FROM problem_sets ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY status DESC, title LIMIT 200`)
      .bind(...args)
      .all()
  ).results;
  return c.json({ sets: rows.map(shape) });
});

// One set with the titles and levels of its problems, for the editor and the duel setup.
setsAdminRouter.get('/sets/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM problem_sets WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such set.' }, 404);
  const set = shape(row);
  const slugs = slugsOf(set.kind, set.body);
  const problems = slugs.length
    ? (await db.prepare(`SELECT slug, title, difficulty, status FROM problems WHERE slug IN (${slugs.map(() => '?').join(',')})`).bind(...slugs).all()).results
    : [];
  return c.json({ ...set, problems: Object.fromEntries(problems.map((p) => [p.slug, p])) });
});

setsAdminRouter.post('/sets', async (c) => {
  const { error, value: v } = checkSet(await c.req.json().catch(() => null));
  if (error) return c.json({ error }, 400);
  const db = c.env.DB;
  const bad = await checkBank(db, slugsOf(v.kind, v.body));
  if (bad) return c.json({ error: bad }, 400);
  if (await db.prepare('SELECT 1 AS x FROM problem_sets WHERE slug = ?').bind(v.slug).first()) {
    return c.json({ error: 'That slug is already used by another set.' }, 409);
  }
  const res = await db
    .prepare('INSERT INTO problem_sets (slug, kind, title, body, status, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(v.slug, v.kind, v.title, JSON.stringify(v.body), v.status, c.get('officer')?.name ?? 'officer')
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

// Title and problems. Slug and kind are fixed: rooms and plans refer to the slug.
setsAdminRouter.put('/sets/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT kind, status FROM problem_sets WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such set.' }, 404);
  const input = await c.req.json().catch(() => null);
  const { error, value: v } = checkSet({ ...input, status: row.status }, { partial: true, kind: row.kind });
  if (error) return c.json({ error }, 400);
  const bad = await checkBank(db, slugsOf(v.kind, v.body));
  if (bad) return c.json({ error: bad }, 400);
  await db
    .prepare(`UPDATE problem_sets SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(v.title, JSON.stringify(v.body), idOf(c))
    .run();
  return c.json({ ok: true });
});

// Going live re-checks the whole set against the bank as it is now.
setsAdminRouter.post('/sets/:id/status', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM problem_sets WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such set.' }, 404);
  const b = await c.req.json().catch(() => null);
  const { error, value: v } = checkSet({ title: row.title, body: parse(row.body), status: b?.status }, { partial: true, kind: row.kind });
  if (error) return c.json({ error }, 400);
  const bad = await checkBank(db, slugsOf(v.kind, v.body));
  if (bad) return c.json({ error: bad }, 400);
  await db.prepare(`UPDATE problem_sets SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(v.status, row.id).run();
  return c.json({ ok: true });
});
