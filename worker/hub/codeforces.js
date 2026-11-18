/**
 * Codeforces link and sync (C4). A member proves they own a handle by
 * submitting a deliberate Compilation Error to problem 4A; after that an
 * hourly cron pulls their solved problems and rating, ticks Board rungs whose
 * verify mode is `codeforces`, and sends fresh solves to the ledger.
 *
 * Codeforces may refuse requests from Cloudflare Worker IPs (403 or an HTML
 * page). When it does we record `cf_last_error` and the member's browser can
 * do the fetching instead (the API sends CORS headers), posting the list to
 * /codeforces/sync-from-browser. That path is the honour system, like the
 * in-browser judge: the server checks shape only.
 */
import { Hono } from 'hono';

import {
  CHALLENGE, CHALLENGE_URL, BLOCKED_MSG, GAP_MS, MAX_PER_RUN, STATUS_COUNT,
  cleanHandle, challengeMet, solvedFrom, rungsSolved, problemOfUrl, makePacer,
} from '../../shared/codeforces.js';
import { requireUser } from './users.js';
import { awardFromUser } from './award.js';
import { markDone } from './board.js';
import { rungActivity } from './board-awards.js';

export const codeforcesRouter = new Hono();

const WEEK_MS = 7 * 86_400_000;
const GRACE_MS = 2 * 60_000; // a slow verify click still counts
const TRY_GAP_MS = 10_000;
const SYNC_NOW_GAP_MS = 5 * 60_000;

