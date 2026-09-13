/**
 * Member sign-in, via Google, restricted to the district's Google Workspace.
 *
 * Why Google and not an emailed link: a magic link only works if Plano ISD's
 * mail filter accepts an unknown external sender writing to a student account,
 * which districts routinely block. Google Sign-In has no delivery step to
 * fail, is one click on a school Chromebook, and the `hd` claim is stronger
 * evidence of district membership than possession of an inbox.
 *
 * The domain check is done SERVER-SIDE against the verified `hd` claim in
 * Google's ID token. Nothing the browser sends is trusted for identity.
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

import {
  getMemberById, upsertMember, setMemberPrefs, unsubscribeByToken,
} from '../db.js';
import {
  MEMBER_COOKIE, signMemberSession, verifyMemberSession, memberCookieOptions,
  randomToken, isDistrictDomain, DISTRICT_DOMAIN,
} from '../auth.js';

export const authRouter = new Hono();

const STATE_COOKIE = 'cslb_oauth_state';
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

const redirectUri = (c) => new URL('/api/auth/callback', c.req.url).toString();

/* -------------------------------- current user ------------------------------ */

/** Resolves the signed-in member from the cookie, or null. */
export async function currentMember(c) {
  const id = await verifyMemberSession(c.env, getCookie(c, MEMBER_COOKIE));
  if (!id) return null;
  return getMemberById(c.env.DB, id);
}

/** Middleware for anything only signed-in district members may read. */
export async function requireMember(c, next) {
  const member = await currentMember(c);
  if (!member) {
    return c.json({ error: 'Sign in with your school Google account to view this.' }, 401);
  }
  c.set('member', member);
  return next();
}

/* ---------------------------------- sign in --------------------------------- */

authRouter.get('/start', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: 'Google sign-in is not configured yet.' }, 503);
  }

  // CSRF: the state we send must come back unchanged, and it is signed into an
  // httpOnly cookie the page itself cannot read or forge.
  const state = randomToken(16);
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true, sameSite: 'Lax', secure: true, path: '/', maxAge: 600,
  });

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(c));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // A hint to Google's account chooser. It is NOT a security control -- the
  // real check is the hd claim below, because hd here can be tampered with.
  url.searchParams.set('hd', DISTRICT_DOMAIN);
  return c.redirect(url.toString());
});

authRouter.get('/callback', async (c) => {
  const { code, state } = c.req.query();
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: '/' });

  if (!code || !state || !expected || state !== expected) {
    return c.redirect('/signin?error=state');
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.redirect('/signin?error=unconfigured');

  let claims;
  try {
    const res = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(c),
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) return c.redirect('/signin?error=exchange');
    const token = await res.json();
    claims = decodeIdToken(token.id_token);
  } catch {
    return c.redirect('/signin?error=exchange');
  }

  if (!claims) return c.redirect('/signin?error=token');

  // The two checks that actually gate access.
  if (!claims.email_verified) return c.redirect('/signin?error=unverified');
  if (!isDistrictDomain(claims.hd)) return c.redirect('/signin?error=domain');

  const member = await upsertMember(c.env.DB, {
    school_email: claims.email,
    full_name: claims.name ?? '',
    tokenFactory: randomToken,
  });

  setCookie(c, MEMBER_COOKIE, await signMemberSession(c.env, member.id), memberCookieOptions());
  return c.redirect('/');
});

/**
 * Reads the ID token's claims.
 *
 * The signature is NOT verified here, and does not need to be: the token came
 * straight from Google's token endpoint over TLS in a request we initiated
 * with our own client secret, which is exactly the case where Google's own
 * documentation permits skipping local validation. A token arriving any other
 * way must never be trusted this way.
 */
function decodeIdToken(idToken) {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/* ------------------------------ local testing only -------------------------- */

/**
 * Mints a member session without Google, so gating can be tested before the
 * OAuth client exists.
 *
 * Gated on DEV_LOGIN_SECRET, which lives only in .dev.vars (gitignored) and is
 * never set in production -- production secrets are added one at a time with
 * `wrangler secret put`, and this one never will be. With the variable absent
 * the route 404s, so it does not exist as far as the live site is concerned.
 */
authRouter.post('/dev-login', async (c) => {
  const secret = c.env.DEV_LOGIN_SECRET;
  if (!secret) return c.json({ error: 'No such endpoint.' }, 404);

  const body = await c.req.json().catch(() => ({}));
  if (body?.secret !== secret) return c.json({ error: 'No such endpoint.' }, 404);

  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email.endsWith(`@${DISTRICT_DOMAIN}`)) {
    return c.json({ error: `Use an @${DISTRICT_DOMAIN} address.` }, 400);
  }

  const member = await upsertMember(c.env.DB, {
    school_email: email,
    full_name: body?.name ?? '',
    tokenFactory: randomToken,
  });
  setCookie(c, MEMBER_COOKIE, await signMemberSession(c.env, member.id), memberCookieOptions());
  return c.json({ ok: true, member: publicMember(member) });
});

/* --------------------------------- session ---------------------------------- */

authRouter.post('/logout', (c) => {
  deleteCookie(c, MEMBER_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

/** Shape handed to the browser. Never includes the unsubscribe token. */
function publicMember(m) {
  return {
    id: m.id,
    school_email: m.school_email,
    full_name: m.full_name,
    personal_email: m.personal_email,
    email_opt_in: Boolean(m.email_opt_in),
    student_id: m.student_id,
    feed_token: m.feed_token,
  };
}

authRouter.get('/me', async (c) => {
  const member = await currentMember(c);
  return c.json({
    authed: Boolean(member),
    configured: Boolean(c.env.GOOGLE_CLIENT_ID),
    // Tells the sign-in page whether to offer the local-only form. False in
    // production, where DEV_LOGIN_SECRET is never set.
    dev_login: Boolean(c.env.DEV_LOGIN_SECRET),
    member: member ? publicMember(member) : null,
  });
});

authRouter.put('/prefs', async (c) => {
  const member = await currentMember(c);
  if (!member) return c.json({ error: 'Not signed in.' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const personal = String(body?.personal_email ?? '').trim();
  const optIn = Boolean(body?.email_opt_in);

  if (personal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(personal)) {
    return c.json({ error: "That does not look like an email address." }, 400);
  }
  if (optIn && !personal) {
    return c.json({ error: 'Add a personal email address to receive updates.' }, 400);
  }
  // Club mail must not go to a school inbox: the district filters external
  // senders, so it would silently vanish.
  if (personal.toLowerCase().endsWith(`@${DISTRICT_DOMAIN}`)) {
    return c.json(
      { error: 'Use a personal address (Gmail, Outlook). School mail filters block club email.' },
      400
    );
  }

  await setMemberPrefs(c.env.DB, member.id, { personal_email: personal, email_opt_in: optIn });
  return c.json({ ok: true });
});

/* ------------------------------- unsubscribe -------------------------------- */

/** No login required, one click -- what a mail client's unsubscribe expects. */
authRouter.all('/unsubscribe', async (c) => {
  const token = c.req.query('t');
  if (token) await unsubscribeByToken(c.env.DB, token);
  return c.html(
    `<!doctype html><meta charset="utf-8">
     <title>Unsubscribed</title>
     <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
       <h1 style="font-size:1.25rem">Unsubscribed</h1>
       <p>You will not get any more club email. Your points and profile are unchanged.</p>
       <p><a href="/">Back to the site</a></p>
     </body>`
  );
});
