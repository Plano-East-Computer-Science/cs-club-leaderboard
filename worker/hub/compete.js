/**
 * Competition pages (E4). A club competition gets a sign-up roster, a prep plan
 * (Arena rungs and bank problems an officer picks) and one results form that
 * pays the whole roster through the ledger.
 *
 * Results are idempotent by ref `comp:<id>`: the ledger never pays the same
 * (member, kind, ref) twice, so re-saving the form only adds what is new.
 */
import { Hono } from 'hono';

import { currentUser, requireUser, ensureStudent } from './users.js';
import { recordActivity, approveActivity, officerOf, LedgerError } from './ledger.js';

export const competeRouter = new Hono();
export const competeAdminRouter = new Hono();

const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Someone';
const MAX_PLACE = 999;
const MAX_PREP = 30;

/**
 * Officer input -> { error } or { rows }. `rosterIds` is who may appear.
 * A placement means the member took part, so it implies `participated`.
 */
export function validateResults(input, rosterIds) {
  if (!Array.isArray(input) || !input.length) return { error: 'Send a result row for each rostered member.' };
  const roster = new Set(rosterIds);
  const seen = new Set();
  const rows = [];
  for (const r of input) {
    const userId = Number(r?.userId);
    if (!roster.has(userId)) return { error: 'Someone in the results is not on the roster.' };
    if (seen.has(userId)) return { error: 'A member appears twice in the results.' };
    seen.add(userId);
    const raw = r.placement;
    let placement = null;
    if (raw !== null && raw !== undefined && raw !== '') {
      placement = Number(raw);
      if (!Number.isInteger(placement) || placement < 1 || placement > MAX_PLACE)
        return { error: `Placement must be a whole number from 1 to ${MAX_PLACE}, or blank.` };
    }
    rows.push({ userId, placement, participated: Boolean(r.participated) || placement !== null });
  }
  if (!rows.some((r) => r.participated)) return { error: 'Mark at least one member who took part.' };
  return { rows };
}

export const ordinal = (n) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')}`;
};

/**
 * Writes `compete` for each participant and `place` (meta.placement) for
 * placers, approved as `officer`. An officer on the roster cannot approve their
 * own points (ledger rule); those stay pending for another officer.
 */
export async function recordResults(db, comp, rows, officer) {
  const out = { compete: 0, place: 0, points: 0, already: 0, held: [] };
  const ref = `comp:${comp.id}`;
  const users = (
    await db.prepare(`SELECT id, name, student_id FROM users WHERE id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map((r) => r.userId)).all()
  ).results;
  for (const row of rows) {
    if (!row.participated) continue;
    const u = users.find((x) => x.id === row.userId);
    const studentId = u?.student_id ?? (u && (await ensureStudent(db, u)));
    if (!Number.isInteger(studentId)) {
      out.held.push(`${firstName(u?.name)} has no leaderboard entry yet`);
      continue;
    }
    const acts = [['compete', { title: comp.name, competition: comp.id }]];
    if (row.placement) acts.push(['place', { title: `${comp.name}, ${ordinal(row.placement)} place`, placement: row.placement, competition: comp.id }]);
    for (const [kind, meta] of acts) {
      const r = await recordActivity(db, { studentId, kind, ref, meta, status: 'pending' });
      const act = await db.prepare('SELECT status FROM activity WHERE id = ?').bind(r.activityId).first();
      if (act.status !== 'pending') {
        out.already++;
        continue;
      }
      try {
        const a = await approveActivity(db, r.activityId, officer);
        out[kind]++;
        out.points += a.awarded;
      } catch (err) {
        if (!(err instanceof LedgerError)) throw err;
        out.held.push(`${firstName(u.name)}'s ${kind} is waiting for another officer`);
      }
    }
  }
  await db.batch(
    rows.map((r) =>
      db
        .prepare('UPDATE competition_roster SET participated = ?, placement = ? WHERE competition_id = ? AND user_id = ?')
        .bind(r.participated ? 1 : 0, r.placement, comp.id, r.userId)
    )
  );
  await db.prepare(`UPDATE competitions SET status = 'past' WHERE id = ?`).bind(comp.id).run();
  return out;
}

const getComp = (db, id) => db.prepare('SELECT * FROM competitions WHERE id = ?').bind(Number(id)).first();

/* --------------------------------- members --------------------------------- */

competeRouter.get('/competitions/:id', async (c) => {
  const db = c.env.DB;
  const comp = await getComp(db, c.req.param('id'));
  if (!comp) return c.json({ error: 'No such competition.' }, 404);
  const user = await currentUser(c);
  const roster = (
    await db
      .prepare(
        `SELECT r.user_id, u.name, r.participated, r.placement FROM competition_roster r JOIN users u ON u.id = r.user_id
         WHERE r.competition_id = ? ORDER BY r.placement IS NULL, r.placement, r.joined_at`
      )
      .bind(comp.id)
      .all()
  ).results;
  const rungs = (
    await db
      .prepare(
        `SELECT r.id, r.title, r.url, r.track, r.tier, r.difficulty,
                EXISTS (SELECT 1 FROM rung_progress p WHERE p.rung_id = r.id AND p.user_id = ? AND p.status = 'done') AS done
         FROM competition_prep c JOIN rungs r ON r.id = c.ref_id AND r.hidden = 0
         WHERE c.competition_id = ? AND c.kind = 'rung' ORDER BY c.ord`
      )
      .bind(user?.id ?? 0, comp.id)
      .all()
  ).results.map((r) => ({ ...r, done: Boolean(r.done) }));
  const problems = (
    await db
      .prepare(
        `SELECT p.id, p.slug, p.title, p.difficulty FROM competition_prep c JOIN problems p ON p.id = c.ref_id AND p.status = 'live'
         WHERE c.competition_id = ? AND c.kind = 'problem' ORDER BY c.ord`
      )
      .bind(comp.id)
      .all()
  ).results;
  return c.json({
    competition: comp,
    signedIn: Boolean(user),
    // Names only for signed-in members, first names only.
    roster: {
      count: roster.length,
      mine: roster.some((r) => r.user_id === user?.id),
      members: user ? roster.map((r) => ({ name: firstName(r.name), placement: r.placement, participated: Boolean(r.participated) })) : [],
    },
    prep: { rungs, problems },
  });
});

