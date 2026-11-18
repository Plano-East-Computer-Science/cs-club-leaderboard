/**
 * Student accounts: a magic link sent to a personal address, then a signed
 * cookie. No passwords exist, so none can leak or be reused.
 *
 * The cookie (`cslb_user`) carries the user id, an expiry and the account's
 * session version. Signing out bumps the version, which ends every session of
 * that account at once (a copied cookie stops working too). An account with role
 * officer or lead also passes the officer guard (see team.js), which reads the
 * role fresh from this table on every request.
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

import { signValue, verifyValue, randomToken, DISTRICT_DOMAIN } from '../auth.js';
import { sendEmail, emailEnabled, esc } from '../email.js';
import { hitOrRefuse, clientIp } from './ratelimit.js';

export const USER_COOKIE = 'cslb_user';
const SESSION_MS = 1000 * 60 * 60 * 24 * 60; // 60 days
const LINK_TTL_MS = 1000 * 60 * 15;
const LINK_COOLDOWN_MS = 1000 * 45;

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
  // This route emails an address the caller typed, so it is a mail cannon unless capped per source.
  if (await hitOrRefuse(db, `signin:${clientIp(c)}`, 8, 15 * 60_000)) {
    return c.json({ error: 'Too many sign-in requests. Wait a few minutes and try again.' }, 429);
  }
  const existing = await db.prepare('SELECT id, name, deleted_at FROM users WHERE email = ?').bind(email).first();
  if (existing?.deleted_at) return c.json({ error: 'That account was deleted. Email the club if that was a mistake.' }, 403);
  if (!existing && name.length < 2) {
    return c.json({ error: 'First time here? Add a display name too.', needName: true }, 400);
  }

  // Same reply whether or not the address is known, and one link per cooldown.
  const last = await db
    .prepare('SELECT MAX(created_at) AS t FROM login_tokens WHERE email = ?')
    .bind(email)
    .first();
  if (last?.t && Date.now() - last.t < LINK_COOLDOWN_MS) return c.json({ ok: true, cooldown: true });

  const token = randomToken(24);
  await db
    .prepare('INSERT INTO login_tokens (token, email, name, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, email, existing?.name ?? name, Date.now())
    .run();

  const origin = new URL(c.req.url).origin;
  const link = `${origin}/api/auth/verify?t=${token}`;

  // Local development only: hand the link back instead of emailing it.
  // DEV_LOGIN is set in .dev.vars and never exists in production.
  if (c.env.DEV_LOGIN === '1') return c.json({ ok: true, devLink: link });

  if (!emailEnabled(c.env)) return c.json({ error: 'Email is not switched on yet. Ask an officer.' }, 503);
  const sent = await sendEmail(c.env, {
    to: email,
    subject: 'Your CS Club sign-in link',
    text: `Click to sign in to the Plano East CS Club site (valid 15 minutes, one use):\n\n${link}\n\nIf you did not ask for this, ignore it.`,
    html: `<p>Click to sign in to the Plano East CS Club site. It works once and expires in 15 minutes.</p>
           <p><a href="${esc(link)}">${esc(link)}</a></p>
           <p style="color:#6b7689">If you did not ask for this, ignore it.</p>`,
  });
  if (!sent.ok) return c.json({ error: `Could not send the link: ${sent.error}` }, 502);
  return c.json({ ok: true });
});

usersRouter.get('/auth/verify', async (c) => {
  const db = c.env.DB;
  const token = c.req.query('t') ?? '';
  const row = token
    ? await db.prepare('SELECT * FROM login_tokens WHERE token = ? AND used = 0').bind(token).first()
    : null;

  if (!row || Date.now() - row.created_at > LINK_TTL_MS) {
    return c.html(
      `<!doctype html><meta charset="utf-8"><title>Link expired</title>
       <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
       <h1 style="font-size:1.25rem">That link did not work</h1>
       <p>It may have expired or already been used. <a href="/signin">Request a new one</a>.</p></body>`,
      400
    );
  }

  await db.prepare('UPDATE login_tokens SET used = 1 WHERE token = ?').bind(token).run();
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
