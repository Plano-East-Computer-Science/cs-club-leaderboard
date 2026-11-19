/**
 * Problem bank (C2). Statement, tests, difficulty, tags and a reference
 * solution, stored in D1 so officers edit problems without touching git.
 *
 * Judging runs in the student's browser (Pyodide), the same honour system as
 * the courses, so `cases` is public. Only `solution` is hidden, and officers
 * get it back through /selfcheck so the editor can run it against the cases.
 * The server never runs code.
 */
import { Hono } from 'hono';
import { parseStarter } from '../../shared/starter.js';

export const problemsRouter = new Hono();
export const problemsAdminRouter = new Hono();

export const STATUSES = ['draft', 'live', 'retired'];
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_CASES = 50;
const MAX_TEXT = 20_000;
// One case may be a max-size input (duel packs, V3-B); a D1 row holds up to 2 MB.
const MAX_CASE_TEXT = 200_000;
const MAX_CASES_TOTAL = 600_000;

const splitTags = (s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean);

/**
 * Row -> what a browser may see: no solution, cases and tags parsed.
 * `starter` is always the Python text (every runner today is Python) and
 * `starters` carries both languages, however the row stores them (V3-B).
 */
export function publicProblem(row) {
  const { solution, ...rest } = row; // eslint-disable-line no-unused-vars
  let cases = [];
  try {
    cases = JSON.parse(row.cases || '[]');
  } catch { /* a broken row shows no tests rather than a 500 */ }
  const starters = parseStarter(row.starter);
  return { ...rest, tags: splitTags(row.tags), cases, starter: starters.python, starters };
}

/**
 * Checks editor input. Returns { error } or { value } with `cases` as a JSON
 * string and `tags` as a clean comma list, ready to store.
 * `partial` skips the slug, which cannot change after creation.
 */
