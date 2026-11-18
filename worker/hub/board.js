/**
 * The Board (C1): ladders of rungs per track, each pointing at a free outside
 * resource, a club course or a club judge problem. Members tick rungs off;
 * officers add one by pasting a link and a hint.
 *
 * Verify modes: `checkbox` and `codeforces` are the member's word (until C4
 * syncs Codeforces), `answer` is checked here against a hash that never leaves
 * the server, `internal` is reported by the in-browser judge on /p/<slug>
 * (the same honour system as course code steps).
 */
import { Hono } from 'hono';

import { TRACK_IDS, VERIFY, trackOf, ladderOf, normAnswer, parseContests, placementFor } from '../../shared/board.js';
import { getSetting, setSetting } from '../db.js';
import { currentUser, requireUser } from './users.js';
import { awardFromUser } from './award.js';
import { rungActivity } from './board-awards.js';

export const boardRouter = new Hono();
export const boardAdminRouter = new Hono();

const SLUG_URL = /^\/((p|learn)\/[a-z0-9][a-z0-9-]{0,79}|projects)$/;
const CONTESTS_KEY = 'usaco_contests';

export async function hashAnswer(answer) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normAnswer(answer)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What a browser may see: everything but the answer hash. */
export const publicRung = ({ answer_hash, created_by, created_at, updated_at, ...r }) => ({ // eslint-disable-line no-unused-vars
  ...r,
  hidden: Boolean(r.hidden),
  tags: r.tags ? r.tags.split(',') : [],
});

/** A fallback title from the link, so pasting a URL alone is enough. */
export function titleFromUrl(url) {
  const tail = url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || url;
  return decodeURIComponent(tail).replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').replace(/^\w/, (m) => m.toUpperCase()).slice(0, 120);
}

/**
 * Officer input -> { error } or { value }. `answer` (plain text) becomes
 * `answer_hash`; on update a blank answer keeps the old hash.
 */
export async function validateRung(input, { partial = false } = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const url = str(b.url);
  if (!/^https:\/\/[^\s]{4,500}$/.test(url) && !SLUG_URL.test(url)) {
    return { error: 'Link must start with https://, or be /p/<problem>, /learn/<course> or /projects.' };
  }
  const track = str(b.track);
  if (!TRACK_IDS.includes(track)) return { error: `Track is one of: ${TRACK_IDS.join(', ')}.` };
  const tier = str(b.tier) || trackOf(track).tiers[0][0];
  if (!trackOf(track).tiers.some(([id]) => id === tier)) return { error: 'That tier does not belong to this track.' };

  const title = str(b.title) || titleFromUrl(url);
  if (title.length > 120) return { error: 'Keep the title under 120 characters.' };
  const hint = str(b.hint);
  if (hint.length > 240) return { error: 'Keep the hint to one line (240 characters).' };

  const difficulty = b.difficulty === undefined || b.difficulty === '' ? 1 : Number(b.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) return { error: 'Difficulty is a whole number from 1 to 5.' };

  const verify = str(b.verify) || (url.startsWith('/p/') ? 'internal' : 'checkbox');
  if (!VERIFY.includes(verify)) return { error: `Verify is one of: ${VERIFY.join(', ')}.` };
  if (verify === 'internal' && !url.startsWith('/p/')) return { error: 'Judge-checked rungs must link to /p/<problem>.' };

  let answer_hash;
  if (verify === 'answer') {
    if (normAnswer(b.answer)) answer_hash = await hashAnswer(b.answer);
    else if (!partial) return { error: 'An answer-checked rung needs the answer.' };
  } else answer_hash = '';

  const tags = [...new Set(String(b.tags ?? '').split(',').map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].join(',');
  const value = { url, track, tier, title, hint, difficulty, verify, tags };
  if (answer_hash !== undefined) value.answer_hash = answer_hash;
  return { value };
}

const parseJson = (s, fallback) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

/* --------------------------------- public --------------------------------- */

boardRouter.get('/board', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c);
  const [rungs, counts, contests] = await Promise.all([
    db.prepare('SELECT * FROM rungs WHERE hidden = 0').all(),
    db.prepare(`SELECT rung_id, COUNT(*) AS n FROM rung_progress WHERE status = 'done' GROUP BY rung_id`).all(),
    getSetting(db, CONTESTS_KEY, ''),
  ]);
  const n = Object.fromEntries(counts.results.map((r) => [r.rung_id, r.n]));

  let progress = {};
  let placement = null;
  if (user) {
    const rows = (await db.prepare('SELECT rung_id, status, done_at, method FROM rung_progress WHERE user_id = ?').bind(user.id).all()).results;
    progress = Object.fromEntries(rows.map(({ rung_id, ...p }) => [rung_id, p]));
    const p = await db.prepare('SELECT start, focus FROM board_placement WHERE user_id = ?').bind(user.id).first();
    if (p) placement = { start: parseJson(p.start, {}), focus: p.focus };
  }

  return c.json({
    rungs: rungs.results.map((r) => ({ ...publicRung(r), n: n[r.id] ?? 0 })),
    progress,
    placement,
    signedIn: Boolean(user),
    usaco: parseContests(contests),
  });
});

