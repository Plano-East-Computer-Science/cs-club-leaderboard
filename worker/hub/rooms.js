/**
 * Meeting rooms. Officers create and close them (admin cookie); students join
 * with the code, signed in, and the WebSocket is handed to the room's
 * Durable Object.
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';

import { COOKIE, verifySession } from '../auth.js';
import { currentUser } from './users.js';

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

roomsAdminRouter.post('/rooms/:code/close', async (c) => {
  await c.env.DB
    .prepare(`UPDATE rooms SET closed_at = datetime('now') WHERE code = ? AND closed_at IS NULL`)
    .bind(normCode(c.req.param('code')))
    .run();
  return c.json({ ok: true });
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

  const isHost = await verifySession(c.env, getCookie(c, COOKIE));
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
