/**
 * Data arena (C12): a club-sized Kaggle. A challenge is a training CSV, a test
 * CSV with the target removed, and hidden answers. Members analyse the data in
 * the browser and submit a predictions CSV; the server scores it and keeps a
 * leaderboard.
 *
 * The answers stay in D1 (`answers_csv`). No route selects that column for a
 * response; only the scorer reads it. Scoring and file checks are pure code in
 * shared/data.js.
 */
import { Hono } from 'hono';

import {
  METRICS, MAX_CSV_BYTES, readColumns, validatePredictions, scoreSubmission, rankRows, checkChallengeFiles,
} from '../../shared/data.js';
import { currentUser, requireUser } from './users.js';
import { hitOrRefuse } from './ratelimit.js';
import { awardFromUser } from './award.js';
import { PUBLIC_NAME_SQL } from './names.js';

export const dataRouter = new Hono();
export const dataAdminRouter = new Hono();

const ATTEMPTS_PER_DAY = 20; // counted on every upload, valid or not, so the public score cannot be probed
const DAY_MS = 86_400_000;

/** The columns a browser may see. Never `answers_csv`. */
const PUBLIC_COLS = 'id, title, summary, metric, id_col, target_col, rows, status, created_at';

const shape = (r) => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  metric: r.metric,
  idCol: r.id_col,
  targetCol: r.target_col,
  rows: r.rows,
  status: r.status,
  createdAt: r.created_at,
});

const challengeById = (db, id) => db.prepare(`SELECT ${PUBLIC_COLS} FROM data_challenges WHERE id = ?`).bind(Number(id) || 0).first();

/** Everyone's best score on a challenge, best first, first names only (G5). */
async function leaderboard(db, ch, userId) {
  const rows = (
    await db
      .prepare(
        `SELECT d.user_id, d.public_score, d.final_score, ${PUBLIC_NAME_SQL} AS name
         FROM data_submissions d
         JOIN users u ON u.id = d.user_id AND u.deleted_at IS NULL
         LEFT JOIN students s ON s.id = u.student_id
         WHERE d.challenge_id = ?`
      )
      .bind(ch.id)
      .all()
  ).results;
  const closed = ch.status === 'closed';
  const key = closed ? 'final_score' : 'public_score';
  const best = new Map();
  const tries = new Map();
  for (const r of rows) {
    tries.set(r.user_id, (tries.get(r.user_id) ?? 0) + 1);
    const cur = best.get(r.user_id);
    const dir = METRICS[ch.metric].higherIsBetter ? -1 : 1;
    if (!cur || dir * (r[key] - cur[key]) < 0) best.set(r.user_id, r);
  }
  const ranked = rankRows([...best.values()].map((r) => ({ ...r, name: r.name || 'Member' })), ch.metric, (r) => r[key]);
  let last = null;
  let rank = 0;
  return ranked.slice(0, 50).map((r, i) => {
    if (r[key] !== last) rank = i + 1;
    last = r[key];
    return { rank, name: r.name, score: r[key], tries: tries.get(r.user_id), mine: r.user_id === userId };
  });
}

/* --------------------------------- public --------------------------------- */

dataRouter.get('/data/challenges', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c);
  const list = (await db.prepare(`SELECT ${PUBLIC_COLS} FROM data_challenges ORDER BY id DESC`).all()).results;
  const counts = Object.fromEntries(
    (await db.prepare('SELECT challenge_id, COUNT(DISTINCT user_id) AS n FROM data_submissions GROUP BY challenge_id').all()).results.map((r) => [r.challenge_id, r.n])
  );
  const mine = user
    ? Object.fromEntries((await db.prepare('SELECT DISTINCT challenge_id FROM data_submissions WHERE user_id = ?').bind(user.id).all()).results.map((r) => [r.challenge_id, true]))
    : {};
  return c.json({ challenges: list.map((r) => ({ ...shape(r), players: counts[r.id] ?? 0, submitted: Boolean(mine[r.id]) })), signedIn: Boolean(user) });
});

dataRouter.get('/data/challenges/:id', async (c) => {
  const db = c.env.DB;
  const ch = await challengeById(db, c.req.param('id'));
  if (!ch) return c.json({ error: 'No such challenge.' }, 404);
  const user = await currentUser(c);
  let mine = null;
  if (user) {
    const rows = (await db.prepare('SELECT public_score, final_score FROM data_submissions WHERE challenge_id = ? AND user_id = ?').bind(ch.id, user.id).all()).results;
    mine = { tries: rows.length };
  }
  return c.json({ ...shape(ch), mine, leaderboard: await leaderboard(db, ch, user?.id), signedIn: Boolean(user) });
});

