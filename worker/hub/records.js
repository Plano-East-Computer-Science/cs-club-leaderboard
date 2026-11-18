/**
 * E7 verified record. An officer issues a random code for a member; anyone with
 * the code can open /verify/<code> and see the same facts the printed record
 * shows: attendance, officer role, approved competitions, placings and shipped
 * projects. Codes are 16 characters from a 32-letter alphabet (80 bits), so
 * they cannot be guessed, lookups are rate limited, and an unknown code and a
 * revoked one answer identically.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { hitOrRefuse, clientIp } from './ratelimit.js';
import { getSetting } from '../db.js';

export const recordsRouter = new Hono();
export const recordsAdminRouter = new Hono();

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
export const CODE_LEN = 16;
const MAX_ACTIVE_PER_MEMBER = 5;
const LOOKUPS = 30; // per source per 10 minutes
const ROLE_LABEL = { officer: 'Officer', lead: 'Club lead' };

export function makeRecordCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  return [...bytes].map((b) => ALPHABET[b & 31].toString()).join(''); // 256 is a multiple of 32: no bias
}

/** What a person typed or pasted, as it is stored (dashes and case do not matter). */
export const normRecordCode = (s) =>
  String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 40);

/** The facts for a code, or null when it is unknown, revoked, or its member is gone. */
export async function recordFor(db, rawCode) {
  const code = normRecordCode(rawCode);
  if (code.length !== CODE_LEN) return null;
  const row = await db
    .prepare(
      `SELECT c.code, c.issued_by_name, c.created_at, u.id AS user_id, u.name, u.role, u.student_id, u.created_at AS since
       FROM record_codes c JOIN users u ON u.id = c.user_id
       WHERE c.code = ? AND c.revoked_at IS NULL AND u.deleted_at IS NULL`
    )
    .bind(code)
    .first();
  if (!row) return null;
  const attended = await db.prepare('SELECT COUNT(*) AS n FROM room_checkins WHERE user_id = ?').bind(row.user_id).first();
  const results = row.student_id
    ? (
        await db
          .prepare(
            `SELECT kind, json_extract(meta, '$.title') AS title, json_extract(meta, '$.place') AS place, substr(decided_at, 1, 10) AS date
             FROM activity WHERE student_id = ? AND status = 'approved' AND hidden = 0 AND kind IN ('compete', 'place', 'ship')
             ORDER BY decided_at, id LIMIT 60`
          )
          .bind(row.student_id)
          .all()
      ).results
    : [];
  const club = (await getSetting(db, 'club_name', '')) || 'Computer Science Club';
  const school = (await getSetting(db, 'school_name', '')) || 'Plano East Senior High School';
  return {
    code: row.code,
    name: row.name,
    club,
    school,
    since: String(row.since).slice(0, 10),
    attended: attended.n,
    roles: ROLE_LABEL[row.role] ? [ROLE_LABEL[row.role]] : [],
    results: results.map((r) => ({ kind: r.kind, title: r.title ?? '', place: r.place ?? null, date: r.date ?? '' })),
    issued_by: row.issued_by_name,
    issued_at: new Date(row.created_at).toISOString().slice(0, 10),
  };
}

/* --------------------------------- public --------------------------------- */

recordsRouter.get('/verify/:code', async (c) => {
  const db = c.env.DB;
  // Every lookup counts, hits and misses alike, so guessing is throttled to a crawl.
  if (await hitOrRefuse(db, `verify:${clientIp(c)}`, LOOKUPS, 10 * 60_000)) {
    return c.json({ error: 'Too many lookups. Wait a few minutes.' }, 429);
  }
  const record = await recordFor(db, c.req.param('code'));
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
  if (!record) return c.json({ error: 'No current record has that code.' }, 404);
  return c.json({ record });
});

/** A member's own active codes, so their account can link to the printable page. */
recordsRouter.get('/me/records', requireUser, async (c) => {
  const codes = (
    await c.env.DB
      .prepare('SELECT code, issued_by_name, created_at FROM record_codes WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC')
      .bind(c.get('user').id)
      .all()
  ).results;
  return c.json({ codes });
});

/* -------------------------------- officers -------------------------------- */

recordsAdminRouter.get('/records', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT c.code, c.issued_by_name, c.created_at, c.revoked_at, u.id AS user_id, u.name
         FROM record_codes c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC LIMIT 100`
      )
      .all()
  ).results;
  return c.json({ records: rows });
});

recordsAdminRouter.post('/records', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const userId = Number(body?.user_id);
  const db = c.env.DB;
  const user = Number.isInteger(userId) ? await db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').bind(userId).first() : null;
  if (!user) return c.json({ error: 'No such member.' }, 404);
  const active = await db.prepare('SELECT COUNT(*) AS n FROM record_codes WHERE user_id = ? AND revoked_at IS NULL').bind(userId).first();
  if (active.n >= MAX_ACTIVE_PER_MEMBER) return c.json({ error: 'That member already has 5 active records. Revoke one first.' }, 409);
  const code = makeRecordCode();
  await db
    .prepare('INSERT INTO record_codes (code, user_id, issued_by_name, created_at) VALUES (?, ?, ?, ?)')
    .bind(code, userId, c.get('officer')?.name ?? 'officer', Date.now())
    .run();
  return c.json({ code }, 201);
});

recordsAdminRouter.post('/records/:code/revoke', async (c) => {
  const res = await c.env.DB
    .prepare('UPDATE record_codes SET revoked_at = ? WHERE code = ? AND revoked_at IS NULL')
    .bind(Date.now(), normRecordCode(c.req.param('code')))
    .run();
  if (!res.meta.changes) return c.json({ error: 'No active record has that code.' }, 404);
  return c.json({ ok: true });
});