/** One Codeforces API GET -> { data } or { error: 'blocked' | 'cf', message }. */
export async function cfGet(path, fetchFn = fetch) {
  let res;
  let text;
  try {
    res = await fetchFn(`https://codeforces.com/api/${path}`, {
      headers: { 'User-Agent': 'PEHS-CS-Club-Sync/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    text = await res.text();
  } catch {
    return { error: 'blocked' };
  }
  // 403/429/503 or an HTML page (a bot check) means "no answer", not "no such user".
  if ([403, 429, 503].includes(res.status) || text.trimStart().startsWith('<')) return { error: 'blocked' };
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    return { error: 'blocked' };
  }
  if (j?.status !== 'OK') return { error: 'cf', message: String(j?.comment ?? 'unknown error').slice(0, 160) };
  return { data: j.result };
}

export const errorText = (r) => (r.error === 'blocked' ? BLOCKED_MSG : `Codeforces said: ${r.message}`);

/** Submissions that belong to this handle (the API also lists team entries). */
const ownedBy = (subs, handle) =>
  (Array.isArray(subs) ? subs : []).filter((s) => !s?.author?.members || s.author.members.some((m) => String(m?.handle).toLowerCase() === handle.toLowerCase()));

/**
 * Store solves, tick matching rungs, pay the ledger. A solve that matches a
 * rung pays through the rung's ref (`rung:<id>`) so ticking it by hand and
 * syncing it can never pay twice; other fresh solves pay `cf:<contest><idx>`.
 * Only the last week of solves is sent, so a first sync of an old account does
 * not flood the ledger (it caps solves at 10 a week anyway).
 */
export async function applySolves(db, user, solved, nowMs = Date.now()) {
  if (solved.length) {
    await db.batch(
      solved.map((s) =>
        db
          .prepare('INSERT OR IGNORE INTO cf_solves (user_id, contest_id, idx, rating, solved_at) VALUES (?, ?, ?, ?, ?)')
          .bind(user.id, s.contest_id, s.idx, s.rating, s.solved_at)
      )
    );
  }
  const rungs = (await db.prepare(`SELECT * FROM rungs WHERE verify = 'codeforces' AND hidden = 0`).all()).results;
  const hit = rungsSolved(rungs, solved);
  const onRung = new Set();
  for (const r of hit) {
    const p = problemOfUrl(r.url);
    onRung.add(`${p.contest}${p.idx}`);
    await markDone(db, user.id, r.id, 'codeforces');
    const row = await db.prepare('SELECT status, method FROM rung_progress WHERE user_id = ? AND rung_id = ?').bind(user.id, r.id).first();
    await awardFromUser(db, user, rungActivity({ ...row, user_id: user.id, rung_id: r.id, track: r.track, tier: r.tier, difficulty: r.difficulty }));
  }
  for (const s of solved) {
    if (onRung.has(`${s.contest_id}${s.idx}`) || s.solved_at * 1000 < nowMs - WEEK_MS) continue;
    await awardFromUser(db, user, {
      userId: user.id,
      kind: 'solve',
      ref: `cf:${s.contest_id}${s.idx}`,
      meta: { track: 'contest', method: 'codeforces', difficulty: s.rating, honour: false },
    });
  }
  return { solved: solved.length, ticked: hit.map((r) => r.id) };
}

const markSynced = (db, id, nowMs, error) =>
  db.prepare('UPDATE users SET cf_synced_at = ?, cf_last_error = ? WHERE id = ?').bind(nowMs, error, id).run();

/**
 * Sync these verified members. Requests are spaced GAP_MS apart (Codeforces
 * allows one per two seconds). Ratings come from one batched user.info call.
 * If the first answer shows we are blocked, the rest are not tried.
 */
export async function syncUsers(db, users, { get = cfGet, now = () => Date.now(), pacer } = {}) {
  const wait = pacer ?? makePacer(GAP_MS, now);
  const ok = [];
  let blocked = null;
  for (const u of users) {
    if (blocked) {
      await markSynced(db, u.id, now(), errorText(blocked));
      continue;
    }
    await wait();
    const r = await get(`user.status?handle=${encodeURIComponent(u.cf_handle)}&from=1&count=${STATUS_COUNT}`);
    if (r.error) {
      await markSynced(db, u.id, now(), errorText(r));
      if (r.error === 'blocked') blocked = r;
      continue;
    }
    await applySolves(db, u, solvedFrom(r.data, { nowSec: now() / 1000 }), now());
    await markSynced(db, u.id, now(), null);
    ok.push(u);
  }
  if (ok.length) {
    await wait();
    const info = await get(`user.info?handles=${ok.map((u) => encodeURIComponent(u.cf_handle)).join(';')}`);
    if (!info.error) {
      const rating = new Map(info.data.map((i) => [String(i.handle).toLowerCase(), Number.isInteger(i.rating) ? i.rating : null]));
      for (const u of ok) await db.prepare('UPDATE users SET cf_rating = ? WHERE id = ?').bind(rating.get(u.cf_handle.toLowerCase()) ?? null, u.id).run();
    }
  }
  return { synced: ok.length, attempted: users.length, blocked: Boolean(blocked) };
}

/** The hourly cron: the 20 verified members synced longest ago. */
export async function runCodeforcesSync(env, opts = {}) {
  const users = (
    await env.DB
      .prepare(
        `SELECT id, student_id, cf_handle FROM users WHERE cf_handle IS NOT NULL AND cf_verified_at IS NOT NULL
         ORDER BY COALESCE(cf_synced_at, 0) ASC, id ASC LIMIT ?`
      )
      .bind(MAX_PER_RUN)
      .all()
  ).results;
  return syncUsers(env.DB, users, opts);
}

/* --------------------------------- routes --------------------------------- */

const challengeOf = (ch) => ({
  handle: ch.handle,
  issuedAt: ch.issued_at,
  expiresAt: ch.issued_at + CHALLENGE.minutes * 60_000,
  problem: CHALLENGE_URL,
});

codeforcesRouter.get('/codeforces/me', requireUser, async (c) => {
  const db = c.env.DB;
  const id = c.get('user').id;
  const u = await db.prepare('SELECT cf_handle, cf_verified_at, cf_rating, cf_synced_at, cf_last_error FROM users WHERE id = ?').bind(id).first();
  const ch = await db.prepare('SELECT * FROM cf_challenges WHERE user_id = ?').bind(id).first();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM cf_solves WHERE user_id = ?').bind(id).first();
  return c.json({
    handle: u.cf_handle,
    verified: Boolean(u.cf_handle && u.cf_verified_at),
    rating: u.cf_rating,
    solved: n.n,
    syncedAt: u.cf_synced_at || null,
    error: u.cf_last_error || null,
    challenge: ch && Date.now() < ch.issued_at + CHALLENGE.minutes * 60_000 + GRACE_MS ? challengeOf(ch) : null,
  });
});

codeforcesRouter.post('/codeforces/link', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const handle = cleanHandle(body?.handle);
  if (!handle) return c.json({ error: 'A Codeforces handle is 3 to 24 letters, digits, dots, dashes or underscores.' }, 400);
  const db = c.env.DB;
  const me = c.get('user').id;
  if (await db.prepare('SELECT 1 AS x FROM users WHERE lower(cf_handle) = lower(?) AND id != ?').bind(handle, me).first()) {
    return c.json({ error: 'That handle is already linked to another member.' }, 409);
  }
  const issued_at = Date.now();
  await db
    .prepare(
      `INSERT INTO cf_challenges (user_id, handle, issued_at, tried_at) VALUES (?, ?, ?, 0)
       ON CONFLICT(user_id) DO UPDATE SET handle = excluded.handle, issued_at = excluded.issued_at, tried_at = 0`
    )
    .bind(me, handle, issued_at)
    .run();
  return c.json({ challenge: challengeOf({ handle, issued_at }) });
});

/**
 * Check the challenge. If the club server is blocked, the page may repeat the
 * call with `submissions` it fetched in the member's browser (honour system:
 * anyone can type JSON, so this can only ever confirm a handle, never rank).
 */
codeforcesRouter.post('/codeforces/verify', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const ch = await db.prepare('SELECT * FROM cf_challenges WHERE user_id = ?').bind(user.id).first();
  if (!ch) return c.json({ error: 'Enter your handle first.' }, 400);
  const now = Date.now();
  if (now > ch.issued_at + CHALLENGE.minutes * 60_000 + GRACE_MS) return c.json({ error: 'That challenge ran out. Start again.', expired: true }, 400);
  if (now - ch.tried_at < TRY_GAP_MS) return c.json({ error: 'Give Codeforces a few seconds, then try again.' }, 429);
  await db.prepare('UPDATE cf_challenges SET tried_at = ? WHERE user_id = ?').bind(now, user.id).run();

  let subs;
  const r = await cfGet(`user.status?handle=${encodeURIComponent(ch.handle)}&from=1&count=10`);
  if (r.error === 'blocked') {
    if (!Array.isArray(body?.submissions) || body.submissions.length > 200) return c.json({ error: BLOCKED_MSG, blocked: true }, 502);
    subs = body.submissions;
  } else if (r.error) {
    return c.json({ error: errorText(r) }, 400);
  } else subs = r.data;

  subs = ownedBy(subs, ch.handle);
  if (!challengeMet(subs, ch.issued_at)) {
    return c.json({ verified: false, error: `No Compilation Error on ${CHALLENGE.contestId}${CHALLENGE.index} found yet. It can take a few seconds to show up.` });
  }
  try {
    await db.batch([
      db.prepare('DELETE FROM cf_solves WHERE user_id = ?').bind(user.id), // solves of an older handle
      db.prepare(`UPDATE users SET cf_handle = ?, cf_verified_at = datetime('now'), cf_rating = NULL, cf_synced_at = 0, cf_last_error = NULL WHERE id = ?`).bind(ch.handle, user.id),
      db.prepare('DELETE FROM cf_challenges WHERE user_id = ?').bind(user.id),
    ]);
  } catch {
    return c.json({ error: 'That handle is already linked to another member.' }, 409);
  }
  const summary = await applySolves(db, user, solvedFrom(subs), now);
  return c.json({ verified: true, handle: ch.handle, ...summary });
});

