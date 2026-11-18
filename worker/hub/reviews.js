/**
 * Code review requests (D5). A member asks for feedback on a public GitHub
 * repo or on one workspace file; other members leave a few comments; the
 * asker marks a review "helpful", which pays the reviewer a `mentor` activity.
 *
 * Workspace files are copied into the request when it is made (a snapshot), so
 * later edits are never exposed and no other workspace file is reachable. The
 * snapshot is shown to signed-in members only and is wiped when the request
 * closes. Points are farm-resistant: the asker alone decides, never their own
 * request, once per pair of members ever, at most 3 per request and 3 payouts
 * per reviewer per week. Names shown are first names (or full if opted in).
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { recordActivity } from './ledger.js';
import { hitOrRefuse } from './ratelimit.js';
import { publicName } from './names.js';
import { pathError } from '../../shared/workspace.js';
import { LIMITS, cleanRepoUrl, cleanComments, lineCount } from '../../shared/reviews.js';

export const reviewsRouter = new Hono();

const parse = (s) => {
  try { return JSON.parse(s); } catch { return []; }
};

reviewsRouter.get('/reviews', requireUser, async (c) => {
  const me = c.get('user').id;
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.id, r.kind, r.repo_url, r.file_name, r.ask, r.created_at, r.user_id, u.name, u.show_full_name,
                (SELECT COUNT(*) FROM reviews v WHERE v.request_id = r.id AND v.status != 'hidden') AS reviews,
                (SELECT COUNT(*) FROM reviews v WHERE v.request_id = r.id AND v.user_id = ?) AS reviewed
         FROM review_requests r JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
         WHERE r.status = 'open' ORDER BY r.id DESC LIMIT 50`
      )
      .bind(me)
      .all()
  ).results;
  return c.json({
    requests: rows.map((r) => ({
      id: r.id, kind: r.kind, repo_url: r.repo_url, file_name: r.file_name, ask: r.ask, created_at: r.created_at,
      author: publicName(r.name, r.show_full_name), mine: r.user_id === me, reviews: r.reviews, reviewed: Boolean(r.reviewed),
    })),
    limits: LIMITS,
  });
});

/** The requester's own workspace files, for the "pick a file" menu. Names only, never content. */
reviewsRouter.get('/reviews/my-files', requireUser, async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT w.id AS workspace_id, w.title, f.path, length(f.content) AS size FROM workspaces w
         JOIN workspace_files f ON f.workspace_id = w.id WHERE w.user_id = ? AND length(f.content) <= ?
         ORDER BY w.updated_at DESC, f.path LIMIT 200`
      )
      .bind(c.get('user').id, LIMITS.snapshotBytes)
      .all()
  ).results;
  return c.json({ files: rows });
});

reviewsRouter.post('/reviews', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const b = await c.req.json().catch(() => null);
  const ask = String(b?.ask ?? '').replace(/\s+/g, ' ').trim();
  if (ask.length < 10 || ask.length > LIMITS.ask) return c.json({ error: `Say what you want feedback on (10 to ${LIMITS.ask} characters).` }, 400);

  let repo = '';
  let fileName = '';
  let snapshot = '';
  if (b?.kind === 'repo') {
    repo = cleanRepoUrl(b.repo_url);
    if (!repo) return c.json({ error: 'Use a link like https://github.com/owner/repo.' }, 400);
  } else if (b?.kind === 'file') {
    const path = String(b.path ?? '');
    if (pathError(path)) return c.json({ error: 'Pick one of your workspace files.' }, 400);
    // Ownership is part of the query: another member's file answers the same as a missing one.
    const f = await db
      .prepare('SELECT f.content, w.title FROM workspace_files f JOIN workspaces w ON w.id = f.workspace_id WHERE w.id = ? AND w.user_id = ? AND f.path = ?')
      .bind(Number(b.workspace_id) || 0, user.id, path)
      .first();
    if (!f) return c.json({ error: 'Pick one of your workspace files.' }, 404);
    if (new TextEncoder().encode(f.content).length > LIMITS.snapshotBytes) return c.json({ error: `That file is over ${LIMITS.snapshotBytes / 1024} KB. Pick a smaller one.` }, 400);
    snapshot = f.content;
    fileName = path;
  } else {
    return c.json({ error: 'Pick a repository or a workspace file.' }, 400);
  }

  const open = await db.prepare(`SELECT COUNT(*) AS n FROM review_requests WHERE user_id = ? AND status = 'open'`).bind(user.id).first();
  if (open.n >= LIMITS.openRequests) return c.json({ error: `You have ${LIMITS.openRequests} requests open. Close one first.` }, 429);
  const res = await db
    .prepare('INSERT INTO review_requests (user_id, kind, repo_url, file_name, snapshot, ask) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(user.id, b.kind, repo, fileName, snapshot, ask)
    .run();
  return c.json({ id: res.meta.last_row_id }, 201);
});

reviewsRouter.get('/reviews/:id', requireUser, async (c) => {
  const db = c.env.DB;
  const me = c.get('user').id;
  const r = await db
    .prepare(
      `SELECT r.id, r.kind, r.repo_url, r.file_name, r.snapshot, r.ask, r.status, r.created_at, r.user_id, u.name, u.show_full_name
       FROM review_requests r JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL WHERE r.id = ? AND r.status != 'hidden'`
    )
    .bind(Number(c.req.param('id')) || 0)
    .first();
  if (!r) return c.json({ error: 'No such request.' }, 404);
  const mine = r.user_id === me;
  // The asker sees every review; others see accepted ones and their own, so nobody copies a pending review.
  const reviews = (
    await db
      .prepare(
        `SELECT v.id, v.user_id, v.comments, v.status, v.created_at, u.name, u.show_full_name FROM reviews v
         JOIN users u ON u.id = v.user_id AND u.deleted_at IS NULL WHERE v.request_id = ? AND v.status != 'hidden' ORDER BY v.id LIMIT 50`
      )
      .bind(r.id)
      .all()
  ).results.filter((v) => mine || v.user_id === me || v.status === 'accepted');
  return c.json({
    id: r.id, kind: r.kind, repo_url: r.repo_url, file_name: r.file_name, ask: r.ask, status: r.status, created_at: r.created_at,
    snapshot: r.status === 'open' ? r.snapshot : '',
    author: publicName(r.name, r.show_full_name), mine,
    reviews: reviews.map((v) => ({
      id: v.id, comments: parse(v.comments), status: v.status, created_at: v.created_at,
      author: publicName(v.name, v.show_full_name), mine: v.user_id === me,
    })),
    limits: LIMITS,
  });
});

reviewsRouter.post('/reviews/:id/close', requireUser, async (c) => {
  const res = await c.env.DB
    .prepare(`UPDATE review_requests SET status = 'closed', snapshot = '' WHERE id = ? AND user_id = ? AND status = 'open'`)
    .bind(Number(c.req.param('id')) || 0, c.get('user').id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'No open request of yours with that id.' }, 404);
  return c.json({ ok: true });
});

reviewsRouter.post('/reviews/:id/review', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await db.prepare(`SELECT id, user_id, kind, snapshot FROM review_requests WHERE id = ? AND status = 'open'`).bind(Number(c.req.param('id')) || 0).first();
  if (!r) return c.json({ error: 'That request is not open.' }, 404);
  if (r.user_id === user.id) return c.json({ error: 'You cannot review your own request.' }, 403);
  const b = await c.req.json().catch(() => null);
  const checked = cleanComments(b?.comments, r.kind === 'file' ? lineCount(r.snapshot) : 0);
  if (checked.error) return c.json({ error: checked.error }, 400);
  if (await hitOrRefuse(db, `review:${user.id}`, LIMITS.reviewsPerDay, 86_400_000)) return c.json({ error: 'That is plenty of reviews for today.' }, 429);
  try {
    const res = await db.prepare('INSERT INTO reviews (request_id, user_id, comments) VALUES (?, ?, ?)').bind(r.id, user.id, JSON.stringify(checked.comments)).run();
    return c.json({ id: res.meta.last_row_id }, 201);
  } catch {
    return c.json({ error: 'You already reviewed this request.' }, 409);
  }
});

/** The asker says a review helped. Pays the reviewer a mentor activity, once. */
reviewsRouter.post('/reviews/:id/helpful', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const v = await db
    .prepare(
      `SELECT v.id, v.request_id, v.user_id, v.status, r.user_id AS asker, r.kind, r.repo_url, r.file_name, r.status AS rstatus, u.student_id
       FROM reviews v JOIN review_requests r ON r.id = v.request_id JOIN users u ON u.id = v.user_id AND u.deleted_at IS NULL WHERE v.id = ?`
    )
    .bind(Number(c.req.param('id')) || 0)
    .first();
  // Only the asker may see that this review exists.
  if (!v || v.asker !== user.id || v.rstatus === 'hidden') return c.json({ error: 'No such review.' }, 404);
  if (v.status !== 'posted') return c.json({ error: v.status === 'accepted' ? 'Already marked helpful.' : 'No such review.' }, v.status === 'accepted' ? 409 : 404);
  if (v.user_id === user.id) return c.json({ error: 'You cannot accept your own review.' }, 403);

  const n = await db.prepare(`SELECT COUNT(*) AS n FROM reviews WHERE request_id = ? AND status = 'accepted'`).bind(v.request_id).first();
  if (n.n >= LIMITS.acceptedPerRequest) return c.json({ error: `You can mark ${LIMITS.acceptedPerRequest} reviews helpful per request.` }, 409);
  // Either direction counts, so two friends cannot trade thanks back and forth.
  const pair = await db
    .prepare(
      `SELECT 1 AS x FROM reviews v JOIN review_requests r ON r.id = v.request_id
       WHERE v.status = 'accepted' AND ((r.user_id = ? AND v.user_id = ?) OR (r.user_id = ? AND v.user_id = ?)) LIMIT 1`
    )
    .bind(user.id, v.user_id, v.user_id, user.id)
    .first();
  if (pair) return c.json({ error: 'You and this member have already thanked each other for a review. Points are for new people.' }, 409);
  const week = await db
    .prepare(`SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND status = 'accepted' AND accepted_at > datetime('now', '-7 days')`)
    .bind(v.user_id)
    .first();
  if (week.n >= LIMITS.paidPerWeek) return c.json({ error: 'This reviewer has had a lot of thanks this week. Try again next week.' }, 409);

  // The status guard makes a double click or a race pay once.
  const res = await db
    .prepare(`UPDATE reviews SET status = 'accepted', accepted_at = datetime('now') WHERE id = ? AND status = 'posted'`)
    .bind(v.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Already marked helpful.' }, 409);
  let awarded = 0;
  if (Number.isInteger(v.student_id)) {
    const what = v.kind === 'repo' ? v.repo_url.replace('https://github.com/', '') : v.file_name;
    const p = await recordActivity(db, {
      studentId: v.student_id, kind: 'mentor', ref: `review:${v.id}`, meta: { title: `Code review: ${what}`, review: v.id }, status: 'approved',
    });
    awarded = p.awarded;
  }
  return c.json({ ok: true, awarded });
});