export function validateProblem(input, { partial = false } = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  const title = str(b.title).trim();
  if (!title || title.length > 120) return { error: 'Give the problem a title (up to 120 characters).' };

  let slug;
  if (!partial) {
    slug = str(b.slug).trim().toLowerCase();
    if (!SLUG.test(slug)) return { error: 'Slug: lowercase letters, numbers and dashes only, up to 80 characters.' };
  }

  const difficulty = Number(b.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) return { error: 'Difficulty is a whole number from 1 to 5.' };

  const status = b.status ?? 'draft';
  if (!STATUSES.includes(status)) return { error: 'Status is draft, live or retired.' };

  let cases = b.cases;
  if (typeof cases === 'string') {
    try {
      cases = JSON.parse(cases);
    } catch {
      return { error: 'Cases is not valid JSON.' };
    }
  }
  if (!Array.isArray(cases) || cases.length > MAX_CASES) return { error: `Cases must be a list of at most ${MAX_CASES} tests.` };
  for (const c of cases) {
    if (!c || typeof c.stdin !== 'string' || typeof c.stdout !== 'string') return { error: 'Each case needs text for stdin and stdout.' };
    if (c.stdin.length > MAX_CASE_TEXT || c.stdout.length > MAX_CASE_TEXT) return { error: 'One case is limited to 200,000 characters of input and of output.' };
  }
  cases = cases.map((c) => ({ stdin: c.stdin, stdout: c.stdout }));
  if (cases.reduce((n, c) => n + c.stdin.length + c.stdout.length, 0) > MAX_CASES_TOTAL) return { error: 'All cases together are limited to 600,000 characters.' };

  const body = str(b.body);
  const starter = str(b.starter);
  const solution = str(b.solution);
  if ([body, starter, solution].some((t) => t.length > MAX_TEXT)) return { error: 'Body, starter and solution are limited to 20,000 characters.' };

  const source_url = str(b.source_url).trim();
  if (source_url && !/^https:\/\//i.test(source_url)) return { error: 'Source link must start with https://' };

  // A live problem has to be playable and checkable.
  if (status === 'live' && (!cases.length || !solution.trim())) return { error: 'A live problem needs at least one case and a solution.' };

  const tags = [...new Set(splitTags(b.tags).map((t) => t.toLowerCase().slice(0, 30)))].join(',');
  return { value: { slug, title, body, difficulty, tags, starter, cases: JSON.stringify(cases), solution, source_url, status } };
}

const LIST_COLS = 'id, slug, title, difficulty, tags, source_url, status, updated_at';
const listShape = (r) => ({ ...r, tags: splitTags(r.tags) });

/* --------------------------------- public --------------------------------- */

problemsRouter.get('/problems', async (c) => {
  const where = [`status = 'live'`];
  const args = [];
  const d = Number(c.req.query('difficulty'));
  if (d) {
    where.push('difficulty = ?');
    args.push(d);
  }
  const tag = (c.req.query('tag') || '').trim().toLowerCase().replace(/[%_]/g, '');
  if (tag) {
    where.push(`(',' || tags || ',') LIKE ?`);
    args.push(`%,${tag},%`);
  }
  const q = (c.req.query('q') || '').trim().slice(0, 60).replace(/[%_]/g, '');
  if (q) {
    where.push('(title LIKE ? OR slug LIKE ?)');
    args.push(`%${q}%`, `%${q}%`);
  }
  const rows = (
    await c.env.DB
      .prepare(`SELECT ${LIST_COLS} FROM problems WHERE ${where.join(' AND ')} ORDER BY difficulty, title LIMIT 500`)
      .bind(...args)
      .all()
  ).results;
  return c.json({ problems: rows.map(listShape) });
});

problemsRouter.get('/problems/:slug', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM problems WHERE slug = ? AND status = 'live'`).bind(c.req.param('slug')).first();
  if (!row) return c.json({ error: 'No such problem.' }, 404);
  return c.json(publicProblem(row));
});

/* -------------------------------- officers -------------------------------- */

const idOf = (c) => Number(c.req.param('id'));

problemsAdminRouter.get('/problems', async (c) => {
  const status = STATUSES.includes(c.req.query('status')) ? c.req.query('status') : null;
  const rows = (
    await c.env.DB
      .prepare(`SELECT ${LIST_COLS} FROM problems ${status ? 'WHERE status = ?' : ''} ORDER BY updated_at DESC, id DESC LIMIT 1000`)
      .bind(...(status ? [status] : []))
      .all()
  ).results;
  return c.json({ problems: rows.map(listShape) });
});

// Full row including the solution, for the editor.
problemsAdminRouter.get('/problems/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM problems WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such problem.' }, 404);
  // Raw starter, so the editor saves it back the way it found it (plain or JSON).
  return c.json({ ...publicProblem(row), starter: row.starter, solution: row.solution });
});

problemsAdminRouter.post('/problems', async (c) => {
  const { error, value: v } = validateProblem(await c.req.json().catch(() => null));
  if (error) return c.json({ error }, 400);
  const db = c.env.DB;
  if (await db.prepare('SELECT 1 AS x FROM problems WHERE slug = ?').bind(v.slug).first()) {
    return c.json({ error: 'That slug is already used by another problem.' }, 409);
  }
  const by = c.get('officer')?.name ?? 'officer';
  const res = await db
    .prepare(
      `INSERT INTO problems (slug, title, body, difficulty, tags, starter, cases, solution, source_url, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(v.slug, v.title, v.body, v.difficulty, v.tags, v.starter, v.cases, v.solution, v.source_url, v.status, by)
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

// Slug is fixed once created: duels, daily picks and labs refer to it.
problemsAdminRouter.put('/problems/:id', async (c) => {
  const { error, value: v } = validateProblem(await c.req.json().catch(() => null), { partial: true });
  if (error) return c.json({ error }, 400);
  const res = await c.env.DB
    .prepare(
      `UPDATE problems SET title = ?, body = ?, difficulty = ?, tags = ?, starter = ?, cases = ?, solution = ?,
         source_url = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(v.title, v.body, v.difficulty, v.tags, v.starter, v.cases, v.solution, v.source_url, v.status, idOf(c))
    .run();
  if (!res.meta.changes) return c.json({ error: 'No such problem.' }, 404);
  return c.json({ ok: true });
});

// Retire rather than delete: old duels and daily picks still point at the row.
problemsAdminRouter.post('/problems/:id/retire', async (c) => {
  const res = await c.env.DB.prepare(`UPDATE problems SET status = 'retired', updated_at = datetime('now') WHERE id = ?`).bind(idOf(c)).run();
  if (!res.meta.changes) return c.json({ error: 'No such problem.' }, 404);
  return c.json({ ok: true });
});

// The server never runs code: it hands the solution to the officer's browser.
problemsAdminRouter.post('/problems/:id/selfcheck', async (c) => {
  const row = await c.env.DB.prepare('SELECT solution, cases FROM problems WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such problem.' }, 404);
  return c.json({ solution: row.solution, cases: publicProblem(row).cases });
});
