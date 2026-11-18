/**
 * G5 safety and privacy: reports on member-written content, a member's data
 * export, and account deletion (soft-delete now, purge after a grace period).
 *
 * Members are minors. Deletion hides everything at once (currentUser refuses a
 * deleted account, public queries skip it, the leaderboard entry is renamed),
 * then purgeDeleted() erases the rest from the hourly cron.
 */
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';

import { requireUser, USER_COOKIE } from './users.js';
import { hitOrRefuse } from './ratelimit.js';

export const safetyRouter = new Hono();
export const safetyAdminRouter = new Hono();

export const PURGE_GRACE_MS = 7 * 86_400_000;
export const REPORT_KINDS = ['idea', 'project', 'feed', 'editorial', 'review_request', 'review'];
const REPORTS_PER_DAY = 10;

/* --------------------------------- reports --------------------------------- */

/** Is this a live, visible piece of someone else's content? */
async function reportable(db, kind, id) {
  const sql = {
    idea: `SELECT 1 AS x FROM ideas WHERE id = ? AND status != 'hidden'`,
    project: `SELECT 1 AS x FROM projects WHERE id = ? AND hidden = 0`,
    feed: `SELECT 1 AS x FROM activity WHERE id = ? AND status = 'approved' AND hidden = 0`,
    editorial: `SELECT 1 AS x FROM editorials WHERE id = ? AND status = 'accepted'`,
    review_request: `SELECT 1 AS x FROM review_requests WHERE id = ? AND status = 'open'`,
    review: `SELECT 1 AS x FROM reviews WHERE id = ? AND status != 'hidden'`,
  }[kind];
  return Boolean(sql && (await db.prepare(sql).bind(id).first()));
}

safetyRouter.post('/reports', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const kind = String(body?.kind ?? '');
  const id = Number(body?.id);
  const reason = String(body?.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!REPORT_KINDS.includes(kind) || !Number.isInteger(id) || id < 1) return c.json({ error: 'Nothing to report.' }, 400);
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await reportable(db, kind, id))) return c.json({ error: 'That is not there any more.' }, 404);
  if (await hitOrRefuse(db, `report:${user.id}`, REPORTS_PER_DAY, 86_400_000)) {
    return c.json({ error: 'That is plenty of reports for today. An officer will look at them.' }, 429);
  }
  await db
    .prepare('INSERT OR IGNORE INTO reports (reporter_user_id, kind, target_id, reason) VALUES (?, ?, ?, ?)')
    .bind(user.id, kind, id, reason)
    .run();
  return c.json({ ok: true });
});

const PREVIEW = `
  CASE r.kind
    WHEN 'idea' THEN (SELECT body FROM ideas WHERE id = r.target_id)
    WHEN 'project' THEN (SELECT title || ' - ' || description FROM projects WHERE id = r.target_id)
    WHEN 'feed' THEN (SELECT json_extract(meta, '$.title') FROM activity WHERE id = r.target_id)
    WHEN 'editorial' THEN (SELECT body FROM editorials WHERE id = r.target_id)
    WHEN 'review_request' THEN (SELECT ask FROM review_requests WHERE id = r.target_id)
    WHEN 'review' THEN (SELECT comments FROM reviews WHERE id = r.target_id)
  END AS content,
  CASE r.kind
    WHEN 'idea' THEN (SELECT u.name FROM ideas i JOIN users u ON u.id = i.user_id WHERE i.id = r.target_id)
    WHEN 'project' THEN (SELECT u.name FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = r.target_id)
    WHEN 'feed' THEN (SELECT s.name FROM activity a JOIN students s ON s.id = a.student_id WHERE a.id = r.target_id)
    WHEN 'editorial' THEN (SELECT u.name FROM editorials e JOIN users u ON u.id = e.user_id WHERE e.id = r.target_id)
    WHEN 'review_request' THEN (SELECT u.name FROM review_requests q JOIN users u ON u.id = q.user_id WHERE q.id = r.target_id)
    WHEN 'review' THEN (SELECT u.name FROM reviews v JOIN users u ON u.id = v.user_id WHERE v.id = r.target_id)
  END AS author`;

