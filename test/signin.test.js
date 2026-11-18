/**
 * Email sign-in: caps sized for a classroom behind one school IP, the 6-digit
 * code that finishes sign-in on the device that asked, its brute-force cap, and
 * the link and code expiring together. Routes run through the real Worker on
 * the fake D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { USER_COOKIE, SIGNIN_LIMITS } from '../worker/hub/users.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { SESSION_SECRET: 'test-secret', DEV_LOGIN: '1', DB: makeTestDb(SCHEMA) };
const db = env.DB;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

async function call(path, { method = 'GET', body, ip = '1.1.1.1', cookie } = {}) {
  const headers = { 'cf-connecting-ip': ip };
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const url = path.startsWith('http') ? path : `https://club.test/api${path}`;
  const res = await worker.fetch(new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }), env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  const set = res.headers.get('set-cookie') ?? '';
  const userCookie = set.match(new RegExp(`${USER_COOKIE}=([^;]+)`))?.[1];
  return { status: res.status, body: json, cookie: userCookie ? `${USER_COOKIE}=${userCookie}` : null };
}

const request = (email, opts = {}) => call('/auth/request', { method: 'POST', body: { email, name: 'Test Kid' }, ...opts });
const enterCode = (email, code, opts = {}) => call('/auth/code', { method: 'POST', body: { email, code }, ...opts });
/** Moves an address's emails back in time, past the resend cooldown (or further). */
const age = (email, ms = SIGNIN_LIMITS.cooldownMs + 1) =>
  db.prepare('UPDATE login_tokens SET created_at = created_at - ? WHERE email = ?').bind(ms, email).run();
const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

/* ------------------------------ shared school IP ------------------------------ */

await check('a classroom of 40 on one IP, each asking twice, all get their email', async () => {
  for (let i = 0; i < 40; i++) {
    const email = `kid${i}@example.org`;
    assert.equal((await request(email, { ip: '10.0.0.1' })).status, 200, `first ask ${i}`);
    await age(email);
    assert.equal((await request(email, { ip: '10.0.0.1' })).status, 200, `resend ${i}`);
  }
});

await check('a new address without a name does not spend the network quota', async () => {
  const before = (await db.prepare(`SELECT COUNT(*) AS n FROM rate_hits WHERE key = 'signin:10.0.0.1'`).first()).n;
  const r = await call('/auth/request', { method: 'POST', body: { email: 'newbie@example.org' }, ip: '10.0.0.1' });
  assert.equal(r.status, 400);
  assert.equal(r.body.needName, true);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM rate_hits WHERE key = 'signin:10.0.0.1'`).first()).n, before);
});

await check('asking again inside the cooldown sends nothing, counts nothing, and says when to retry', async () => {
  const email = 'quick@example.org';
  assert.equal((await request(email, { ip: '10.0.0.2' })).status, 200);
  const again = await request(email, { ip: '10.0.0.2' });
  assert.equal(again.status, 200);
  assert.equal(again.body.cooldown, true);
  assert.ok(again.body.retryIn > 0 && again.body.retryIn <= SIGNIN_LIMITS.cooldownMs / 1000);
  assert.equal(again.body.devCode, undefined, 'no new code');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM login_tokens WHERE email = ?').bind(email).first()).n, 1);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM rate_hits WHERE key = 'signin:10.0.0.2'`).first()).n, 1);
});

await check('one IP is still capped, with a friendly message, and other networks are not', async () => {
  const { limit } = SIGNIN_LIMITS.perIp;
  let last;
  for (let i = 0; i <= limit; i++) last = await request(`cannon${i}@example.org`, { ip: '6.6.6.6' });
  assert.equal(last.status, 429);
  assert.match(last.body.error, /a few minutes/);
  assert.equal((await request('elsewhere@example.org', { ip: '6.6.6.7' })).status, 200);
});

await check('one address is capped no matter how many networks ask for it', async () => {
  const email = 'target@example.org';
  const { limit } = SIGNIN_LIMITS.perEmail;
  for (let i = 0; i < limit; i++) {
    assert.equal((await request(email, { ip: `20.0.0.${i}` })).status, 200, `email ${i}`);
    await age(email);
  }
  const r = await request(email, { ip: '20.0.1.1' });
  assert.equal(r.status, 429);
  assert.match(r.body.error, /newest one/);
});