boardRouter.post('/board/placement', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const answers = body?.answers;
  if (!answers || typeof answers !== 'object') return c.json({ error: 'Answer the three questions first.' }, 400);
  const clean = Object.fromEntries(['coded', 'contest', 'focus'].map((k) => [k, Math.trunc(Number(answers[k]) || 0)]));
  const { start, focus } = placementFor(clean);
  await c.env.DB
    .prepare(
      `INSERT INTO board_placement (user_id, answers, start, focus) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, start = excluded.start, focus = excluded.focus`
    )
    .bind(c.get('user').id, JSON.stringify(clean), JSON.stringify(start), focus)
    .run();
  return c.json({ start, focus });
});

const rungById = (db, id) => db.prepare('SELECT * FROM rungs WHERE id = ? AND hidden = 0').bind(Number(id) || 0).first();

/** Opening a rung marks it started (never downgrades a done one). */
boardRouter.post('/board/rungs/:id/start', requireUser, async (c) => {
  const rung = await rungById(c.env.DB, c.req.param('id'));
  if (!rung) return c.json({ error: 'No such rung.' }, 404);
  await c.env.DB
    .prepare(`INSERT INTO rung_progress (user_id, rung_id, status) VALUES (?, ?, 'started') ON CONFLICT(user_id, rung_id) DO NOTHING`)
    .bind(c.get('user').id, rung.id)
    .run();
  return c.json({ ok: true });
});

/**
 * Tick a rung and send it to the ledger. The ledger is idempotent on
 * `rung:<id>`, so ticking the same rung again never pays twice.
 */
async function finishRung(db, user, rung, method) {
  await markDone(db, user.id, rung.id, method);
  const p = await db.prepare('SELECT status, method FROM rung_progress WHERE user_id = ? AND rung_id = ?').bind(user.id, rung.id).first();
  await awardFromUser(db, user, rungActivity({ ...p, user_id: user.id, rung_id: rung.id, track: rung.track, tier: rung.tier, difficulty: rung.difficulty }));
}

export const markDone = (db, userId, rungId, method) =>
  db
    .prepare(
      `INSERT INTO rung_progress (user_id, rung_id, status, done_at, method) VALUES (?, ?, 'done', datetime('now'), ?)
       ON CONFLICT(user_id, rung_id) DO UPDATE SET
         method  = CASE WHEN status = 'done' THEN method ELSE excluded.method END,
         done_at = COALESCE(done_at, excluded.done_at),
         status  = 'done'`
    )
    .bind(userId, rungId, method)
    .run();

/**
 * Body by verify mode: checkbox/codeforces {}, answer { answer },
 * internal { passed: true } (sent by the judge page).
 */
