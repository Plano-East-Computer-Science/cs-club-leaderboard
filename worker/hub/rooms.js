/**
 * Meeting rooms. Officers create and close them (officer guard); students check
 * in with the room code plus a short token that rotates every five minutes on
 * the projector (B4), and the WebSocket is handed to the room's Durable Object.
 *
 * The room code is the stable id. The token is an HMAC of the code and the
 * current five-minute slot, so the Worker checks it without asking the DO, and
 * a token pasted into a group chat stops working within five minutes.
 */
import { Hono } from 'hono';

import { currentUser, ensureStudent } from './users.js';
import { notify } from './notify.js';
import { officerOf } from './team.js';
import { recordActivity } from './ledger.js';
import { syncQuests } from './quests.js';
import { publicName } from './names.js';
import { TEMPLATES } from '../../shared/session-templates.js';
import { sqlTime } from '../../shared/points.js';
import { getPlan } from './planner.js';
import { closeRoomGateway, openRoomGateway, roomGateway, setRoomGateway } from './gateway.js';

export const roomsRouter = new Hono();
export const roomsAdminRouter = new Hono();

// No 0/O/1/I/L: codes get read off a projector.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(len = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/* ----------------------------- B4 check-in token ---------------------------- */

export const CHECKIN_MS = 5 * 60_000;
// Someone typing as the token flips still gets in; a photo from the slot before does not.
const GRACE_MS = 45_000;
const enc = (t) => new TextEncoder().encode(t);

/** The 4-character token for a room in one five-minute slot. Same alphabet as room codes. */
export async function checkinToken(secret, code, slot) {
  const key = await crypto.subtle.importKey('raw', enc(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(`checkin:${code}:${slot}`)));
  return [...sig.slice(0, 4)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** The token on the projector now, and when it changes. */
export async function currentToken(secret, code, now = Date.now()) {
  const slot = Math.floor(now / CHECKIN_MS);
  return { token: await checkinToken(secret, code, slot), rotatesAt: (slot + 1) * CHECKIN_MS };
}

// ponytail: no per-user attempt limit; 31^4 tokens per five minutes is plenty for a club. Add a counter if guessing shows up.
export async function tokenOk(secret, code, token, now = Date.now()) {
  const t = normCode(token);
  if (t.length !== 4 || !secret) return false;
  const slot = Math.floor(now / CHECKIN_MS);
  if (t === (await checkinToken(secret, code, slot))) return true;
  return now - slot * CHECKIN_MS < GRACE_MS && t === (await checkinToken(secret, code, slot - 1));
}

const secretOf = (env) => env.SESSION_SECRET || env.ADMIN_PASSWORD;

/* --------------------------------- officers -------------------------------- */

roomsAdminRouter.post('/rooms', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // G1: a room opened from the planner takes the plan's template and blocks.
  let plan = null;
  if (body?.planId != null) {
    plan = await getPlan(c.env.DB, Number(body.planId));
    if (!plan) return c.json({ error: 'No such planned session.' }, 404);
    if (plan.roomCode && (await c.env.DB.prepare('SELECT 1 AS x FROM rooms WHERE code = ?').bind(plan.roomCode).first())) {
      return c.json({ error: `That session already has room ${plan.roomCode}.` }, 409);
    }
  }
  const title = String(body?.title ?? plan?.title ?? '').trim().slice(0, 80) || 'Meeting';
  // B1/B10: a template id, or "dropin" for a Panther Pause room with no agenda.
  const template = plan ? plan.template : String(body?.template ?? 'build');
  if (template !== 'dropin' && !Object.hasOwn(TEMPLATES, template)) return c.json({ error: 'Pick a template.' }, 400);
  const kind = template === 'dropin' ? 'dropin' : 'meeting';
  let code = null;
  for (let i = 0; i < 5 && !code; i++) {
    const tryCode = makeCode();
    try {
      await c.env.DB.prepare('INSERT INTO rooms (code, title, kind, template) VALUES (?, ?, ?, ?)')
        .bind(tryCode, title, kind, kind === 'dropin' ? '' : template)
        .run();
      code = tryCode;
    } catch {
      /* code collision: try another. Only the INSERT is in here, so a later failure never makes a second room. */
    }
  }
  if (code) {
    if (plan) await c.env.DB.prepare('UPDATE planned_sessions SET room_code = ? WHERE id = ?').bind(code, plan.id).run();
    // H1: the room's own gateway code. Members who check in see it; no code to hand out.
    await openRoomGateway(c.env.DB, code, template).catch((err) => console.error('room gateway failed', err?.message ?? err));
    await notify(c.env, c.env.DB, `Room ${code} is open: ${title}. Join at ${new URL(c.req.url).origin}/room`);
    return c.json({ code, title, kind, template });
  }
  return c.json({ error: 'Could not allocate a room code.' }, 500);
});

roomsAdminRouter.get('/rooms', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT r.code, r.title, r.kind, r.template, r.created_at, r.closed_at,
                COUNT(k.user_id) AS attendees, COUNT(k.exit_kind) AS eligible
         FROM rooms r LEFT JOIN room_checkins k ON k.code = r.code
         GROUP BY r.code ORDER BY r.created_at DESC LIMIT 30`
      )
      .all()
  ).results;
  return c.json({ rooms: rows });
});

/** B4: the token the projector shows right now, and when to ask again. */
roomsAdminRouter.get('/rooms/:code/checkin', async (c) => {
  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.json({ error: 'No such room.' }, 404);
  return c.json(await currentToken(secretOf(c.env), code));
});

roomsAdminRouter.get('/rooms/:code/attendance', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT u.name, u.email, k.joined_at, k.exit_kind, k.exit_note FROM room_checkins k
         JOIN users u ON u.id = k.user_id WHERE k.code = ? ORDER BY k.joined_at`
      )
      .bind(normCode(c.req.param('code')))
      .all()
  ).results;
  return c.json({ attendees: rows });
});

