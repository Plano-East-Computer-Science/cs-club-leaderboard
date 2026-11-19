/**
 * The activity ledger (A2). Everything a member does becomes one `activity`
 * row; approving it turns it into exactly one `point_events` row by the rules
 * in shared/points.js. Nothing else inserts automatic awards into point_events.
 *
 * Also here: the public club feed (approved activity, first names only), the
 * officer's point-rules override, and merging duplicate leaderboard entries
 * (A1), because a merge has to reconcile activity rows.
 */
import { Hono } from 'hono';

import { KINDS, pointsFor, rulesFrom, cleanRules, sqlTime } from '../../shared/points.js';
import { currentUser } from './users.js';

export const ledgerRouter = new Hono();
export const ledgerAdminRouter = new Hono();

/** Thrown for a refusal a route should pass on as { error } with this status. */
export class LedgerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Who is acting, per the shared contract. A7 sets c.get('officer'); until then it is the shared login. */
export const officerOf = (c) => c.get('officer') ?? { userId: null, name: 'shared login', role: 'lead' };

export async function loadRules(db) {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = 'point_rules'`).first();
  return rulesFrom(row?.value);
}

const parseMeta = (s) => {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
};

/**
 * Pays out one pending activity. The two statements share the same WHERE
 * (`status = 'pending'`) inside one transaction, so either both happen or
 * neither does: a double click or a race cannot write a second point_event.
 */
async function award(db, act, officer, rules) {
  const history = (
    await db
      .prepare(`SELECT kind, created_at AS at, points FROM activity WHERE student_id = ? AND status = 'approved' AND id != ?`)
      .bind(act.student_id, act.id)
      .all()
  ).results;
  // ponytail: two approvals for one student in the same instant can both pass a cap; fine at club scale.
  const meta = parseMeta(act.meta);
  const pts = pointsFor(act.kind, meta, history, rules, act.created_at);
  // The reason starts with the kind; shared/points.js pointLabel turns it into words.
  // A placing carries its place ("USACO Bronze #2") so the label can say "2nd place".
  const place = act.kind === 'place' && Number.isInteger(meta.place) ? ` #${meta.place}` : '';
  const reason = `${act.kind}: ${String(meta.title || act.ref).slice(0, 180)}${place}`.slice(0, 200);
  const [ins] = await db.batch([
    db
      .prepare(`INSERT INTO point_events (student_id, delta, reason) SELECT student_id, ?, ? FROM activity WHERE id = ? AND status = 'pending'`)
      .bind(pts, reason, act.id),
    db
      .prepare(
        `UPDATE activity SET status = 'approved', points = ?, point_event_id = (SELECT MAX(id) FROM point_events),
           decided_by = ?, decided_name = ?, decided_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      )
      .bind(pts, officer?.userId ?? null, officer?.name ?? null, act.id),
  ]);
  return ins.meta?.changes ? pts : 0;
}

/**
 * Records an activity. status defaults to the kind's rule: 'pending' when it
 * needs an officer, otherwise 'approved' and paid at once. `at` is when it
 * happened (defaults to now) and decides its day, week and season.
 * Recording the same (studentId, kind, ref) again is a no-op that returns the
 * existing id with awarded 0 and duplicate true.
 */
export async function recordActivity(db, { studentId, kind, ref, meta = {}, status }, at = new Date()) {
  if (!KINDS.includes(kind)) throw new LedgerError(`Unknown activity kind "${kind}".`);
  if (!Number.isInteger(studentId)) throw new LedgerError('A student id is required.');
  ref = String(ref ?? '').trim().slice(0, 120);
  if (!ref) throw new LedgerError('A ref is required.');
  const rules = await loadRules(db);
  const want = status ?? (rules[kind].approval ? 'pending' : 'approved');
  if (want !== 'pending' && want !== 'approved') throw new LedgerError('Status must be pending or approved.');

  const ins = await db
    .prepare(`INSERT OR IGNORE INTO activity (student_id, kind, ref, meta, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
    .bind(studentId, kind, ref, JSON.stringify(meta ?? {}), sqlTime(at))
    .run();
  const act = await db
    .prepare('SELECT * FROM activity WHERE student_id = ? AND kind = ? AND ref = ?')
    .bind(studentId, kind, ref)
    .first();
  if (!ins.meta?.changes) return { activityId: act.id, awarded: 0, duplicate: true };
  const awarded = want === 'approved' ? await award(db, act, null, rules) : 0;
  return { activityId: act.id, awarded };
}

async function pendingRow(db, id) {
  const act = await db.prepare('SELECT * FROM activity WHERE id = ?').bind(Number(id)).first();
  if (!act) throw new LedgerError('No such activity.', 404);
  if (act.status !== 'pending') throw new LedgerError(`That was already ${act.status}.`, 409);
  return act;
}

/** Officer approval. Refuses an officer approving their own leaderboard entry. */
export async function approveActivity(db, id, officer) {
  const act = await pendingRow(db, id);
  if (officer?.userId != null) {
    const own = await db.prepare('SELECT student_id FROM users WHERE id = ?').bind(officer.userId).first();
    if (own?.student_id === act.student_id) throw new LedgerError('You cannot approve your own claim. Ask another officer.', 403);
  }
  return { activityId: act.id, awarded: await award(db, act, officer, await loadRules(db)) };
}

export async function rejectActivity(db, id, officer, reason = '') {
  const act = await pendingRow(db, id);
  await db
    .prepare(
      `UPDATE activity SET status = 'rejected', meta = json_set(meta, '$.rejectReason', ?),
         decided_by = ?, decided_name = ?, decided_at = datetime('now')
       WHERE id = ? AND status = 'pending'`
    )
    .bind(String(reason ?? '').slice(0, 200), officer?.userId ?? null, officer?.name ?? null, act.id)
    .run();
  return { activityId: act.id };
}

/**
 * Statements that fold leaderboard entry `from` into `keep`: points, activity,
 * badges, accounts and open link requests move, and `from` is deactivated.
 * Returned rather than run so a caller can add its own statements to the same
 * db.batch (one transaction). An activity both entries have (same kind and
 * ref, e.g. one person on two accounts in one meeting) is dropped from `from`
 * along with its points, so a merge never double-pays.
 */
export function mergeStatements(db, keep, from) {
  const dup = `SELECT b.id FROM activity b JOIN activity a ON a.student_id = ? AND a.kind = b.kind AND a.ref = b.ref WHERE b.student_id = ?`;
  return [
    db.prepare(`DELETE FROM point_events WHERE id IN (SELECT point_event_id FROM activity WHERE id IN (${dup}))`).bind(keep, from),
    db.prepare(`DELETE FROM activity WHERE id IN (${dup})`).bind(keep, from),
    db.prepare('UPDATE activity SET student_id = ? WHERE student_id = ?').bind(keep, from),
    db.prepare('UPDATE point_events SET student_id = ? WHERE student_id = ?').bind(keep, from),
    db
      .prepare('INSERT OR IGNORE INTO student_badges (student_id, badge_id, awarded_at) SELECT ?, badge_id, awarded_at FROM student_badges WHERE student_id = ?')
      .bind(keep, from),
    db.prepare('DELETE FROM student_badges WHERE student_id = ?').bind(from),
    db.prepare('UPDATE users SET student_id = ? WHERE student_id = ?').bind(keep, from),
    db.prepare('UPDATE link_requests SET student_id = ? WHERE student_id = ?').bind(keep, from),
    db.prepare('UPDATE students SET active = 0 WHERE id = ?').bind(from),
  ];
}

export async function mergeStudents(db, keep, from) {
  keep = Number(keep);
  from = Number(from);
  if (!Number.isInteger(keep) || !Number.isInteger(from) || keep === from) throw new LedgerError('Pick two different entries.');
  const rows = (await db.prepare('SELECT id, active FROM students WHERE id IN (?, ?)').bind(keep, from).all()).results;
  const k = rows.find((r) => r.id === keep);
  if (!k || !rows.some((r) => r.id === from)) throw new LedgerError('No such leaderboard entry.', 404);
  if (!k.active) throw new LedgerError('The entry you keep must be active.');
  await db.batch(mergeStatements(db, keep, from));
}

/* ---------------------------------- routes --------------------------------- */

const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';

/**
 * Latest approved activity for the club feed (F2). First names only, no emails,
 * no proof links. `kudos` is the count; `mine` and `own` (your kudos, your
 * activity) are only filled in for a signed-in caller.
 */
ledgerRouter.get('/feed', async (c) => {
  const user = await currentUser(c);
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT a.id, a.kind, a.points, a.decided_at AS at, json_extract(a.meta, '$.title') AS title, s.name,
                (SELECT COUNT(*) FROM kudos k WHERE k.activity_id = a.id) AS kudos,
                EXISTS (SELECT 1 FROM kudos k WHERE k.activity_id = a.id AND k.user_id = ?) AS mine,
                a.student_id = ? AS own
         FROM activity a JOIN students s ON s.id = a.student_id AND s.active = 1
         WHERE a.status = 'approved' AND a.hidden = 0 AND a.kind != 'active' -- the meeting bonus rides on the attend row
         ORDER BY a.decided_at DESC, a.id DESC LIMIT 30`
      )
      .bind(user?.id ?? 0, user?.student_id ?? 0)
      .all()
  ).results;
  return c.json({
    feed: rows.map(({ name, mine, own, ...r }) => ({ ...r, title: r.title ?? '', name: firstName(name), mine: Boolean(mine), own: Boolean(own) })),
  });
});

ledgerAdminRouter.post('/students/merge', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    await mergeStudents(c.env.DB, body?.keep, body?.from);
  } catch (err) {
    if (err instanceof LedgerError) return c.json({ error: err.message }, err.status);
    throw err;
  }
  return c.json({ ok: true });
});

ledgerAdminRouter.get('/point-rules', async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'point_rules'`).first();
  return c.json({ rules: await loadRules(c.env.DB), overrides: row ? JSON.parse(row.value) : {} });
});

/** Replaces the overrides. Send {} to go back to the defaults. */
ledgerAdminRouter.put('/point-rules', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { rules, error } = cleanRules(body?.overrides);
  if (error) return c.json({ error }, 400);
  await c.env.DB
    .prepare(`INSERT INTO settings (key, value) VALUES ('point_rules', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(JSON.stringify(rules))
    .run();
  return c.json({ rules: rulesFrom(rules) });
});