async function openComp(c) {
  const comp = await getComp(c.env.DB, c.req.param('id'));
  if (!comp) return [null, c.json({ error: 'No such competition.' }, 404)];
  if (comp.status === 'past') return [null, c.json({ error: 'This competition is over, so the roster is closed.' }, 409)];
  return [comp];
}

competeRouter.post('/competitions/:id/roster', requireUser, async (c) => {
  const [comp, err] = await openComp(c);
  if (err) return err;
  await c.env.DB.prepare('INSERT OR IGNORE INTO competition_roster (competition_id, user_id) VALUES (?, ?)').bind(comp.id, c.get('user').id).run();
  return c.json({ ok: true });
});

competeRouter.delete('/competitions/:id/roster', requireUser, async (c) => {
  const [comp, err] = await openComp(c);
  if (err) return err;
  await c.env.DB.prepare('DELETE FROM competition_roster WHERE competition_id = ? AND user_id = ?').bind(comp.id, c.get('user').id).run();
  return c.json({ ok: true });
});

/* --------------------------------- officers -------------------------------- */

competeAdminRouter.get('/competitions/:id/manage', async (c) => {
  const db = c.env.DB;
  const comp = await getComp(db, c.req.param('id'));
  if (!comp) return c.json({ error: 'No such competition.' }, 404);
  const roster = (
    await db
      .prepare(
        `SELECT r.user_id AS userId, u.name, r.participated, r.placement FROM competition_roster r JOIN users u ON u.id = r.user_id
         WHERE r.competition_id = ? ORDER BY r.joined_at`
      )
      .bind(comp.id)
      .all()
  ).results.map((r) => ({ ...r, participated: Boolean(r.participated) }));
  const prep = (await db.prepare('SELECT kind, ref_id FROM competition_prep WHERE competition_id = ? ORDER BY ord').bind(comp.id).all()).results;
  return c.json({
    competition: comp,
    roster,
    prep: { rungs: prep.filter((p) => p.kind === 'rung').map((p) => p.ref_id), problems: prep.filter((p) => p.kind === 'problem').map((p) => p.ref_id) },
  });
});

/** Replaces the plan. Ids that no longer exist are dropped rather than refused. */
competeAdminRouter.put('/competitions/:id/prep', async (c) => {
  const db = c.env.DB;
  const comp = await getComp(db, c.req.param('id'));
  if (!comp) return c.json({ error: 'No such competition.' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const ids = (v) => (Array.isArray(v) ? [...new Set(v.map(Number).filter(Number.isInteger))] : null);
  const rungs = ids(body.rungs);
  const problems = ids(body.problems);
  if (!rungs || !problems) return c.json({ error: 'Send rungs and problems as lists of ids.' }, 400);
  if (rungs.length > MAX_PREP || problems.length > MAX_PREP) return c.json({ error: `A plan holds at most ${MAX_PREP} of each.` }, 400);
  const existing = async (table, list) =>
    list.length
      ? new Set((await db.prepare(`SELECT id FROM ${table} WHERE id IN (${list.map(() => '?').join(',')})`).bind(...list).all()).results.map((r) => r.id))
      : new Set();
  const [okR, okP] = [await existing('rungs', rungs), await existing('problems', problems)];
  const ins = (kind, list, ok) =>
    list
      .filter((id) => ok.has(id))
      .map((id, i) => db.prepare('INSERT INTO competition_prep (competition_id, kind, ref_id, ord) VALUES (?, ?, ?, ?)').bind(comp.id, kind, id, i));
  await db.batch([db.prepare('DELETE FROM competition_prep WHERE competition_id = ?').bind(comp.id), ...ins('rung', rungs, okR), ...ins('problem', problems, okP)]);
  return c.json({ ok: true });
});

competeAdminRouter.post('/competitions/:id/results', async (c) => {
  const db = c.env.DB;
  const comp = await getComp(db, c.req.param('id'));
  if (!comp) return c.json({ error: 'No such competition.' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const rosterIds = (await db.prepare('SELECT user_id FROM competition_roster WHERE competition_id = ?').bind(comp.id).all()).results.map((r) => r.user_id);
  const { error, rows } = validateResults(body.results, rosterIds);
  if (error) return c.json({ error }, 400);
  const label = typeof body.result === 'string' ? body.result.trim().slice(0, 120) : '';
  if (label) await db.prepare('UPDATE competitions SET result = ? WHERE id = ?').bind(label, comp.id).run();
  return c.json(await recordResults(db, comp, rows, officerOf(c)));
});
