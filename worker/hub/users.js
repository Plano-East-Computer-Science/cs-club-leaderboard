/**
 * Student accounts: a magic link sent to a personal address, then a signed
 * cookie. No passwords exist, so none can leak or be reused.
 *
 * The cookie (`cslb_user`) carries only the user id. An account with role
 * officer or lead also passes the officer guard (see team.js), which reads the
 * role fresh from this table on every request.
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

import { signValue, verifyValue, randomToken, DISTRICT_DOMAIN } from '../auth.js';
import { sendEmail, emailEnabled, esc } from '../email.js';

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
  const [id, exp] = payload.split(':').map(Number);
  if (!id || !(exp > Date.now())) return null;
  return c.env.DB.prepare('SELECT id, email, name, student_id, role, created_at FROM users WHERE id = ?')
    .bind(id)
    .first();
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
  await db
    .prepare(
      `INSERT INTO users (email, name, last_seen) VALUES (?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET last_seen = datetime('now')`
    )
    .bind(email, name)
    .run();
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  setCookie(c, USER_COOKIE, await signValue(c.env, `${user.id}:${Date.now() + SESSION_MS}`), cookieOpts(c));
  return user.id;
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

usersRouter.get('/me', async (c) => {
  const user = await currentUser(c);
  return c.json({ user });
});

usersRouter.patch('/me', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = cleanName(body?.name);
  if (name.length < 2) return c.json({ error: 'Pick a name of at least 2 characters.' }, 400);
  await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, c.get('user').id).run();
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
  const existing = await db.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first();
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
  await startSession(c, row.email, row.name || row.email.split('@')[0]);
  return c.redirect('/');
});

usersRouter.post('/auth/logout', (c) => {
  deleteCookie(c, USER_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