boardRouter.post('/board/rungs/:id/done', requireUser, async (c) => {
  const db = c.env.DB;
  const rung = await rungById(db, c.req.param('id'));
  if (!rung) return c.json({ error: 'No such rung.' }, 404);
  const body = await c.req.json().catch(() => ({}));

  let method;
  if (rung.verify === 'answer') {
    if (!normAnswer(body?.answer)) return c.json({ error: 'Type your answer first.' }, 400);
    if ((await hashAnswer(body.answer)) !== rung.answer_hash) return c.json({ correct: false });
    method = 'answer';
  } else if (rung.verify === 'internal') {
    if (body?.passed !== true) return c.json({ error: 'Pass every test on the problem page first.' }, 400);
    method = 'judge';
  } else method = 'self'; // checkbox, and codeforces until C4 confirms it

  await finishRung(db, c.get('user'), rung, method);
  return c.json({ correct: true, method });
});

/** Un-tick a self-reported rung (a mis-click). Checked answers stay checked. */
boardRouter.post('/board/rungs/:id/undo', requireUser, async (c) => {
  const res = await c.env.DB
    .prepare(`UPDATE rung_progress SET status = 'started', done_at = NULL, method = '' WHERE user_id = ? AND rung_id = ? AND method = 'self'`)
    .bind(c.get('user').id, Number(c.req.param('id')) || 0)
    .run();
  return c.json({ ok: Boolean(res.meta.changes) });
});

/** The /p/<slug> judge page reports a pass; every rung pointing at it ticks. */
boardRouter.post('/board/solve', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const slug = String(body?.slug ?? '');
  if (body?.passed !== true || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return c.json({ error: 'Pass every test first.' }, 400);
  const db = c.env.DB;
  const rows = (await db.prepare(`SELECT * FROM rungs WHERE url = ? AND verify = 'internal' AND hidden = 0`).bind(`/p/${slug}`).all()).results;
  for (const r of rows) await finishRung(db, c.get('user'), r, 'judge');
  return c.json({ ticked: rows.map((r) => r.id) });
});

/* -------------------------------- officers -------------------------------- */

boardAdminRouter.get('/board/rungs', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM rungs').all()).results;
  // The hash stays here too; officers only need to know an answer is set.
  return c.json({ rungs: rows.map((r) => ({ ...publicRung(r), hasAnswer: Boolean(r.answer_hash) })) });
});

boardAdminRouter.post('/board/rungs', async (c) => {
  const { error, value: v } = await validateRung(await c.req.json().catch(() => null));
  if (error) return c.json({ error }, 400);
  const db = c.env.DB;
  if (await db.prepare('SELECT 1 AS x FROM rungs WHERE track = ? AND url = ?').bind(v.track, v.url).first()) {
    return c.json({ error: 'That link is already a rung on this track.' }, 409);
  }
  const { n } = await db.prepare('SELECT COALESCE(MAX(ord), -1) + 1 AS n FROM rungs WHERE track = ? AND tier = ?').bind(v.track, v.tier).first();
  const res = await db
    .prepare(
      `INSERT INTO rungs (track, tier, ord, title, url, hint, difficulty, tags, verify, answer_hash, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(v.track, v.tier, n, v.title, v.url, v.hint, v.difficulty, v.tags, v.verify, v.answer_hash ?? '', c.get('officer')?.name ?? 'officer')
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

boardAdminRouter.put('/board/rungs/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id')) || 0;
  const old = await db.prepare('SELECT * FROM rungs WHERE id = ?').bind(id).first();
  if (!old) return c.json({ error: 'No such rung.' }, 404);
  const { error, value: v } = await validateRung(await c.req.json().catch(() => null), { partial: true });
  if (error) return c.json({ error }, 400);
  if (v.verify === 'answer' && v.answer_hash === undefined && !old.answer_hash) return c.json({ error: 'An answer-checked rung needs the answer.' }, 400);
  // Moving to another tier puts it at the end of that tier.
  const ord = v.track === old.track && v.tier === old.tier
    ? old.ord
    : (await db.prepare('SELECT COALESCE(MAX(ord), -1) + 1 AS n FROM rungs WHERE track = ? AND tier = ?').bind(v.track, v.tier).first()).n;
  try {
    await db
      .prepare(
        `UPDATE rungs SET track = ?, tier = ?, ord = ?, title = ?, url = ?, hint = ?, difficulty = ?, tags = ?, verify = ?,
           answer_hash = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(v.track, v.tier, ord, v.title, v.url, v.hint, v.difficulty, v.tags, v.verify, v.answer_hash ?? old.answer_hash, id)
      .run();
  } catch {
    return c.json({ error: 'That link is already a rung on this track.' }, 409);
  }
  return c.json({ ok: true });
});