codeforcesRouter.post('/codeforces/unlink', requireUser, async (c) => {
  const id = c.get('user').id;
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET cf_handle = NULL, cf_verified_at = NULL, cf_rating = NULL, cf_synced_at = NULL, cf_last_error = NULL WHERE id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM cf_solves WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM cf_challenges WHERE user_id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

/** "Sync now" from the member's account, at most every five minutes. */
codeforcesRouter.post('/codeforces/sync', requireUser, async (c) => {
  const db = c.env.DB;
  const u = await db.prepare('SELECT id, student_id, cf_handle, cf_verified_at, cf_synced_at FROM users WHERE id = ?').bind(c.get('user').id).first();
  if (!u.cf_handle || !u.cf_verified_at) return c.json({ error: 'Link your Codeforces handle first.' }, 400);
  if (Date.now() - (u.cf_synced_at || 0) < SYNC_NOW_GAP_MS) return c.json({ error: 'Synced a moment ago. Try again in a few minutes.' }, 429);
  const res = await syncUsers(db, [u]);
  const after = await db.prepare('SELECT cf_last_error FROM users WHERE id = ?').bind(u.id).first();
  return c.json({ ...res, error: after.cf_last_error ?? null, blocked: after.cf_last_error === BLOCKED_MSG });
});

/** Browser fallback: the page fetched user.status itself. Shape is checked, content is trusted. */
codeforcesRouter.post('/codeforces/sync-from-browser', requireUser, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const subs = body?.submissions;
  if (!Array.isArray(subs) || subs.length > 200 || subs.some((s) => !s || typeof s !== 'object' || typeof s.problem !== 'object' || s.problem === null)) {
    return c.json({ error: 'Send the submissions list from Codeforces (up to 200 entries).' }, 400);
  }
  const u = await db.prepare('SELECT id, student_id, cf_handle, cf_verified_at FROM users WHERE id = ?').bind(c.get('user').id).first();
  if (!u.cf_handle || !u.cf_verified_at) return c.json({ error: 'Link your Codeforces handle first.' }, 400);
  const res = await applySolves(db, u, solvedFrom(ownedBy(subs, u.cf_handle)));
  const rating = Number.isInteger(body?.rating) && body.rating >= 0 && body.rating <= 5000 ? body.rating : null;
  await db.prepare('UPDATE users SET cf_synced_at = ?, cf_last_error = NULL, cf_rating = COALESCE(?, cf_rating) WHERE id = ?').bind(Date.now(), rating, u.id).run();
  return c.json(res);
});
