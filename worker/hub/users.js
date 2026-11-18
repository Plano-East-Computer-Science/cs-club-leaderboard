/**
 * Student accounts: a sign-in email to a personal address, then a signed
 * cookie. No passwords exist, so none can leak or be reused.
 *
 * The email carries a link and a 6-digit code that expire together. The link
 * signs in whichever browser opens it; the code lets someone who asked on a
 * laptop and opened the mail on a phone finish on the laptop.
 *
 * The cookie (`cslb_user`) carries the user id, an expiry and the account's
 * session version. Signing out bumps the version, which ends every session of
 * that account at once (a copied cookie stops working too). An account with role
 * officer or lead also passes the officer guard (see team.js), which reads the
 * role fresh from this table on every request.
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

import { signValue, verifyValue, randomToken, safeEqual, DISTRICT_DOMAIN } from '../auth.js';
import { sendEmail, emailEnabled, esc } from '../email.js';
import { hitOrRefuse, clientIp } from './ratelimit.js';

export const USER_COOKIE = 'cslb_user';
const SESSION_MS = 1000 * 60 * 60 * 24 * 60; // 60 days
const LINK_TTL_MS = 1000 * 60 * 15; // link and code expire together
const LINK_COOLDOWN_MS = 1000 * 60;

/**
 * Sign-in email caps. A school network puts a whole classroom behind one IP, so
 * the per-source cap is sized for ~40 people each asking two or three times; the
 * per-address cap is what stops one inbox being flooded. Together they bound
 * the route as a mail cannon. A request inside the cooldown sends nothing and
 * counts against neither.
 */
export const SIGNIN_LIMITS = {
  perIp: { limit: 120, windowMs: 60 * 60_000 },
  perEmail: { limit: 6, windowMs: 60 * 60_000 },
  cooldownMs: LINK_COOLDOWN_MS,
  ttlMs: LINK_TTL_MS,
  codeTries: 5, // wrong guesses per emailed code: 6 codes an hour x 5 tries = 30 guesses in a million
};

/** 6 random digits, without modulo bias. */
function makeCode() {
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= 4_294_000_000);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

/** Keyed hash of a code, salted with its token so equal codes never hash alike. */
const codeHash = async (env, token, code) => (await signValue(env, `signin-code|${token}|${code}`)).split('.').pop();

export const usersRouter = new Hono();

const cookieOpts = (c) => ({
  httpOnly: true,
  sameSite: 'Lax',
  // `secure` cookies are dropped on plain-http localhost by some browsers;
  // production is always https.
  secure: new URL(c.req.url).protocol === 'https:',
  path: '/',
  maxAge: SESSION_MS / 1000,
});

/** The signed-in user row, or null. Cheap enough to call per request. */
export async function currentUser(c) {
  const payload = await verifyValue(c.env, getCookie(c, USER_COOKIE));
  if (!payload) return null;
  const [id, exp, ver = 0] = payload.split(':').map(Number);
  if (!id || !(exp > Date.now())) return null;
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, student_id, role, created_at, show_full_name, deleted_at, session_ver FROM users WHERE id = ?'
  )
    .bind(id)
    .first();
  // G5: a deleted account is signed out everywhere at once, even though its cookie still verifies.
  if (!user || user.deleted_at || user.session_ver !== ver) return null;
  delete user.deleted_at;
  delete user.session_ver;
  // Accounts from before A1 get their entry lazily, the first time they are seen.
  if (user && !user.student_id) user.student_id = await ensureStudent(c.env.DB, user);
  return user;
}

/**
 * A1: every account has a leaderboard entry. Creates one named after the
 * account if it has none, and returns the student id. Skipped (returns null)
 * while the account has an open link request from before A1, so approving
 * that request still links to the entry the member asked for.
 *
 * Both statements carry the same conditions inside one transaction, so two
 * requests racing on a brand-new account cannot create two entries.
 */
export async function ensureStudent(db, user) {
  if (user.student_id) return user.student_id;
  const needs = `EXISTS (SELECT 1 FROM users WHERE id = ? AND student_id IS NULL)
    AND NOT EXISTS (SELECT 1 FROM link_requests WHERE user_id = ?)`;
  const name = String(user.name || 'Member').slice(0, 40);
  await db.batch([
    db
      .prepare(`INSERT INTO students (name, avatar_seed) SELECT ?, ? WHERE ${needs}`)
      .bind(name, name.toLowerCase().replace(/\W+/g, ''), user.id, user.id),
    db
      .prepare(`UPDATE users SET student_id = (SELECT MAX(id) FROM students) WHERE id = ? AND ${needs}`)
      .bind(user.id, user.id, user.id),
  ]);
  return (await db.prepare('SELECT student_id FROM users WHERE id = ?').bind(user.id).first())?.student_id ?? null;
}

