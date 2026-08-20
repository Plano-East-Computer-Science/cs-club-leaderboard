/**
 * Admin authentication.
 *
 * One shared password, stored as a Cloudflare Worker secret (ADMIN_PASSWORD).
 * On success we hand back a signed, httpOnly cookie. The cookie is signed with
 * SESSION_SECRET so it cannot be forged, and the password itself never reaches
 * the browser.
 *
 * Workers have no node:crypto, so this uses the Web Crypto API. Everything is
 * async as a result.
 */

export const COOKIE = 'cslb_admin';
const MAX_AGE_S = 60 * 60 * 24 * 14; // two weeks

const enc = new TextEncoder();

function secretOf(env) {
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || 'dev-only-insecure-secret';
}

/**
 * Compares two strings without leaking their contents through timing.
 * Length is compared first because it is not secret -- the password length
 * being observable is not a meaningful leak, and the alternative is worse.
 */
export function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function hmac(env, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretOf(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function checkPassword(env, password) {
  const expected = env.ADMIN_PASSWORD;
  // With no password configured, refuse everything rather than fall open.
  if (!expected) return false;
  return safeEqual(password ?? '', expected);
}

export async function signSession(env, expiresAt = Date.now() + MAX_AGE_S * 1000) {
  const payload = String(expiresAt);
  return `${payload}.${await hmac(env, payload)}`;
}

export async function verifySession(env, token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, await hmac(env, payload))) return false;
  return Number(payload) > Date.now();
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: true,
    path: '/',
    maxAge: MAX_AGE_S,
  };
}

/**
 * Shared secret used by the GitHub Action that pushes scraped opportunities in.
 * Separate from the admin password so the workflow never needs it.
 */
export function checkIngestToken(env, header) {
  const expected = env.INGEST_TOKEN;
  if (!expected) return false;
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  return safeEqual(token, expected);
}