safetyAdminRouter.get('/reports', async (c) => {
  const status = ['open', 'hidden', 'dismissed'].includes(c.req.query('status')) ? c.req.query('status') : 'open';
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.id, r.kind, r.target_id, r.reason, r.status, r.created_at, r.decided_name, r.decided_at,
                ru.name AS reporter, ${PREVIEW}
         FROM reports r LEFT JOIN users ru ON ru.id = r.reporter_user_id
         WHERE r.status = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`
      )
      .bind(status)
      .all()
  ).results;
  return c.json({ reports: rows });
});

async function decide(c, status) {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const rep = await db.prepare('SELECT id, kind, target_id FROM reports WHERE id = ?').bind(id).first();
  if (!rep) return c.json({ error: 'No such report.' }, 404);
  const by = c.get('officer')?.name ?? 'officer';
  const hide = {
    idea: `UPDATE ideas SET status = 'hidden' WHERE id = ?`,
    project: `UPDATE projects SET hidden = 1 WHERE id = ?`,
    feed: `UPDATE activity SET hidden = 1 WHERE id = ?`,
    editorial: `UPDATE editorials SET status = 'hidden' WHERE id = ?`,
    review_request: `UPDATE review_requests SET status = 'hidden', snapshot = '' WHERE id = ?`,
    review: `UPDATE reviews SET status = 'hidden' WHERE id = ?`,
  }[rep.kind];
  const mark = db
    .prepare(`UPDATE reports SET status = ?, decided_name = ?, decided_at = datetime('now') WHERE kind = ? AND target_id = ? AND status = 'open'`)
    .bind(status, by, rep.kind, rep.target_id);
  // Hiding closes every open report about the same item; dismissing closes just this one.
  await db.batch(
    status === 'hidden'
      ? [db.prepare(hide).bind(rep.target_id), mark]
      : [db.prepare(`UPDATE reports SET status = ?, decided_name = ?, decided_at = datetime('now') WHERE id = ? AND status = 'open'`).bind(status, by, id)]
  );
  return c.json({ ok: true });
}

safetyAdminRouter.post('/reports/:id/hide', (c) => decide(c, 'hidden'));
safetyAdminRouter.post('/reports/:id/dismiss', (c) => decide(c, 'dismissed'));

/* ---------------------------------- export --------------------------------- */

const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

/** Everything tied to one account, as plain data. Only ever called with the requester's own id. */
export async function exportFor(db, user) {
  const id = user.id;
  const sid = user.student_id ?? 0;
  const account = await db
    .prepare('SELECT id, email, name, role, created_at, last_seen, show_full_name, path, compass, cf_handle FROM users WHERE id = ?')
    .bind(id)
    .first();
  const entry = sid ? await db.prepare('SELECT id, name, grade, joined_at, active FROM students WHERE id = ?').bind(sid).first() : null;
  return {
    exported_at: new Date().toISOString(),
    account: { ...account, show_full_name: Boolean(account.show_full_name), compass: account.compass ? JSON.parse(account.compass) : null },
    leaderboard_entry: entry,
    point_events: sid ? await rows(db, 'SELECT delta, reason, created_at FROM point_events WHERE student_id = ? ORDER BY id', sid) : [],
    activity: sid ? await rows(db, 'SELECT kind, ref, meta, status, points, created_at, decided_at FROM activity WHERE student_id = ? ORDER BY id', sid) : [],
    squads: sid ? await rows(db, 'SELECT squad_id, season FROM squad_members WHERE student_id = ?', sid) : [],
    badges: sid ? await rows(db, 'SELECT badge_id, awarded_at FROM student_badges WHERE student_id = ?', sid) : [],
    course_progress: await rows(db, 'SELECT course, step, passed_at, attempts, code FROM step_progress WHERE user_id = ?', id),
    meetings_attended: await rows(db, 'SELECT code, joined_at FROM room_checkins WHERE user_id = ?', id),
    projects: await rows(db, 'SELECT title, description, track, repo_url, demo_url, hidden, created_at FROM projects WHERE user_id = ?', id),
    artifacts: await rows(db, 'SELECT room_code, kind, url, line, result, kudos, shown, created_at FROM artifacts WHERE user_id = ?', id),
    ideas: await rows(db, 'SELECT kind, body, status, created_at FROM ideas WHERE user_id = ?', id),
    idea_votes: await rows(db, 'SELECT idea_id FROM idea_votes WHERE user_id = ?', id),
    kudos_given: await rows(db, 'SELECT activity_id, created_at FROM kudos WHERE user_id = ?', id),
    opportunities_marked: await rows(db, 'SELECT opportunity_id FROM opportunity_interest WHERE user_id = ?', id),
    workspaces: await Promise.all(
      (await rows(db, 'SELECT id, title, kind, created_at, updated_at FROM workspaces WHERE user_id = ?', id)).map(async (w) => ({
        ...w,
        files: await rows(db, 'SELECT path, content FROM workspace_files WHERE workspace_id = ?', w.id),
      }))
    ),
    competition_signups: await rows(db, 'SELECT competition_id, joined_at, participated, placement FROM competition_roster WHERE user_id = ?', id),
    arena_progress: await rows(db, 'SELECT rung_id, status, done_at, method FROM rung_progress WHERE user_id = ?', id),
    arena_placement: (await db.prepare('SELECT answers, start, focus FROM board_placement WHERE user_id = ?').bind(id).first()) ?? null,
    daily_results: await rows(db, 'SELECT date, attempts, solved_at, ms FROM daily_results WHERE user_id = ?', id),
    data_submissions: await rows(db, 'SELECT challenge_id, public_score, final_score, created_at FROM data_submissions WHERE user_id = ?', id),
    duel_results: await rows(db, 'SELECT room_code, round, division, slug, attempts, solved_ms, won, code FROM duel_results WHERE user_id = ?', id),
    contest_attempts: await rows(db, 'SELECT room_code, team_id, slug, ok, ms, code, created_at FROM contest_attempts WHERE user_id = ?', id),
    portfolio_public: Boolean((await db.prepare('SELECT 1 AS x FROM portfolio_public WHERE user_id = ?').bind(id).first())),
    portfolio_signoffs: await rows(db, 'SELECT line, officer_name, created_at FROM portfolio_signoffs WHERE user_id = ?', id),
    codeforces_solves: await rows(db, 'SELECT contest_id, idx, rating, solved_at FROM cf_solves WHERE user_id = ?', id),
    ctf_solves: await rows(db, 'SELECT challenge_id, solved_at FROM ctf_solves WHERE user_id = ?', id),
    problem_solves: await rows(db, 'SELECT slug, ms, solved_at FROM problem_solves WHERE user_id = ?', id),
    editorials_written: await rows(db, 'SELECT slug, body, code, status, created_at FROM editorials WHERE user_id = ?', id),
    review_requests: await rows(db, 'SELECT id, kind, repo_url, file_name, snapshot, ask, status, created_at FROM review_requests WHERE user_id = ?', id),
    reviews_written: await rows(db, 'SELECT request_id, comments, status, created_at, accepted_at FROM reviews WHERE user_id = ?', id),
    ghost_races: await rows(db, 'SELECT slug, ghost_name, ghost_ms, ms, won, created_at FROM ghost_races WHERE user_id = ?', id),
    ctf_challenges_written: await rows(db, 'SELECT slug, title, category, difficulty, body, file_name, file_data, hint, status, created_at FROM ctf_challenges WHERE author_user_id = ?', id),
    link_request: (await db.prepare('SELECT student_id, created_at FROM link_requests WHERE user_id = ?').bind(id).first()) ?? null,
    reports_filed: await rows(db, 'SELECT kind, target_id, reason, status, created_at FROM reports WHERE reporter_user_id = ?', id),
    verified_record_codes: await rows(db, 'SELECT code, issued_by_name, created_at, revoked_at FROM record_codes WHERE user_id = ?', id),
    email_list: (await db.prepare('SELECT confirmed, created_at FROM subscribers WHERE email = ?').bind(account.email).first()) ?? null,
  };
}

safetyRouter.get('/me/export', requireUser, async (c) => {
  const data = await exportFor(c.env.DB, c.get('user'));
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="cs-club-my-data.json"',
      'Cache-Control': 'no-store',
    },
  });
});

/* --------------------------------- deletion -------------------------------- */

/**
 * Step one, immediate. Marks the account deleted (so it is signed out and
 * hidden) and takes the member's name off the leaderboard entry. With
 * keepHistory the points stay on an anonymous "Former member" entry; without
 * it the entry is deactivated.
 */
export async function softDelete(db, user, keepHistory) {
  const stmts = [db.prepare(`UPDATE users SET deleted_at = datetime('now'), keep_history = ? WHERE id = ?`).bind(keepHistory ? 1 : 0, user.id)];
  if (user.student_id) {
    stmts.push(
      db
        .prepare(`UPDATE students SET name = 'Former member', grade = NULL, avatar_seed = '', active = ? WHERE id = ?`)
        .bind(keepHistory ? 1 : 0, user.student_id)
    );
  }
  await db.batch(stmts);
}

/** Step two: erase one soft-deleted account and everything tied to it. */
export async function purgeUser(db, id) {
  const u = await db.prepare('SELECT id, email, student_id, keep_history, deleted_at FROM users WHERE id = ?').bind(id).first();
  if (!u || !u.deleted_at) return false; // only ever purges an account that was deleted on purpose
  const s = [];
  const mine = (sql, ...args) => s.push(db.prepare(sql).bind(...args));

  // Reports about this person's content, then reports they filed.
  mine(`DELETE FROM reports WHERE kind = 'idea' AND target_id IN (SELECT id FROM ideas WHERE user_id = ?)`, id);
  mine(`DELETE FROM reports WHERE kind = 'project' AND target_id IN (SELECT id FROM projects WHERE user_id = ?)`, id);
  if (!u.keep_history && u.student_id) {
    mine(`DELETE FROM reports WHERE kind = 'feed' AND target_id IN (SELECT id FROM activity WHERE student_id = ?)`, u.student_id);
  }
  mine(`DELETE FROM reports WHERE kind = 'editorial' AND target_id IN (SELECT id FROM editorials WHERE user_id = ?)`, id);
  mine(`DELETE FROM reports WHERE kind = 'review_request' AND target_id IN (SELECT id FROM review_requests WHERE user_id = ?)`, id);
  mine(`DELETE FROM reports WHERE kind = 'review' AND target_id IN (SELECT id FROM reviews WHERE user_id = ? OR request_id IN (SELECT id FROM review_requests WHERE user_id = ?))`, id, id);
  mine('DELETE FROM reviews WHERE request_id IN (SELECT id FROM review_requests WHERE user_id = ?)', id);
  mine('DELETE FROM reports WHERE reporter_user_id = ?', id);
  mine('DELETE FROM workspace_files WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)', id);

  for (const t of [
    'step_progress', 'room_checkins', 'projects', 'link_requests', 'ideas', 'idea_votes', 'kudos', 'opportunity_interest',
    'daily_results', 'data_submissions', 'rung_progress', 'board_placement', 'duel_results', 'cf_solves', 'cf_challenges', 'record_codes', 'artifacts', 'workspaces', 'ctf_solves', 'contest_attempts',
    'problem_solves', 'editorials', 'ghost_races', 'reviews', 'review_requests', 'portfolio_public', 'portfolio_signoffs',
  ]) {
    mine(`DELETE FROM ${t} WHERE user_id = ?`, id); // t is from the fixed list above, never input
  }
  // Approved challenges stay for the club, anonymised; unapproved ones go with the account.
  mine(`DELETE FROM ctf_challenges WHERE author_user_id = ? AND status != 'live'`, id);
  mine(`UPDATE ctf_challenges SET author_user_id = NULL, author_name = 'Former member' WHERE author_user_id = ?`, id);
  mine('DELETE FROM login_tokens WHERE email = ?', u.email);
  mine('DELETE FROM subscribers WHERE email = ?', u.email);
  mine(`UPDATE officer_log SET officer_user_id = NULL, officer_name = 'former officer' WHERE officer_user_id = ?`, id);
  mine(`UPDATE activity SET decided_by = NULL, decided_name = 'former officer' WHERE decided_by = ?`, id);
  mine(`UPDATE portfolio_signoffs SET officer_id = NULL, officer_name = 'former officer' WHERE officer_id = ?`, id);

  if (u.student_id) {
    // A raffle record keeps the winner's name as typed at the draw time; it must not outlive the account.
    mine(`UPDATE raffle_draws SET student_name = 'Former member' WHERE student_id = ?`, u.student_id);
    if (u.keep_history) {
      // Points stay; proof links, notes and who-claimed-it go.
      mine(`UPDATE activity SET meta = json_object('title', json_extract(meta, '$.title')) WHERE student_id = ?`, u.student_id);
    } else {
      mine('DELETE FROM point_events WHERE student_id = ?', u.student_id);
      mine('DELETE FROM activity WHERE student_id = ?', u.student_id);
      mine('DELETE FROM student_badges WHERE student_id = ?', u.student_id);
      mine('DELETE FROM squad_members WHERE student_id = ?', u.student_id);
    }
  }
  mine('DELETE FROM users WHERE id = ?', id);
  await db.batch(s);
  return true;
}

/** Purges every account deleted more than graceMs ago. Run from the hourly cron. */
export async function purgeDeleted(db, { graceMs = PURGE_GRACE_MS, now = Date.now() } = {}) {
  const cutoff = new Date(now - graceMs).toISOString().slice(0, 19).replace('T', ' ');
  const due = await rows(db, 'SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at <= ?', cutoff);
  for (const { id } of due) await purgeUser(db, id);
  return { purged: due.length };
}

safetyRouter.delete('/me/account', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = c.get('user');
  if (body?.confirm !== 'delete') return c.json({ error: 'Type delete to confirm.' }, 400);
  if (user.role !== 'member') return c.json({ error: 'Officers cannot delete their account. Ask a club lead to make you a member first.' }, 409);
  await softDelete(c.env.DB, user, body?.keep_history === true);
  deleteCookie(c, USER_COOKIE, { path: '/' });
  return c.json({ ok: true, purge_after_days: PURGE_GRACE_MS / 86_400_000 });
});
