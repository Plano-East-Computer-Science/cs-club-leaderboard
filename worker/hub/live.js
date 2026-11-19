/**
 * Wave 6, the live meeting, outside the room's Durable Object:
 *
 *   early questions  members ask and upvote on Today, from openEarlyHours before
 *                    a planned speaker night until its room opens; the room loads
 *                    them (room-do.js loadQuestions). Reports go to the reports
 *                    table as kind 'question' (safety.js).
 *   speaker link     a private read-only link for the guest speaker, no account:
 *                    an HMAC of the room code, so it cannot be guessed, and it
 *                    stops working the moment the room closes.
 *   recap            /recap/:code once a room has closed: public, first names only.
 */
import { Hono } from 'hono';

import { requireUser } from './users.js';
import { firstName } from './names.js';
import { hitOrRefuse } from './ratelimit.js';
import { getAllSettings } from '../db.js';
import { MEETING_DEFAULTS } from './club.js';
import { speakerOf } from '../../shared/session-templates.js';
import { kindName } from '../../shared/planner.js';
import { chicagoDate } from '../../shared/daily.js';
import { champions, earlyWindow } from '../../shared/live.js';

export const liveRouter = new Hono();
export const liveAdminRouter = new Hono();

const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const secretOf = (env) => env.SESSION_SECRET || env.ADMIN_PASSWORD;
const enc = (t) => new TextEncoder().encode(t);
const MAX_OPEN_PER_MEMBER = 3;

/* -------------------------------- speaker link -------------------------------- */

