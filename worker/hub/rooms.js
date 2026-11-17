/**
 * Meeting rooms. Officers create and close them (officer guard); students join
 * with the code, signed in, and the WebSocket is handed to the room's
 * Durable Object.
 */
import { Hono } from 'hono';

import { currentUser, ensureStudent } from './users.js';
import { notify } from './notify.js';
import { officerOf } from './team.js';
import { recordActivity } from './ledger.js';

export const roomsRouter = new Hono();
export const roomsAdminRouter = new Hono();

// No 0/O/1/I/L: codes get read off a projector.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(len = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/* --------------------------------- officers -------------------------------- */

roomsAdminRouter.post('/rooms', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim().slice(0, 80) || 'Meeting';
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      await c.env.DB.prepare('INSERT INTO rooms (code, title) VALUES (?, ?)').bind(code, title).run();
      await notify(c.env, c.env.DB, `Room ${code} is open: ${title}. Join at ${new URL(c.req.url).origin}/room`);
      return c.json({ code, title });
    } catch {
      /* code collision: try another */
    }
  }
  return c.json({ error: 'Could not allocate a room code.' }, 500);
});

roomsAdminRouter.get('/rooms', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.code, r.title, r.created_at, r.closed_at, COUNT(k.user_id) AS attendees
         FROM rooms r LEFT JOIN room_checkins k ON k.code = r.code
         GROUP BY r.code ORDER BY r.created_at DESC LIMIT 30`
      )
      .all()
  ).results;
  return c.json({ rooms: rows });
});

roomsAdminRouter.get('/rooms/:code/attendance', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT u.name, u.email, k.joined_at FROM room_checkins k
         JOIN users u ON u.id = k.user_id WHERE k.code = ? ORDER BY k.joined_at`
      )
      .bind(normCode(c.req.param('code')))
      .all()
  ).results;
  return c.json({ attendees: rows });
});

/**
 * Closing a room pays attendance: every check-in becomes an `attend` activity
 * (A2) and the ledger applies the rules. The activity ref is the room code, so
 * running this again (the Award button) only pays anyone not yet paid.
 */
export async function awardAttendance(db, code) {
  const room = await db.prepare('SELECT title FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return null;
  const rows = (
    await db
      .prepare('SELECT u.id, u.name, u.student_id, k.joined_at FROM room_checkins k JOIN users u ON u.id = k.user_id WHERE k.code = ?')
      .bind(code)
      .all()
  ).results;
  // Rooms paid by the old Award button (before A2) were logged by this reason.
  const legacy = new Set(
    (await db.prepare('SELECT student_id FROM point_events WHERE reason = ?').bind(`Meeting: ${room.title} (${code})`).all())
      .results.map((r) => r.student_id)
  );
  const out = { awarded: 0, alreadyHad: 0, unlinked: 0 };
  const seen = new Set();
  for (const u of rows) {
    const sid = u.student_id ?? (await ensureStudent(db, u));
    if (!sid) { out.unlinked++; continue; }
    if (seen.has(sid)) continue;
    seen.add(sid);
    if (legacy.has(sid)) { out.alreadyHad++; continue; }
    const r = await recordActivity(db, { studentId: sid, kind: 'attend', ref: `room:${code}`, meta: { title: room.title } }, u.joined_at);
    if (r.duplicate) out.alreadyHad++;
    else out.awarded++;
  }
  return out;
}

roomsAdminRouter.post('/rooms/:code/close', async (c) => {
  const code = normCode(c.req.param('code'));
  await c.env.DB
    .prepare(`UPDATE rooms SET closed_at = datetime('now') WHERE code = ? AND closed_at IS NULL`)
    .bind(code)
    .run();
  const result = await awardAttendance(c.env.DB, code);
  if (!result) return c.json({ error: 'No such room.' }, 404);
  return c.json({ ok: true, ...result });
});

/** Re-runs the attendance award. Safe to press any number of times. */
roomsAdminRouter.post('/rooms/:code/award', async (c) => {
  const result = await awardAttendance(c.env.DB, normCode(c.req.param('code')));
  if (!result) return c.json({ error: 'No such room.' }, 404);
  return c.json(result);
});

/* --------------------------------- public ---------------------------------- */

/** Does this code exist and is it open? Used by the join form before connecting. */
roomsRouter.get('/rooms/:code', async (c) => {
  const room = await c.env.DB
    .prepare('SELECT code, title, closed_at FROM rooms WHERE code = ?')
    .bind(normCode(c.req.param('code')))
    .first();
  if (!room) return c.json({ error: 'No room with that code.' }, 404);
  return c.json({ code: room.code, title: room.title, open: !room.closed_at });
});

roomsRouter.get('/rooms/:code/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket', 426);

  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT code, closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.text('No such room', 404);

  // Same rule as every officer route: an officer account or the shared login hosts.
  const isHost = Boolean(await officerOf(c));
  const headers = new Headers(c.req.raw.headers);

  if (isHost) {
    headers.set('x-role', 'host');
  } else {
    if (room.closed_at) return c.text('Room closed', 410);
    const user = await currentUser(c);
    if (!user) return c.text('Sign in first', 401);
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO room_checkins (code, user_id) VALUES (?, ?)')
      .bind(code, user.id)
      .run();
    headers.set('x-role', 'student');
    headers.set('x-uid', String(user.id));
    headers.set('x-name', user.name);
  }

  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code));
  return stub.fetch(new Request(c.req.raw, { headers }));
});
