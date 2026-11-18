/**
 * Sign in with Google. The browser gets an ID token from Google's own button
 * and posts it here; we check Google's signature on it and start the same
 * session a magic link would. No password or Google secret is stored: the only
 * setting is the public client id (GOOGLE_CLIENT_ID).
 */
import { Hono } from 'hono';

import { startSession } from './users.js';

export const googleRouter = new Hono();

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

let cache = { keys: null, at: 0 };
async function googleKeys() {
  if (cache.keys && Date.now() - cache.at < 3_600_000) return cache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error('Could not reach Google.');
  cache = { keys: (await res.json()).keys, at: Date.now() };
  return cache.keys;
}

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
const json = (part) => JSON.parse(new TextDecoder().decode(b64url(part)));

/** -> the token's claims when it is a genuine, current Google token for this site, else null. */
export async function verifyGoogleIdToken(token, clientId, { keys, now = Date.now() } = {}) {
  try {
    const [h, p, s] = String(token ?? '').split('.');
    if (!h || !p || !s || !clientId) return null;
    const header = json(h);
    if (header.alg !== 'RS256') return null;
    const jwk = (keys ?? (await googleKeys())).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const claims = json(p);
    if (claims.aud !== clientId || !ISSUERS.includes(claims.iss)) return null;
    if (!(claims.exp * 1000 > now) || !claims.email || claims.email_verified !== true) return null;
    return claims;
  } catch {
    return null;
  }
}

/** What the sign-in page needs to know before drawing itself. */
googleRouter.get('/auth/config', (c) => c.json({ googleClientId: c.env.GOOGLE_CLIENT_ID || null }));

googleRouter.post('/auth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: 'Google sign-in is not switched on.' }, 503);
  const body = await c.req.json().catch(() => ({}));
  const claims = await verifyGoogleIdToken(body?.credential, clientId);
  if (!claims) return c.json({ error: 'Google did not confirm that sign-in. Try again.' }, 401);

  const email = String(claims.email).toLowerCase();
  const name = String(claims.name || email.split('@')[0]).replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!(await startSession(c, email, name))) return c.json({ error: 'That account was deleted. Email the club if that was a mistake.' }, 403);
  return c.json({ ok: true });
});