/** 128 bits of HMAC over the room code, base64url: the guest's private link token. */
export async function speakerToken(secret, code) {
  if (!secret) throw new Error('No secret to sign the speaker link with.');
  const key = await crypto.subtle.importKey('raw', enc(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(`speaker:${normCode(code)}`)));
  return btoa(String.fromCharCode(...sig.slice(0, 16))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time check of a token from the address bar. */
export async function speakerTokenOk(secret, code, token) {
  const t = String(token ?? '');
  if (!secret || t.length !== 22) return false;
  const want = await speakerToken(secret, code);
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ t.charCodeAt(i);
  return diff === 0;
}

/** A read from the room's Durable Object: `guest` or `recap`. null when there is no room binding. */
async function readRoom(env, code, role) {
  if (!env.ROOMS) return null;
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  const res = await stub.fetch(new Request(`https://room.internal/${role}`, { headers: { 'x-role': role } }));
  return res.ok ? res.json() : null;
}

liveAdminRouter.get('/rooms/:code/speaker-link', async (c) => {
  const code = normCode(c.req.param('code'));
  const room = await c.env.DB.prepare('SELECT closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.json({ error: 'No such room.' }, 404);
  if (room.closed_at) return c.json({ error: 'That room has closed, so its speaker link has ended.' }, 410);
  return c.json({ path: `/speaker/${code}/${await speakerToken(secretOf(c.env), code)}` });
});

liveRouter.get('/speaker/:code/:token', async (c) => {
  const code = normCode(c.req.param('code'));
  if (!(await speakerTokenOk(secretOf(c.env), code, c.req.param('token')))) return c.json({ error: 'This link is not valid.' }, 404);
  const room = await c.env.DB.prepare('SELECT title, closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return c.json({ error: 'This link is not valid.' }, 404);
  if (room.closed_at) return c.json({ error: 'The meeting has ended. Thank you for speaking.', ended: true }, 410);
  const view = await readRoom(c.env, code, 'guest');
  if (!view) return c.json({ error: 'The room did not answer. Try again in a moment.' }, 503);
  return c.json({ title: room.title, ...view }, 200, { 'Cache-Control': 'no-store' });
});

/* ------------------------------- early questions ------------------------------- */

/**
 * The next planned speaker night (today or later), with its question window.
 * Officers' seed questions come first. Returns null when none is planned.
 */
async function speakerNight(db, now = Date.now()) {
  const rows = (await db.prepare('SELECT * FROM planned_sessions WHERE date >= ? ORDER BY date, id LIMIT 6').bind(chicagoDate(new Date(now))).all()).results;
  for (const r of rows) {
    let blocks = [];
    try {
      blocks = JSON.parse(r.blocks || '[]');
    } catch {
      continue;
    }
    const sp = speakerOf(blocks);
    if (!sp) continue;
    const settings = await getAllSettings(db);
    const time = String(settings.meeting_time ?? '').trim() || MEETING_DEFAULTS.meeting_time;
    const room = r.room_code ? await db.prepare('SELECT code, closed_at FROM rooms WHERE code = ?').bind(r.room_code).first() : null;
    return { plan: r, sp, room, ...earlyWindow({ date: r.date, time, hours: sp.openEarlyHours, now }) };
  }
  return null;
}

/** Early questions for one plan, most votes first. `uid` marks the member's own and their votes. */
async function earlyList(db, planId, uid) {
  return (
    await db
      .prepare(
        `SELECT q.id, q.text, q.user_id,
                (SELECT COUNT(*) FROM early_question_marks m WHERE m.question_id = q.id AND m.kind = 'up') AS votes,
                EXISTS (SELECT 1 FROM early_question_marks m WHERE m.question_id = q.id AND m.kind = 'up' AND m.user_id = ?) AS voted
         FROM early_questions q WHERE q.plan_id = ? AND q.hidden = 0 ORDER BY votes DESC, q.id`
      )
      .bind(uid, planId)
      .all()
  ).results.map((r) => ({ id: r.id, text: r.text, votes: r.votes, voted: Boolean(r.voted), mine: r.user_id === uid }));
}

liveRouter.get('/speaker-questions', requireUser, async (c) => {
  const db = c.env.DB;
  const n = await speakerNight(db);
  if (!n) return c.json({ night: null });
  const uid = c.get('user').id;
  const { plan, sp, room } = n;
  const live = room && !room.closed_at ? room.code : null;
  const open = n.open && !plan.room_code;
  return c.json({
    night: { id: plan.id, date: plan.date, title: plan.title, speaker: { name: sp.name, title: sp.title, intro: sp.intro } },
    opensAt: n.opensAt,
    startsAt: n.startsAt,
    open,
    room: live,
    // Before the window opens there is nothing to show; once the room opens, questions live there.
    questions: open ? [...sp.seedQuestions.map((text, i) => ({ id: `s${i}`, text, seed: true, votes: 0 })), ...(await earlyList(db, plan.id, uid))] : [],
  });
});

/** The plan behind an early question, if members may still act on it right now. */
async function openNightFor(db, planId) {
  const n = await speakerNight(db);
  if (!n || n.plan.id !== Number(planId)) return { error: 'Questions for that meeting are closed.' };
  if (n.plan.room_code) return { error: 'The room is open. Ask there.' };
  if (!n.open) return { error: 'Questions open a day before the meeting.' };
  return { night: n };
}

liveRouter.post('/speaker-questions', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const text = String(body?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (text.length < 3) return c.json({ error: 'Type a question first.' }, 400);
  const o = await openNightFor(db, body?.planId);
  if (o.error) return c.json({ error: o.error }, 409);
  const planId = o.night.plan.id;
  const mine = await db.prepare('SELECT COUNT(*) AS n FROM early_questions WHERE plan_id = ? AND user_id = ? AND hidden = 0').bind(planId, user.id).first();
  if (mine.n >= MAX_OPEN_PER_MEMBER) return c.json({ error: 'Three questions is the limit. Upvote others meanwhile.' }, 429);
  if (await hitOrRefuse(db, `early-q:${user.id}`, 10, 3_600_000)) return c.json({ error: 'That is a lot of questions. Try again later.' }, 429);
  await db.prepare('INSERT INTO early_questions (plan_id, user_id, text) VALUES (?, ?, ?)').bind(planId, user.id, text).run();
  return c.json({ ok: true, questions: await earlyList(db, planId, user.id) });
});

liveRouter.post('/speaker-questions/:id/vote', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = await db.prepare('SELECT id, plan_id, user_id FROM early_questions WHERE id = ? AND hidden = 0').bind(Number(c.req.param('id'))).first();
  if (!q) return c.json({ error: 'That question is not there any more.' }, 404);
  if (q.user_id === user.id) return c.json({ error: 'You cannot upvote your own question.' }, 400);
  const o = await openNightFor(db, q.plan_id);
  if (o.error) return c.json({ error: o.error }, 409);
  const had = await db.prepare(`SELECT 1 AS x FROM early_question_marks WHERE question_id = ? AND user_id = ? AND kind = 'up'`).bind(q.id, user.id).first();
  await db
    .prepare(had ? `DELETE FROM early_question_marks WHERE question_id = ? AND user_id = ? AND kind = 'up'` : `INSERT OR IGNORE INTO early_question_marks (question_id, user_id, kind) VALUES (?, ?, 'up')`)
    .bind(q.id, user.id)
    .run();
  return c.json({ ok: true, questions: await earlyList(db, q.plan_id, user.id) });
});

/* ------------------------- officers: moderate early questions ------------------------- */

liveAdminRouter.get('/planner/:id/questions', async (c) => {
  const rows = (
    await c.env.DB
      .prepare(
        `SELECT q.id, q.text, q.hidden, q.created_at, u.name,
                (SELECT COUNT(*) FROM early_question_marks m WHERE m.question_id = q.id AND m.kind = 'up') AS votes,
                (SELECT COUNT(*) FROM reports r WHERE r.kind = 'question' AND r.target_id = q.id AND r.status = 'open') AS reports
         FROM early_questions q LEFT JOIN users u ON u.id = q.user_id WHERE q.plan_id = ? ORDER BY q.hidden, votes DESC, q.id`
      )
      .bind(Number(c.req.param('id')))
      .all()
  ).results;
  return c.json({ questions: rows.map((r) => ({ ...r, hidden: Boolean(r.hidden) })) });
});

liveAdminRouter.post('/early-questions/:id/hide', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const r = await c.env.DB.prepare('UPDATE early_questions SET hidden = ? WHERE id = ?').bind(body?.hidden === false ? 0 : 1, Number(c.req.param('id'))).run();
  if (!r.meta.changes) return c.json({ error: 'No such question.' }, 404);
  return c.json({ ok: true });
});

/* ------------------------------------ recap ------------------------------------ */

const DIVISION = { new: 'New', comfortable: 'Comfortable', contest: 'Contest' };

/**
 * Everything the public recap shows, from a closed room. First names only,
 * no links (a member's project address is theirs to share), no officer notes.
 * Returns null when the room does not exist or is still open.
 */
export async function recapOf(db, env, code) {
  const room = await db.prepare('SELECT code, title, template, created_at, closed_at FROM rooms WHERE code = ?').bind(code).first();
  if (!room?.closed_at) return null;
  const came = (await db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM room_checkins WHERE code = ?').bind(code).first()).n;
  const duelRows = (
    await db.prepare('SELECT d.division, d.user_id, d.won, d.solved_ms, u.name FROM duel_results d LEFT JOIN users u ON u.id = d.user_id WHERE d.room_code = ?').bind(code).all()
  ).results;
  const shown = (
    await db
      .prepare(
        `SELECT a.kind, a.line, a.result, a.kudos, a.shown, u.name FROM artifacts a LEFT JOIN users u ON u.id = a.user_id
         WHERE a.room_code = ? ORDER BY a.shown DESC, a.kudos DESC, a.created_at LIMIT 6`
      )
      .bind(code)
      .all()
  ).results;
  const plan = await db.prepare('SELECT blocks FROM planned_sessions WHERE room_code = ?').bind(code).first();
  let sp = null;
  try {
    sp = speakerOf(JSON.parse(plan?.blocks || '[]'));
  } catch {
    /* a bad plan row still has a recap */
  }
  let questions = [];
  try {
    questions = (await readRoom(env, code, 'recap'))?.questions ?? [];
  } catch (err) {
    console.error('recap room read failed', err?.message ?? err);
  }
  return {
    code: room.code,
    title: room.title,
    kind: kindName(room.template),
    date: chicagoDate(new Date(`${room.created_at.replace(' ', 'T')}Z`)),
    came,
    speaker: sp?.name ? { name: sp.name, title: sp.title } : null,
    questions,
    champions: champions(duelRows).map((x) => ({ division: DIVISION[x.division], name: firstName(x.name), wins: x.wins, solved: x.solved })),
    shown: shown.map((a) => ({ name: firstName(a.name), line: a.line, result: a.result, kudos: a.kudos, shown: Boolean(a.shown) })),
  };
}

liveRouter.get('/recap/:code', async (c) => {
  const r = await recapOf(c.env.DB, c.env, normCode(c.req.param('code')));
  if (!r) return c.json({ error: 'There is no recap for that room yet. It appears when the room closes.' }, 404);
  return c.json(r, 200, { 'Cache-Control': 'public, max-age=120' });
});
