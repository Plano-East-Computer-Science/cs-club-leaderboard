/**
 * Sliding-window rate limits kept in D1 (table `rate_hits`), so they hold
 * across Worker isolates without KV or a Durable Object. A "hit" is one row;
 * the limit is the number of rows for a key inside the window.
 *
 * Callers decide what counts: the officer password records only failures,
 * the sign-in link and report routes record every request.
 */

/** Real client address behind Cloudflare; a fixed label when there is none (local dev, tests). */
export const clientIp = (c) => c.req.header('cf-connecting-ip') || 'local';

/** Is this key already at its limit? Also prunes that key's expired rows. */
export async function limited(db, key, limit, windowMs, now = Date.now()) {
  await db.prepare('DELETE FROM rate_hits WHERE key = ? AND ts < ?').bind(key, now - windowMs).run();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?').bind(key).first();
  return row.n >= limit;
}

export const recordHit = (db, key, now = Date.now()) =>
  db.prepare('INSERT INTO rate_hits (key, ts) VALUES (?, ?)').bind(key, now).run();

/** Check then count in one step. true = refused (and not counted). */
export async function hitOrRefuse(db, key, limit, windowMs, now = Date.now()) {
  if (await limited(db, key, limit, windowMs, now)) return true;
  await recordHit(db, key, now);
  return false;
}

/** Short salted hash of an address, for logs: shows "same source" without storing the address. */
export async function ipTag(env, ip) {
  const data = new TextEncoder().encode(`${env.SESSION_SECRET || 'x'}:${ip}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...hash.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Housekeeping for the cron: nothing is kept past a day. */
export const pruneHits = (db, now = Date.now()) => db.prepare('DELETE FROM rate_hits WHERE ts < ?').bind(now - 86_400_000).run();