/** The datasets are public (members load them into pandas); the answers never are. */
for (const [file, col] of [['train', 'train_csv'], ['test', 'test_csv']]) {
  dataRouter.get(`/data/challenges/:id/${file}.csv`, async (c) => {
    const row = await c.env.DB.prepare(`SELECT ${col} AS csv FROM data_challenges WHERE id = ?`).bind(Number(c.req.param('id')) || 0).first();
    if (!row) return c.json({ error: 'No such challenge.' }, 404);
    return new Response(row.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-cache' } });
  });
}

dataRouter.post('/data/challenges/:id/submit', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ch = await challengeById(db, c.req.param('id'));
  if (!ch) return c.json({ error: 'No such challenge.' }, 404);
  if (ch.status !== 'open') return c.json({ error: 'This challenge is closed.' }, 409);

  // Size first, before spending any work on the body.
  if (Number(c.req.header('content-length')) > MAX_CSV_BYTES + 2000) return c.json({ error: `The file is too big. Keep it under ${Math.round(MAX_CSV_BYTES / 1000)} KB.` }, 413);
  const body = await c.req.json().catch(() => null);
  const csv = body?.csv;
  if (typeof csv !== 'string' || !csv.trim()) return c.json({ error: 'Attach a predictions CSV first.' }, 400);
  if (csv.length > MAX_CSV_BYTES) return c.json({ error: `The file is too big. Keep it under ${Math.round(MAX_CSV_BYTES / 1000)} KB.` }, 413);

  if (await hitOrRefuse(db, `data:${user.id}:${ch.id}`, ATTEMPTS_PER_DAY, DAY_MS)) {
    return c.json({ error: `That is ${ATTEMPTS_PER_DAY} uploads today on this challenge. Try again tomorrow.` }, 429);
  }

  // The answers are read here, inside the Worker, and used only to score.
  const ansRow = await db.prepare('SELECT answers_csv FROM data_challenges WHERE id = ?').bind(ch.id).first();
  const answers = readColumns(ansRow.answers_csv, ch.id_col, ch.target_col, 'The answers file').map;
  const { preds, error } = validatePredictions(csv, answers, { idCol: ch.id_col, targetCol: ch.target_col, metric: ch.metric });
  if (error) return c.json({ error }, 400);

  const s = scoreSubmission(ch.metric, preds, answers, ch.id);
  await db.prepare('INSERT INTO data_submissions (challenge_id, user_id, public_score, final_score) VALUES (?, ?, ?, ?)').bind(ch.id, user.id, s.public, s.final).run();
  // First valid submission pays once (the ledger is idempotent on the ref). Rank never pays.
  const paid = await awardFromUser(db, user, { userId: user.id, kind: 'solve', ref: `data:${ch.id}`, meta: { title: `Data: ${ch.title}` } });
  return c.json({ publicScore: s.public, awarded: paid?.awarded ?? 0, leaderboard: await leaderboard(db, ch, user.id) });
});

/* -------------------------------- officers -------------------------------- */

dataAdminRouter.get('/data/challenges', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT ${PUBLIC_COLS.split(', ').map((x) => `c.${x}`).join(', ')}, (SELECT COUNT(*) FROM data_submissions WHERE challenge_id = c.id) AS submissions
         FROM data_challenges c ORDER BY c.id DESC`
      )
      .all()
  ).results;
  return c.json({ challenges: rows.map((r) => ({ ...shape(r), submissions: r.submissions })) });
});

dataAdminRouter.post('/data/challenges', async (c) => {
  const b = (await c.req.json().catch(() => null)) ?? {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const title = str(b.title);
  const summary = str(b.summary);
  if (!title || title.length > 100) return c.json({ error: 'Give it a title of up to 100 characters.' }, 400);
  if (summary.length > 3000) return c.json({ error: 'Keep the description under 3000 characters.' }, 400);
  const idCol = str(b.idCol);
  const targetCol = str(b.targetCol);
  const checked = checkChallengeFiles({ train: b.train, test: b.test, answers: b.answers, idCol, targetCol, metric: str(b.metric) });
  if (checked.error) return c.json({ error: checked.error }, 400);
  const res = await c.env.DB
    .prepare(
      `INSERT INTO data_challenges (title, summary, metric, id_col, target_col, train_csv, test_csv, answers_csv, rows, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(title, summary, str(b.metric), idCol, targetCol, b.train, b.test, b.answers, checked.rows, c.get('officer')?.name ?? 'officer')
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

/** Closing flips the leaderboard to final scores (all rows) and stops new uploads. */
dataAdminRouter.post('/data/challenges/:id/status', async (c) => {
  const status = (await c.req.json().catch(() => ({})))?.status;
  if (status !== 'open' && status !== 'closed') return c.json({ error: 'Status is open or closed.' }, 400);
  const res = await c.env.DB.prepare('UPDATE data_challenges SET status = ? WHERE id = ?').bind(status, Number(c.req.param('id')) || 0).run();
  if (!res.meta.changes) return c.json({ error: 'No such challenge.' }, 404);
  return c.json({ ok: true });
});

dataAdminRouter.delete('/data/challenges/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id')) || 0;
  // Foreign keys are not guaranteed on in D1, so remove the children explicitly.
  await db.batch([db.prepare('DELETE FROM data_submissions WHERE challenge_id = ?').bind(id), db.prepare('DELETE FROM data_challenges WHERE id = ?').bind(id)]);
  return c.json({ ok: true });
});