/* --------------------------------- the code --------------------------------- */

await check('the code signs in the device that asked, and only once', async () => {
  const email = 'laptop@example.org';
  const { devCode } = (await request(email, { ip: '30.0.0.1' })).body;
  assert.match(devCode, /^\d{6}$/);
  const row = await db.prepare('SELECT code_hash FROM login_tokens WHERE email = ?').bind(email).first();
  assert.ok(row.code_hash && !row.code_hash.includes(devCode), 'stored hashed, not in the clear');

  const ok = await enterCode(email, `${devCode.slice(0, 3)} ${devCode.slice(3)}`); // spaces are forgiven
  assert.equal(ok.status, 200);
  assert.ok(ok.cookie, 'session cookie set');
  const me = (await call('/me', { cookie: ok.cookie })).body.user;
  assert.equal(me.email, email);
  assert.equal(me.name, 'Test Kid');

  const again = await enterCode(email, devCode);
  assert.equal(again.status, 400);
  assert.equal(again.body.expired, true);
});

await check('using the code spends the link in the same email', async () => {
  const email = 'both@example.org';
  const { devCode, devLink } = (await request(email, { ip: '30.0.0.2' })).body;
  assert.equal((await enterCode(email, devCode)).status, 200);
  assert.equal((await call(devLink)).status, 400);
});

await check('the link still signs in, and then the code is spent', async () => {
  const email = 'phone@example.org';
  const { devCode, devLink } = (await request(email, { ip: '30.0.0.3' })).body;
  const r = await call(devLink);
  assert.equal(r.status, 302);
  assert.ok(r.cookie);
  assert.equal((await enterCode(email, devCode)).status, 400);
});

await check('the code from an earlier email still works after a resend', async () => {
  const email = 'resend@example.org';
  const first = (await request(email, { ip: '30.0.0.4' })).body.devCode;
  await age(email);
  const second = (await request(email, { ip: '30.0.0.4' })).body.devCode;
  assert.notEqual(first, undefined);
  assert.notEqual(second, undefined);
  assert.equal((await enterCode(email, first)).status, 200);
});

await check('five wrong guesses kill the code, even for the right one after', async () => {
  const email = 'guess@example.org';
  const { devCode } = (await request(email, { ip: '30.0.0.5' })).body;
  for (let i = 0; i < SIGNIN_LIMITS.codeTries - 1; i++) {
    const r = await enterCode(email, wrong(devCode));
    assert.equal(r.status, 400);
    assert.equal(r.body.expired, undefined, `try ${i} still alive`);
  }
  const last = await enterCode(email, wrong(devCode));
  assert.equal(last.body.expired, true, 'last try says to send a new one');
  const right = await enterCode(email, devCode);
  assert.equal(right.status, 400);
  assert.equal(right.cookie, null);
});

await check('a code for one address does not sign in another', async () => {
  const { devCode } = (await request('mine@example.org', { ip: '30.0.0.6' })).body;
  await request('theirs@example.org', { ip: '30.0.0.6' });
  const r = await enterCode('theirs@example.org', devCode);
  assert.equal(r.status, 400);
  assert.equal(r.cookie, null);
});

await check('link and code expire together after 15 minutes', async () => {
  const email = 'late@example.org';
  const { devCode, devLink } = (await request(email, { ip: '30.0.0.7' })).body;
  await age(email, SIGNIN_LIMITS.ttlMs + 1000);
  const r = await enterCode(email, devCode);
  assert.equal(r.status, 400);
  assert.equal(r.body.expired, true);
  assert.equal((await call(devLink)).status, 400);
});

await check('malformed codes are refused without spending a try', async () => {
  const email = 'typo@example.org';
  await request(email, { ip: '30.0.0.8' });
  assert.equal((await enterCode(email, '12345')).status, 400);
  assert.equal((await enterCode(email, 'abcdef')).status, 400);
  assert.equal((await db.prepare('SELECT tries FROM login_tokens WHERE email = ?').bind(email).first()).tries, 0);
});

console.log(`signin: ${passed} checks passed`);
