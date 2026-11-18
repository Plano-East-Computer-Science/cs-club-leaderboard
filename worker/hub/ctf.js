/**
 * CTF board (C11): flag challenges by category, a solo and squad scoreboard,
 * and members writing challenges for officers to approve.
 *
 * Flags are checked here and never sent out: only the SHA-256 of the normalised
 * flag is stored, and no response carries `flag_hash`. A correct flag records a
 * `solve` activity (ref `ctf:<id>`, so it never pays twice). An approved
 * member-written challenge pays its author one `ship` (ref `ctf-author:<id>`),
 * approved by an officer who is not the author.
 *
 * The upcoming-events feed reads the CTFtime rows the opportunity ingest
 * already stores (source = 'ctftime'), so nothing is fetched twice.
 */
import { Hono } from 'hono';

import { CATEGORIES, ctfPoints, validateChallenge } from '../../shared/ctf.js';
import { seasonOf } from '../../shared/points.js';
import { hashAnswer } from './board.js';
import { STARTERS } from './ctf-seed.js';
import { recordActivity } from './ledger.js';
import { hitOrRefuse } from './ratelimit.js';
import { currentUser, requireUser, ensureStudent } from './users.js';
import { awardFromUser } from './award.js';

export const ctfRouter = new Hono();
export const ctfAdminRouter = new Hono();

const GUESS_LIMIT = 10; // wrong or right, per member per minute
const MAX_PENDING = 3; // member-written challenges waiting for review, per member

const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Member';

/** Inserts the starter set once. Cheap: one COUNT per request until the table has rows. */
let seeded = false;
export async function ensureSeeded(db) {
  if (seeded) return;
  const n = (await db.prepare(`SELECT COUNT(*) AS n FROM ctf_challenges WHERE author_user_id IS NULL AND author_name = ''`).first()).n;
  if (!n) {
    await db.batch(
      STARTERS.map((s) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO ctf_challenges (slug, title, category, difficulty, points, body, file_name, file_data, hint, flag_hash, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live')`
          )
          .bind(s.slug, s.title, s.category, s.difficulty, ctfPoints(s.difficulty), s.body, s.file_name, s.file_data, s.hint, s.flag_hash)
      )
    );
  }
  seeded = true;
}
/** Tests build a fresh database per run. */
export const resetSeedFlag = () => { seeded = false; };

// Columns a browser may see. `flag_hash` is deliberately not here.
const LIST_COLS = 'c.id, c.slug, c.title, c.category, c.difficulty, c.points';

/** Next live CTFtime events from the opportunity table (already ingested daily). */
async function upcomingEvents(db) {
  return (
    await db
      .prepare(
        `SELECT id, title, url, deadline AS starts FROM opportunities
         WHERE source = 'ctftime' AND status = 'live' AND deadline IS NOT NULL AND deadline >= date('now')
         ORDER BY deadline LIMIT 8`
      )
      .all()
  ).results;
}

