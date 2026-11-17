/**
 * Claims queue (A3). A member says "I entered X", "I placed", "I shipped Y"
 * with an optional https proof link; an officer approves or rejects in one
 * tap, and approval pays through the ledger. Also the "I'm doing this" marks
 * on opportunities, which the dashboard turns into "did you compete?".
 */
import { Hono } from 'hono';

import { CLAIM_KINDS } from '../../shared/points.js';
import { requireUser } from './users.js';
import { recordActivity, approveActivity, rejectActivity, officerOf, LedgerError } from './ledger.js';

export const claimsRouter = new Hono();
export const claimsAdminRouter = new Hono();

const MAX_PENDING = 10;
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** https only: a proof link is shown to officers as a clickable link. */
export function cleanProof(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { url: '' };
  if (s.length > 500) return { error: 'That proof link is too long.' };
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return { error: 'Proof links must start with https://' };
    return { url: u.href };
  } catch {
    return { error: 'That proof link is not a valid URL.' };
  }
}

const fail = (c, err) => {
  if (err instanceof LedgerError) return c.json({ error: err.message }, err.status);
  throw err;
};

/* --------------------------------- members --------------------------------- */

claimsRouter.post('/claims', requireUser, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const kind = String(body?.kind ?? '');
  if (!CLAIM_KINDS.includes(kind)) return c.json({ error: 'Claim a competition entry, a placing, or a shipped project.' }, 400);
  const title = clip(body?.title, 120);
  if (title.length < 3) return c.json({ error: 'Say what it was in a few words.' }, 400);
  const proof = cleanProof(body?.proof_url);
  if (proof.error) return c.json({ error: proof.error }, 400);
  const note = clip(body?.note, 500);
  const place = body?.place == null || body.place === '' ? null : Number(body.place);
  if (place !== null && !(Number.isInteger(place) && place >= 1 && place <= 1000)) return c.json({ error: 'Place must be a whole number like 1 or 3.' }, 400);
  if (!user.student_id) return c.json({ error: 'Your account is waiting on a link request. Ask an officer.' }, 409);

  // ref ties the claim to what it is about, so the same thing is never claimed twice.
  let ref = String(body?.ref ?? '').trim();
  if (ref) {
    const m = /^(opp|comp|proj):(\d{1,9})$/.exec(ref);
    if (!m) return c.json({ error: 'That reference is not valid.' }, 400);
    const [, type, id] = m;
    const exists =
      type === 'opp' ? await db.prepare('SELECT 1 AS x FROM opportunities WHERE id = ?').bind(Number(id)).first()
      : type === 'comp' ? await db.prepare('SELECT 1 AS x FROM competitions WHERE id = ?').bind(Number(id)).first()
      : await db.prepare('SELECT 1 AS x FROM projects WHERE id = ? AND user_id = ?').bind(Number(id), user.id).first();
    if (!exists) return c.json({ error: 'That opportunity, competition or project does not exist.' }, 404);
  } else {
    ref = `self:${slug(title)}`;
  }

  const meta = { title, proof_url: proof.url, note, ...(place ? { place } : {}), by_user: user.id };
  const prior = await db
    .prepare('SELECT id, status FROM activity WHERE student_id = ? AND kind = ? AND ref = ?')
    .bind(user.student_id, kind, ref)
    .first();
  if (prior && prior.status !== 'rejected') return c.json({ error: 'You already claimed this.' }, 409);

  const open = await db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE student_id = ? AND status = 'pending'`).bind(user.student_id).first();
  if (open.n >= MAX_PENDING) return c.json({ error: 'You have 10 claims waiting. Wait for an officer to go through them.' }, 429);

  if (prior) {
    // A rejected claim can be sent again with better proof.
    await db
      .prepare(`UPDATE activity SET status = 'pending', meta = ?, decided_by = NULL, decided_name = NULL, decided_at = NULL WHERE id = ? AND status = 'rejected'`)
      .bind(JSON.stringify(meta), prior.id)
      .run();
    return c.json({ activityId: prior.id, status: 'pending' });
  }
  try {
    const r = await recordActivity(db, { studentId: user.student_id, kind, ref, meta });
    // Pending unless officers switched approval off for this kind in point_rules.
    const { status } = await db.prepare('SELECT status FROM activity WHERE id = ?').bind(r.activityId).first();
    return c.json({ activityId: r.activityId, awarded: r.awarded, status });
  } catch (err) {
    return fail(c, err);
  }
});

/** My claims, plus the opportunities I said I am doing and have not claimed yet. */
claimsRouter.get('/me/claims', requireUser, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const claims = user.student_id
    ? (
        await db
          .prepare(
            `SELECT id, kind, ref, status, points, created_at, json_extract(meta, '$.title') AS title,
                    json_extract(meta, '$.rejectReason') AS reject_reason
             FROM activity WHERE student_id = ? AND kind IN ('compete', 'place', 'ship')
             ORDER BY created_at DESC LIMIT 20`
          )
          .bind(user.student_id)
          .all()
      ).results
    : [];
  const interests = (
    await db
      .prepare(
        `SELECT o.id, o.title, o.deadline FROM opportunity_interest i JOIN opportunities o ON o.id = i.opportunity_id
         WHERE i.user_id = ? AND NOT EXISTS (
           SELECT 1 FROM activity a WHERE a.student_id = ? AND a.kind = 'compete' AND a.ref = 'opp:' || o.id)
         ORDER BY o.deadline IS NULL, o.deadline`
      )
      .bind(user.id, user.student_id ?? 0)
      .all()
  ).results;
  return c.json({ claims, interests });
});

claimsRouter.get('/me/interests', requireUser, async (c) => {
  const rows = (
    await c.env.DB.prepare('SELECT opportunity_id FROM opportunity_interest WHERE user_id = ?').bind(c.get('user').id).all()
  ).results;
  return c.json({ ids: rows.map((r) => r.opportunity_id) });
});

claimsRouter.post('/me/interests/:id', requireUser, async (c) => {
  const id = Number(c.req.param('id'));
  const opp = Number.isInteger(id) && (await c.env.DB.prepare('SELECT 1 AS x FROM opportunities WHERE id = ?').bind(id).first());
  if (!opp) return c.json({ error: 'No such opportunity.' }, 404);
  await c.env.DB
    .prepare('INSERT OR IGNORE INTO opportunity_interest (user_id, opportunity_id) VALUES (?, ?)')
    .bind(c.get('user').id, id)
    .run();
  return c.json({ ok: true });
});

claimsRouter.delete('/me/interests/:id', requireUser, async (c) => {
  await c.env.DB
    .prepare('DELETE FROM opportunity_interest WHERE user_id = ? AND opportunity_id = ?')
    .bind(c.get('user').id, Number(c.req.param('id')))
    .run();
  return c.json({ ok: true });
});

/* --------------------------------- officers -------------------------------- */

/** The queue. Any pending activity shows here, not only member claims. */
claimsAdminRouter.get('/claims', async (c) => {
  const status = ['pending', 'approved', 'rejected'].includes(c.req.query('status')) ? c.req.query('status') : 'pending';
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT a.id, a.student_id, a.kind, a.ref, a.meta, a.status, a.points, a.created_at, a.decided_name, a.decided_at,
                s.name AS student_name
         FROM activity a JOIN students s ON s.id = a.student_id
         WHERE a.status = ?
         ORDER BY ${status === 'pending' ? 'a.created_at' : 'a.decided_at DESC'} LIMIT 100`
      )
      .bind(status)
      .all()
  ).results;
  return c.json({
    claims: rows.map(({ meta, ...r }) => {
      let m = {};
      try { m = JSON.parse(meta); } catch { /* keep empty */ }
      return { ...r, title: m.title ?? '', proof_url: m.proof_url ?? '', note: m.note ?? '', place: m.place ?? null, reject_reason: m.rejectReason ?? '' };
    }),
  });
});

claimsAdminRouter.post('/claims/:id/approve', async (c) => {
  try {
    return c.json(await approveActivity(c.env.DB, c.req.param('id'), officerOf(c)));
  } catch (err) {
    return fail(c, err);
  }
});

claimsAdminRouter.post('/claims/:id/reject', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json(await rejectActivity(c.env.DB, c.req.param('id'), officerOf(c), clip(body?.reason, 200)));
  } catch (err) {
    return fail(c, err);
  }
});
