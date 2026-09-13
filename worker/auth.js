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
/**
 * Members get their own cookie, never the admin one. An officer signing in as
 * an admin does not become a member, and a member must never become an admin
 * by having the two conflated.
 */
export const MEMBER_COOKIE = 'cslb_member';

const MAX_AGE_S = 60 * 60 * 24 * 14; // two weeks
const MEMBER_MAX_AGE_S = 60 * 60 * 24 * 30; // a month; students sign in rarely

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

/**
 * Signs an arbitrary payload. The payload must not contain a "." -- that is
 * the separator between payload and signature.
 */
export async function signValue(env, payload) {
  return `${payload}.${await hmac(env, payload)}`;
}

/** Returns the payload when the signature is good, otherwise null. */
export async function verifyValue(env, token) {
  if (!token || typeof token !== 'string') return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!safeEqual(sig, await hmac(env, payload))) return null;
  return payload;
}

export async function signSession(env, expiresAt = Date.now() + MAX_AGE_S * 1000) {
  return signValue(env, String(expiresAt));
}

export async function verifySession(env, token) {
  const payload = await verifyValue(env, token);
  if (payload === null) return false;
  return Number(payload) > Date.now();
}

/* ------------------------------ member sessions ---------------------------- */

/**
 * A member session carries who it is, not just when it expires, so the server
 * can look the member up without trusting anything the browser sends.
 * Payload shape: "<memberId>:<expiresAtMs>".
 */
export async function signMemberSession(
  env,
  memberId,
  expiresAt = Date.now() + MEMBER_MAX_AGE_S * 1000
) {
  return signValue(env, `${memberId}:${expiresAt}`);
}

/** Returns the member id when the session is valid and unexpired, else null. */
export async function verifyMemberSession(env, token) {
  const payload = await verifyValue(env, token);
  if (payload === null) return null;
  const [rawId, rawExp] = payload.split(':');
  const id = Number(rawId);
  const exp = Number(rawExp);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(exp)) return null;
  if (exp <= Date.now()) return null;
  return id;
}

export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: true,
    path: '/',
    maxAge: MEMBER_MAX_AGE_S,
  };
}

/** Random, URL-safe, unguessable. Used for unsubscribe and calendar-feed keys. */
export function randomToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The only place the district-domain rule is expressed.
 *
 * Compared against the VERIFIED `hd` claim from Google's ID token, never
 * against a string the browser supplied. Matching on the email's suffix alone
 * would accept `someone@notmypisd.net`, so the check is exact.
 */
export const DISTRICT_DOMAIN = 'mypisd.net';

export function isDistrictDomain(hd) {
  return typeof hd === 'string' && hd.toLowerCase() === DISTRICT_DOMAIN;
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