/** Scores per member from live and retired challenges, then rolled up per squad for this season. */
export async function scoreboard(db, now = new Date()) {
  const rows = (
    await db
      .prepare(
        `SELECT u.id AS user_id, u.name, u.student_id, COUNT(*) AS solves, SUM(c.points) AS score, MAX(s.solved_at) AS last
         FROM ctf_solves s
         JOIN ctf_challenges c ON c.id = s.challenge_id AND c.status IN ('live', 'retired')
         JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
         GROUP BY u.id ORDER BY score DESC, last ASC`
      )
      .all()
  ).results;
  const solo = rows.slice(0, 20).map((r, i) => ({ place: i + 1, name: firstName(r.name), solves: r.solves, score: r.score }));
  const byStudent = new Map(rows.filter((r) => r.student_id).map((r) => [r.student_id, r]));
  const members = (
    await db
      .prepare(
        `SELECT q.id, q.name, q.color, m.student_id FROM squads q
         LEFT JOIN squad_members m ON m.squad_id = q.id WHERE q.season = ? ORDER BY q.id`
      )
      .bind(seasonOf(now))
      .all()
  ).results;
  const squads = new Map();
  for (const m of members) {
    if (!squads.has(m.id)) squads.set(m.id, { name: m.name, color: m.color, score: 0, solves: 0 });
    const r = byStudent.get(m.student_id);
    if (r) {
      squads.get(m.id).score += r.score;
      squads.get(m.id).solves += r.solves;
    }
  }
  const list = [...squads.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { solo, squads: list };
}

/* --------------------------------- public --------------------------------- */

ctfRouter.get('/ctf', async (c) => {
  const db = c.env.DB;
  await ensureSeeded(db);
  const user = await currentUser(c);
  const challenges = (
    await db
      .prepare(
        `SELECT ${LIST_COLS}, (SELECT COUNT(*) FROM ctf_solves s WHERE s.challenge_id = c.id) AS solves,
                EXISTS (SELECT 1 FROM ctf_solves s WHERE s.challenge_id = c.id AND s.user_id = ?) AS solved,
                (c.author_user_id IS NOT NULL AND c.author_user_id = ?) AS mine
         FROM ctf_challenges c WHERE c.status = 'live' ORDER BY c.category, c.difficulty, c.title`
      )
      .bind(user?.id ?? 0, user?.id ?? 0)
      .all()
  ).results.map((r) => ({ ...r, solved: Boolean(r.solved), mine: Boolean(r.mine) }));
  return c.json({ categories: CATEGORIES, challenges, events: await upcomingEvents(db), signedIn: Boolean(user) });
});

ctfRouter.get('/ctf/scoreboard', async (c) => {
  await ensureSeeded(c.env.DB);
  return c.json(await scoreboard(c.env.DB));
});

// The member's own submissions, with their review status.
ctfRouter.get('/ctf/mine', requireUser, async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT id, slug, title, category, difficulty, status, reject_reason, created_at FROM ctf_challenges
         WHERE author_user_id = ? ORDER BY id DESC LIMIT 50`
      )
      .bind(c.get('user').id)
      .all()
  ).results;
  return c.json({ challenges: rows });
});

ctfRouter.get('/ctf/challenges/:slug', async (c) => {
  await ensureSeeded(c.env.DB);
  const row = await c.env.DB
    .prepare(`SELECT ${LIST_COLS}, c.body, c.file_name, c.file_data, c.hint, c.author_name FROM ctf_challenges c WHERE c.slug = ? AND c.status = 'live'`)
    .bind(c.req.param('slug'))
    .first();
  if (!row) return c.json({ error: 'No such challenge.' }, 404);
  return c.json({ ...row, author_name: row.author_name ? firstName(row.author_name) : '' });
});

ctfRouter.post('/ctf/challenges/:slug/solve', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const guess = typeof body?.flag === 'string' ? body.flag : '';
  if (!guess.trim() || guess.length > 200) return c.json({ error: 'Type a flag first.' }, 400);
  if (await hitOrRefuse(db, `ctf:${user.id}`, GUESS_LIMIT, 60_000)) {
    return c.json({ error: 'Too many guesses. Wait a minute and try again.' }, 429);
  }
  const ch = await db.prepare(`SELECT id, title, category, difficulty, flag_hash, author_user_id FROM ctf_challenges WHERE slug = ? AND status = 'live'`).bind(c.req.param('slug')).first();
  if (!ch) return c.json({ error: 'No such challenge.' }, 404);
  if (ch.author_user_id === user.id) return c.json({ error: 'You wrote this one, so it does not score for you.' }, 403);
  if ((await hashAnswer(guess)) !== ch.flag_hash) return c.json({ correct: false });

  const ins = await db.prepare('INSERT OR IGNORE INTO ctf_solves (challenge_id, user_id) VALUES (?, ?)').bind(ch.id, user.id).run();
  let awarded = 0;
  if (ins.meta?.changes) {
    const studentId = await ensureStudent(db, user);
    const res = await awardFromUser(db, { ...user, student_id: studentId }, {
      userId: user.id,
      kind: 'solve',
      ref: `ctf:${ch.id}`,
      meta: { title: ch.title, category: ch.category, ctf: true },
    });
    awarded = res?.awarded ?? 0;
  }
  return c.json({ correct: true, already: !ins.meta?.changes, awarded });
});

// Members propose a challenge; it stays hidden until an officer approves it.
ctfRouter.post('/ctf/challenges', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { error, value: v } = validateChallenge(await c.req.json().catch(() => null));
  if (error) return c.json({ error }, 400);
  const pending = (await db.prepare(`SELECT COUNT(*) AS n FROM ctf_challenges WHERE author_user_id = ? AND status = 'pending'`).bind(user.id).first()).n;
  if (pending >= MAX_PENDING) return c.json({ error: `You already have ${MAX_PENDING} challenges waiting for review. Wait for an officer to look at them.` }, 429);

  const stem = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'challenge';
  const slug = `${stem}-${crypto.randomUUID().slice(0, 6)}`;
  const res = await db
    .prepare(
      `INSERT INTO ctf_challenges (slug, title, category, difficulty, points, body, file_name, file_data, hint, flag_hash, status, author_user_id, author_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(slug, v.title, v.category, v.difficulty, ctfPoints(v.difficulty), v.body, v.file_name, v.file_data, v.hint, await hashAnswer(v.flag), user.id, user.name || 'Member')
    .run();
  return c.json({ id: res.meta.last_row_id, status: 'pending' }, 201);
});

/* -------------------------------- officers -------------------------------- */

const ADMIN_COLS = 'id, slug, title, category, difficulty, points, body, file_name, file_data, hint, status, author_user_id, author_name, decided_name, decided_at, reject_reason, created_at';
const idOf = (c) => Number(c.req.param('id'));

ctfAdminRouter.get('/ctf', async (c) => {
  const status = ['pending', 'live', 'rejected', 'retired'].includes(c.req.query('status')) ? c.req.query('status') : 'pending';
  const rows = (await c.env.DB.prepare(`SELECT ${ADMIN_COLS} FROM ctf_challenges WHERE status = ? ORDER BY id DESC LIMIT 200`).bind(status).all()).results;
  return c.json({ challenges: rows });
});

// Officers cannot read a flag back (only its hash is stored), so they test one instead.
ctfAdminRouter.post('/ctf/:id/check', async (c) => {
  const row = await c.env.DB.prepare('SELECT flag_hash FROM ctf_challenges WHERE id = ?').bind(idOf(c)).first();
  if (!row) return c.json({ error: 'No such challenge.' }, 404);
  const b = await c.req.json().catch(() => null);
  return c.json({ correct: typeof b?.flag === 'string' && (await hashAnswer(b.flag)) === row.flag_hash });
});

ctfAdminRouter.post('/ctf/:id/approve', async (c) => {
  const db = c.env.DB;
  const officer = c.get('officer');
  const ch = await db.prepare('SELECT id, title, status, author_user_id FROM ctf_challenges WHERE id = ?').bind(idOf(c)).first();
  if (!ch) return c.json({ error: 'No such challenge.' }, 404);
  if (ch.status !== 'pending') return c.json({ error: `That one is already ${ch.status}.` }, 409);
  // Same rule as claims: nobody approves their own work.
  if (ch.author_user_id != null && officer?.userId === ch.author_user_id) {
    return c.json({ error: 'You cannot approve your own challenge. Ask another officer.' }, 403);
  }
  const res = await db
    .prepare(`UPDATE ctf_challenges SET status = 'live', decided_name = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`)
    .bind(officer?.name ?? null, ch.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'That one was just decided.' }, 409);

  let awarded = 0;
  if (ch.author_user_id != null) {
    const au = await db.prepare('SELECT id, name, student_id FROM users WHERE id = ?').bind(ch.author_user_id).first();
    const studentId = au && (au.student_id ?? (await ensureStudent(db, au)));
    if (studentId) {
      // The officer's approval is the review a `ship` normally waits for, so it is paid approved.
      const r = await recordActivity(db, { studentId, kind: 'ship', ref: `ctf-author:${ch.id}`, status: 'approved', meta: { title: `CTF challenge: ${ch.title}`, ctf: true } });
      awarded = r.awarded;
      if (!r.duplicate) {
        await db
          .prepare(`UPDATE activity SET decided_by = ?, decided_name = ?, decided_at = datetime('now') WHERE id = ?`)
          .bind(officer?.userId ?? null, officer?.name ?? null, r.activityId)
          .run();
      }
    }
  }
  return c.json({ ok: true, awarded });
});

ctfAdminRouter.post('/ctf/:id/reject', async (c) => {
  const b = await c.req.json().catch(() => null);
  const reason = String(typeof b?.reason === 'string' ? b.reason : '').trim().slice(0, 200);
  const res = await c.env.DB
    .prepare(`UPDATE ctf_challenges SET status = 'rejected', reject_reason = ?, decided_name = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`)
    .bind(reason, c.get('officer')?.name ?? null, idOf(c))
    .run();
  if (!res.meta.changes) return c.json({ error: 'No pending challenge with that id.' }, 404);
  return c.json({ ok: true });
});

// Retire rather than delete: solves and ledger rows still point at it.
ctfAdminRouter.post('/ctf/:id/retire', async (c) => {
  const res = await c.env.DB.prepare(`UPDATE ctf_challenges SET status = 'retired' WHERE id = ? AND status = 'live'`).bind(idOf(c)).run();
  if (!res.meta.changes) return c.json({ error: 'No live challenge with that id.' }, 404);
  return c.json({ ok: true });
});