/** Hono middleware: 401 unless signed in. Puts the row on c.get('user'). */
export async function requireUser(c, next) {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Sign in first.' }, 401);
  c.set('user', user);
  await next();
}

/** Creates the account on first sight, then sets the session cookie. Shared by every sign-in method. */
export async function startSession(c, email, name) {
  const db = c.env.DB;
  // A deleted account stays closed until it is purged; no session, no revival.
  if ((await db.prepare('SELECT deleted_at FROM users WHERE email = ?').bind(email).first())?.deleted_at) return null;
  await db
    .prepare(
      `INSERT INTO users (email, name, last_seen) VALUES (?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET last_seen = datetime('now')`
    )
    .bind(email, name)
    .run();
  const user = await db.prepare('SELECT id, name, student_id, session_ver FROM users WHERE email = ?').bind(email).first();
  await ensureStudent(db, user);
  setCookie(c, USER_COOKIE, await signValue(c.env, `${user.id}:${Date.now() + SESSION_MS}:${user.session_ver}`), cookieOpts(c));
  return user.id;
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

usersRouter.get('/me', async (c) => {
  const user = await currentUser(c);
  return c.json({ user });
});

usersRouter.patch('/me', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.get('user').id;
  const db = c.env.DB;
  if (body?.name !== undefined) {
    const name = cleanName(body.name);
    if (name.length < 2) return c.json({ error: 'Pick a name of at least 2 characters.' }, 400);
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, id).run();
  }
  // G5: whether public pages show the full name. Off unless the member turns it on.
  if (body?.show_full_name !== undefined) {
    await db.prepare('UPDATE users SET show_full_name = ? WHERE id = ?').bind(body.show_full_name === true ? 1 : 0, id).run();
  }
  return c.json({ ok: true });
});

usersRouter.post('/auth/request', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const name = cleanName(body?.name);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.json({ error: 'That does not look like an email address.' }, 400);
  }
  if (email.endsWith(`@${DISTRICT_DOMAIN}`)) {
    return c.json({ error: 'Use a personal address (Gmail, Outlook). School mail blocks club email.' }, 400);
  }

  const db = c.env.DB;
  const existing = await db.prepare('SELECT id, name, deleted_at FROM users WHERE email = ?').bind(email).first();
  if (existing?.deleted_at) return c.json({ error: 'That account was deleted. Email the club if that was a mistake.' }, 403);
  if (!existing && name.length < 2) {
    return c.json({ error: 'First time here? Add a display name too.', needName: true }, 400);
  }

  // One email per cooldown. The earlier one is still good, so this is not an error.
  const now = Date.now();
  const last = await db.prepare('SELECT MAX(created_at) AS t FROM login_tokens WHERE email = ?').bind(email).first();
  if (last?.t && now - last.t < LINK_COOLDOWN_MS) {
    return c.json({ ok: true, cooldown: true, retryIn: Math.ceil((LINK_COOLDOWN_MS - (now - last.t)) / 1000) });
  }

  // This route emails an address the caller typed, so it is a mail cannon unless capped.
  const { perIp, perEmail } = SIGNIN_LIMITS;
  if (await hitOrRefuse(db, `signin:${clientIp(c)}`, perIp.limit, perIp.windowMs, now)) {
    return c.json({ error: 'A lot of people on this network are signing in right now. Give it a few minutes and try again.' }, 429);
  }
  if (await hitOrRefuse(db, `signin-email:${email}`, perEmail.limit, perEmail.windowMs, now)) {
    return c.json({ error: 'We already sent several emails to this address in the last hour. Use the newest one, or try again later.' }, 429);
  }

  const token = randomToken(24);
  const code = makeCode();
  await db
    .prepare('INSERT INTO login_tokens (token, email, name, created_at, code_hash) VALUES (?, ?, ?, ?, ?)')
    .bind(token, email, existing?.name ?? name, now, await codeHash(c.env, token, code))
    .run();

  const origin = new URL(c.req.url).origin;
  const link = `${origin}/api/auth/verify?t=${token}`;

  // Local development only: hand the link and code back instead of emailing them.
  // DEV_LOGIN is set in .dev.vars and never exists in production.
  if (c.env.DEV_LOGIN === '1') return c.json({ ok: true, devLink: link, devCode: code });

  if (!emailEnabled(c.env)) return c.json({ error: 'Email is not switched on yet. Ask an officer.' }, 503);
  const sent = await sendEmail(c.env, {
    to: email,
    subject: `${code} is your CS Club sign-in code`,
    text: `Your Plano East CS Club sign-in code is ${code}\n\nType it on the sign-in page, or open this link on the device you want to use:\n\n${link}\n\nBoth expire in 15 minutes and work once. If you did not ask for this, ignore it.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:28rem">
           <p>Your Plano East CS Club sign-in code:</p>
           <p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,Menlo,monospace;margin:8px 0 16px">${code}</p>
           <p>Type it on the sign-in page. Or open this link on the device you want to use:</p>
           <p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Sign in on this device</a></p>
           <p style="color:#6b7689;font-size:13px">Both expire in 15 minutes and work once. If you did not ask for this, ignore it.</p></div>`,
  });
  if (!sent.ok) return c.json({ error: `Could not send the email: ${sent.error}` }, 502);
  return c.json({ ok: true });
});