/** B2: every duel result in a room, with the submitted code, so officers can spot-check. */
roomsAdminRouter.get('/rooms/:code/duel', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT d.round, d.division, d.match_no, d.user_id, u.name, d.slug, d.attempts, d.solved_ms, d.won, d.code
         FROM duel_results d LEFT JOIN users u ON u.id = d.user_id
         WHERE d.room_code = ? ORDER BY d.round, d.division, d.match_no`
      )
      .bind(normCode(c.req.param('code')))
      .all()
  ).results;
  return c.json({ results: rows });
});

/**
 * Closing a room pays attendance (A2, V3-A). Every member who checked in with
 * a current token (every room_checkins row) is paid `attend`, or the smaller
 * `dropin` for a drop-in (B10). A member who also did something in the room
 * (an exit artifact, B4) gets the small `active` bonus on top. The ledger
 * applies the rules and caps. The ref is the room code, so running this again
 * (the Award button, the auto-close cron) only pays anyone not yet paid, such
 * as someone whose close note landed late.
 */
export async function awardAttendance(db, code) {
  const room = await db.prepare('SELECT title, kind FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return null;
  const dropin = room.kind === 'dropin';
  const rows = (
    await db
      .prepare('SELECT u.id, u.name, u.student_id, k.joined_at, k.exit_kind FROM room_checkins k JOIN users u ON u.id = k.user_id WHERE k.code = ?')
      .bind(code)
      .all()
  ).results;
  // Rooms paid by the old Award button (before A2) were logged by this reason.
  const legacy = new Set(
    (await db.prepare('SELECT student_id FROM point_events WHERE reason = ?').bind(`Meeting: ${room.title} (${code})`).all())
      .results.map((r) => r.student_id)
  );
  // noExit: paid attendance but did nothing else in the room, so no bonus.
  const out = { awarded: 0, alreadyHad: 0, unlinked: 0, noExit: 0, bonus: 0 };
  const seen = new Set();
  for (const u of rows) {
    const sid = u.student_id ?? (await ensureStudent(db, u));
    if (!sid) { out.unlinked++; continue; }
    if (seen.has(sid)) continue;
    seen.add(sid);
    if (!u.exit_kind) out.noExit++;
    const ref = `room:${code}`;
    if (legacy.has(sid)) out.alreadyHad++;
    else {
      const meta = { title: room.title, ...(u.exit_kind && { exit: u.exit_kind }), ...(dropin && { dropin: true }) };
      const r = await recordActivity(db, { studentId: sid, kind: dropin ? 'dropin' : 'attend', ref, meta }, u.joined_at);
      if (r.duplicate) out.alreadyHad++;
      else out.awarded++;
    }
    if (u.exit_kind) {
      const b = await recordActivity(db, { studentId: sid, kind: 'active', ref, meta: { title: room.title, exit: u.exit_kind } }, u.joined_at);
      if (!b.duplicate) out.bonus++;
    }
    await syncQuests(db, u.id); // A4: meetings finish quests
  }
  return out;
}

/** Closes a room and pays it. Shared by the officer's Close and the auto-close cron. */
export async function closeRoom(db, code) {
  await db.prepare(`UPDATE rooms SET closed_at = datetime('now') WHERE code = ? AND closed_at IS NULL`).bind(code).run();
  await closeRoomGateway(db, code); // H1: the gateway ends with the meeting
  return awardAttendance(db, code);
}

roomsAdminRouter.post('/rooms/:code/close', async (c) => {
  const result = await closeRoom(c.env.DB, normCode(c.req.param('code')));
  if (!result) return c.json({ error: 'No such room.' }, 404);
  return c.json({ ok: true, ...result });
});

/* --------------------------- V3-A: auto-close cron --------------------------- */

export const STALE_HOURS = 8;

/** Codes of rooms still open more than STALE_HOURS after they were opened: someone forgot to end them. */
export async function staleRooms(db, now = new Date()) {
  const cutoff = sqlTime(now.getTime() - STALE_HOURS * 3_600_000);
  const rows = (await db.prepare('SELECT code FROM rooms WHERE closed_at IS NULL AND created_at < ? ORDER BY created_at').bind(cutoff).all()).results;
  return rows.map((r) => r.code);
}

/**
 * Hourly (worker/index.js scheduled): closes and pays every stale room, so a
 * forgotten room still pays the members who came. One failing room does not
 * stop the rest.
 */
// ponytail: members still connected keep their socket until they reload; the Worker refuses new joins once closed_at is set.
export async function autoCloseRooms(env, now = new Date()) {
  const out = { closed: [], failed: [] };
  for (const code of await staleRooms(env.DB, now)) {
    try {
      await closeRoom(env.DB, code);
      out.closed.push(code);
    } catch (err) {
      console.error('[rooms] auto-close failed', code, err?.message ?? err);
      out.failed.push(code);
    }
  }
  return out;
}

/* ------------------------------ H1: room gateway ------------------------------ */

roomsAdminRouter.get('/rooms/:code/gateway', async (c) => {
  const gw = await roomGateway(c.env.DB, normCode(c.req.param('code')));
  return gw ? c.json(gw) : c.json({ error: 'This room has no gateway.' }, 404);
});

roomsAdminRouter.put('/rooms/:code/gateway', async (c) => {
  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.json({ error: 'No such room.' }, 404);
  const body = await c.req.json().catch(() => ({}));
  if (room.closed_at && body?.on === true) return c.json({ error: 'That room has closed.' }, 410);
  const r = await setRoomGateway(c.env.DB, code, { presets: body?.presets, on: typeof body?.on === 'boolean' ? body.on : undefined });
  if (r.error) return c.json({ error: r.error }, 404);
  return c.json(await roomGateway(c.env.DB, code));
});

/** The open room this member checked in to, with its gateway code, so /gateway needs no typing. */
async function myRoomGateway(db, userId, onlyCode = null) {
  const rows = (
    await db
      .prepare(
        `SELECT r.code, r.title FROM room_checkins k JOIN rooms r ON r.code = k.code
         WHERE k.user_id = ? AND r.closed_at IS NULL ${onlyCode ? 'AND r.code = ?' : ''}
         ORDER BY k.joined_at DESC LIMIT 3`
      )
      .bind(...(onlyCode ? [userId, onlyCode] : [userId]))
      .all()
  ).results;
  for (const r of rows) {
    const gw = await roomGateway(db, r.code);
    if (gw?.active) return { room: r.code, title: r.title, code: gw.code, hosts: gw.hosts, presets: gw.presets.filter((p) => p.on).map((p) => p.name) };
  }
  return null;
}

roomsRouter.get('/rooms/:code/gateway', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Sign in first.' }, 401);
  const gw = await myRoomGateway(c.env.DB, user.id, normCode(c.req.param('code')));
  return c.json({ gateway: gw });
});

roomsRouter.get('/gateway/mine', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ gateway: null });
  return c.json({ gateway: await myRoomGateway(c.env.DB, user.id) });
});

/** Re-runs the attendance award. Safe to press any number of times. */
roomsAdminRouter.post('/rooms/:code/award', async (c) => {
  const result = await awardAttendance(c.env.DB, normCode(c.req.param('code')));
  if (!result) return c.json({ error: 'No such room.' }, 404);
  return c.json(result);
});

/* --------------------------------- public ---------------------------------- */

/** Does this code exist and is it open, and has this member checked in? Used before connecting. */
roomsRouter.get('/rooms/:code', async (c) => {
  const room = await c.env.DB
    .prepare('SELECT code, title, kind, closed_at FROM rooms WHERE code = ?')
    .bind(normCode(c.req.param('code')))
    .first();
  if (!room) return c.json({ error: 'No room with that code.' }, 404);
  const user = await currentUser(c);
  const checkedIn = Boolean(
    user && (await c.env.DB.prepare('SELECT 1 AS x FROM room_checkins WHERE code = ? AND user_id = ?').bind(room.code, user.id).first())
  );
  return c.json({ code: room.code, title: room.title, kind: room.kind, open: !room.closed_at, checkedIn });
});

/** B4: check in with the token on the projector. This is the only way a check-in row is made. */
roomsRouter.post('/rooms/:code/checkin', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Sign in first.' }, 401);
  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT code, closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.json({ error: 'No room with that code. Check the screen.' }, 404);
  if (room.closed_at) return c.json({ error: 'That room has already closed.' }, 410);
  const body = await c.req.json().catch(() => ({}));
  if (!(await tokenOk(secretOf(c.env), code, body?.token))) {
    return c.json({ error: 'That check-in word is not current. Use the one on the screen right now.' }, 403);
  }
  await c.env.DB.prepare('INSERT OR IGNORE INTO room_checkins (code, user_id) VALUES (?, ?)').bind(code, user.id).run();
  return c.json({ ok: true, code });
});

roomsRouter.get('/rooms/:code/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket', 426);

  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT code, closed_at, kind, template FROM rooms WHERE code = ?').bind(code).first();
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
    // B4: no check-in with a current token, no room. Reconnecting after the token rotates still works.
    const checked = await c.env.DB.prepare('SELECT 1 AS x FROM room_checkins WHERE code = ? AND user_id = ?').bind(code, user.id).first();
    if (!checked) return c.text('Check in first', 403);
    headers.set('x-role', 'student');
    headers.set('x-uid', String(user.id));
    // The room shows names on a projector and to every phone: first name unless the member opted in.
    headers.set('x-name', publicName(user.name, user.show_full_name));
  }

  headers.set('x-code', code); // the room records duel results and artifacts under it
  headers.set('x-kind', room.kind || 'meeting');
  headers.set('x-template', room.template || 'build');
  // G1: a planned session's blocks (already validated when saved) are the room's run-of-show.
  const planned = await c.env.DB.prepare('SELECT blocks FROM planned_sessions WHERE room_code = ?').bind(code).first();
  if (planned) headers.set('x-blocks', encodeURIComponent(planned.blocks)); // ASCII-safe for a header
  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code));
  return stub.fetch(new Request(c.req.raw, { headers }));
});