/** Swap with the neighbour above (-1) or below (+1) in the same tier. */
boardAdminRouter.post('/board/rungs/:id/move', async (c) => {
  const db = c.env.DB;
  const rung = await db.prepare('SELECT * FROM rungs WHERE id = ?').bind(Number(c.req.param('id')) || 0).first();
  if (!rung) return c.json({ error: 'No such rung.' }, 404);
  const dir = Number((await c.req.json().catch(() => ({})))?.dir);
  if (dir !== -1 && dir !== 1) return c.json({ error: 'Direction is -1 (up) or 1 (down).' }, 400);
  const tier = ladderOf((await db.prepare('SELECT * FROM rungs WHERE track = ? AND tier = ?').bind(rung.track, rung.tier).all()).results, rung.track);
  const i = tier.findIndex((r) => r.id === rung.id);
  const j = i + dir;
  if (j < 0 || j >= tier.length) return c.json({ ok: true }); // already at the edge
  [tier[i], tier[j]] = [tier[j], tier[i]];
  // Renumber the whole tier so ties from older rows cannot make the swap a no-op.
  await db.batch(tier.map((r, k) => db.prepare('UPDATE rungs SET ord = ? WHERE id = ?').bind(k, r.id)));
  return c.json({ ok: true });
});

/** Hide rather than delete, so members keep their history. */
boardAdminRouter.post('/board/rungs/:id/hide', async (c) => {
  const hidden = (await c.req.json().catch(() => ({})))?.hidden === false ? 0 : 1;
  const res = await c.env.DB.prepare(`UPDATE rungs SET hidden = ?, updated_at = datetime('now') WHERE id = ?`).bind(hidden, Number(c.req.param('id')) || 0).run();
  if (!res.meta.changes) return c.json({ error: 'No such rung.' }, 404);
  return c.json({ ok: true });
});

/** Reads the page title of a pasted link so the officer does not have to type it. */
boardAdminRouter.post('/board/peek', async (c) => {
  const url = String((await c.req.json().catch(() => ({})))?.url ?? '').trim();
  if (!/^https:\/\/[^\s]{4,500}$/.test(url)) return c.json({ title: '' });
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PEHS-CS-Club-Board/1.0' }, signal: AbortSignal.timeout(5000) });
    const html = (await res.text()).slice(0, 200_000);
    const raw = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ?? '';
    const title = raw.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return c.json({ title: title.slice(0, 120) });
  } catch {
    return c.json({ title: '' });
  }
});

/** C5: USACO contest windows, one per line, edited by officers. */
boardAdminRouter.get('/board/usaco', async (c) => c.json({ text: await getSetting(c.env.DB, CONTESTS_KEY, '') }));
boardAdminRouter.put('/board/usaco', async (c) => {
  const text = String((await c.req.json().catch(() => ({})))?.text ?? '').slice(0, 2000);
  await setSetting(c.env.DB, CONTESTS_KEY, text);
  return c.json({ ok: true, next: parseContests(text) });
});