/** Marks one token used. false when another request got there first. */
const claim = async (db, token) =>
  (await db.prepare('UPDATE login_tokens SET used = 1 WHERE token = ? AND used = 0').bind(token).run()).meta.changes > 0;

/** Finish signing in with the code from the email, on the device that asked. */
usersRouter.post('/auth/code', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const code = String(body?.code ?? '').replace(/\D/g, '');
  if (code.length !== 6) return c.json({ error: 'Enter the 6-digit code from the email.' }, 400);

  const db = c.env.DB;
  const { codeTries, ttlMs } = SIGNIN_LIMITS;
  // Every live code for the address counts: a member may type the code from an earlier email.
  const { results: rows } = await db
    .prepare(
      'SELECT token, name, code_hash, tries FROM login_tokens WHERE email = ? AND used = 0 AND tries < ? AND created_at > ? AND code_hash IS NOT NULL'
    )
    .bind(email, codeTries, Date.now() - ttlMs)
    .all();
  if (!rows.length) return c.json({ error: 'That code has expired or was already used. Send a new one.', expired: true }, 400);

  for (const r of rows) {
    if (!safeEqual(r.code_hash, await codeHash(c.env, r.token, code))) continue;
    if (!(await claim(db, r.token))) break;
    if (!(await startSession(c, email, r.name || email.split('@')[0]))) {
      return c.json({ error: 'That account was deleted. Email the club if that was a mistake.' }, 403);
    }
    return c.json({ ok: true });
  }

  // A wrong guess spends one try on every live code for the address.
  await db.prepare('UPDATE login_tokens SET tries = tries + 1 WHERE email = ? AND used = 0').bind(email).run();
  if (rows.every((r) => r.tries + 1 >= codeTries)) {
    return c.json({ error: 'Too many wrong codes. Send a new email and use that code.', expired: true }, 400);
  }
  return c.json({ error: 'That code does not match. Check the newest email from the club.' }, 400);
});

usersRouter.get('/auth/verify', async (c) => {
  const db = c.env.DB;
  const token = c.req.query('t') ?? '';
  const row = token
    ? await db.prepare('SELECT * FROM login_tokens WHERE token = ? AND used = 0').bind(token).first()
    : null;

  if (!row || Date.now() - row.created_at > LINK_TTL_MS || !(await claim(db, token))) {
    return c.html(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link expired</title>
       <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
       <h1 style="font-size:1.25rem">That link did not work</h1>
       <p>It may have expired or already been used. <a href="/signin">Send a new one</a>.</p></body>`,
      400
    );
  }

  if (!(await startSession(c, row.email, row.name || row.email.split('@')[0]))) return c.redirect('/signin');
  return c.redirect('/');
});

/** Signs this account out on every device: older cookies no longer match the version. */
usersRouter.post('/auth/logout', async (c) => {
  const user = await currentUser(c);
  if (user) await c.env.DB.prepare('UPDATE users SET session_ver = session_ver + 1 WHERE id = ?').bind(user.id).run();
  deleteCookie(c, USER_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
