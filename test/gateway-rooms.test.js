/**
 * H1: the session-scoped gateway. The preset rules (pure), then the routes:
 * opening a room mints its code, only checked-in members of an open room see
 * it, the host's presets decide which hosts the code reaches (never past the
 * approved list), and closing the room ends it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue, signSession, COOKIE } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';
import { DEFAULT_HOSTS, PRESETS, cleanChoice, defaultPresets, presetsFrom, roomHosts } from '../worker/hub/gateway.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

/* --------------------------------- pure rules --------------------------------- */

await check('the presets cover exactly the approved list, and nothing new is on', () => {
  const all = PRESETS.flatMap((p) => p.hosts);
  assert.deepEqual([...new Set(all)].sort(), [...DEFAULT_HOSTS].sort(), 'no preset adds an unapproved host');
  assert.equal(all.length, new Set(all).size, 'a host is in one preset only');
  assert.deepEqual(PRESETS.find((p) => p.id === 'practice').hosts, []);
  assert.deepEqual(PRESETS.find((p) => p.id === 'data').hosts, []);
});

await check('contest nights start with search and tutorials off', () => {
  assert.deepEqual(defaultPresets('build'), ['docs', 'search', 'tutorials']);
  assert.deepEqual(defaultPresets('duel'), ['docs']);
  assert.deepEqual(defaultPresets('mock'), ['docs']);
});

await check('a room reaches its presets, never past the approved list', () => {
  const approved = DEFAULT_HOSTS.filter((h) => h !== 'stackoverflow.com');
  const hosts = roomHosts(PRESETS, ['search'], approved);
  assert.ok(hosts.includes('github.com'), 'the fixed preset is always on');
  assert.ok(hosts.includes('www.bing.com'));
  assert.ok(!hosts.includes('stackoverflow.com'), 'removed from the approved list, so off even though its preset is on');
  assert.ok(!hosts.includes('docs.python.org'), 'docs not chosen');
  const edited = presetsFrom(JSON.stringify({ practice: ['evil.example.com'] }));
  assert.ok(!roomHosts(edited, ['practice'], DEFAULT_HOSTS).includes('evil.example.com'), 'an edit cannot reach past the approved list');
});

await check('preset edits and choices are cleaned', () => {
  assert.deepEqual(presetsFrom('not json'), PRESETS);
  assert.deepEqual(presetsFrom(JSON.stringify({ github: [] })).find((p) => p.id === 'github').hosts, PRESETS[0].hosts, 'the fixed preset is not editable');
  assert.deepEqual(cleanChoice(['docs', 'github', 'nope', 'docs', 3]), ['docs']);
  assert.deepEqual(cleanChoice('docs'), []);
});

/* ----------------------------------- routes ----------------------------------- */

const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(path, { cookie, method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(`https://club.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* an HTML page */
  }
  return { status: res.status, body: json, text };
}
const officer = `${COOKIE}=${await signSession(env)}`;
const memberOf = async (email, name) => {
  const id = (await db.prepare(`INSERT INTO users (email, name, role) VALUES (?, ?, 'member')`).bind(email, name).run()).meta.last_row_id;
  return { id, cookie: `${USER_COOKIE}=${await signValue(env, `${id}:${Date.now() + 60_000}`)}` };
};
const mia = await memberOf('mia@example.com', 'Mia');
const ned = await memberOf('ned@example.com', 'Ned'); // never checks in

// Upstream fetches are faked: the gateway must never need the network in a test.
const realFetch = globalThis.fetch;
const fetched = [];
globalThis.fetch = async (url) => {
  fetched.push(String(url));
  return new Response('upstream ok', { status: 200, headers: { 'content-type': 'text/plain' } });
};

let room;
let gwCode;
await check('opening a room mints its own code with the template defaults', async () => {
  const r = await call('/api/admin/hub/rooms', { method: 'POST', cookie: officer, body: { title: 'Duels', template: 'duel' } });
  assert.equal(r.status, 200);
  room = r.body.code;
  const gw = await call(`/api/admin/hub/rooms/${room}/gateway`, { cookie: officer });
  assert.equal(gw.status, 200);
  assert.ok(gw.body.active);
  gwCode = gw.body.code;
  assert.deepEqual(gw.body.presets.filter((p) => p.on).map((p) => p.id), ['github', 'docs']);
});

await check('only checked-in members of the open room see the code', async () => {
  assert.equal((await call(`/api/rooms/${room}/gateway`)).status, 401);
  assert.equal((await call(`/api/rooms/${room}/gateway`, { cookie: mia.cookie })).body.gateway, null, 'not checked in yet');
  assert.equal((await call('/api/gateway/mine', { cookie: mia.cookie })).body.gateway, null);
  await db.prepare('INSERT INTO room_checkins (code, user_id) VALUES (?, ?)').bind(room, mia.id).run();
  const mine = await call('/api/gateway/mine', { cookie: mia.cookie });
  assert.equal(mine.body.gateway.code, gwCode);
  assert.equal(mine.body.gateway.room, room);
  assert.equal((await call('/api/gateway/mine', { cookie: ned.cookie })).body.gateway, null);
  assert.equal((await call('/api/gateway/mine')).body.gateway, null);
});

await check('the code reaches only what is turned on for this meeting', async () => {
  const off = await call(`/gw/${gwCode}/stackoverflow.com/questions`);
  assert.equal(off.status, 403);
  assert.match(off.text, /not turned on for this meeting/);
  const on = await call(`/gw/${gwCode}/docs.python.org/3/`);
  assert.equal(on.status, 200);
  assert.equal(fetched.at(-1), 'https://docs.python.org/3/');
  const check = await call(`/api/gateway/check?code=${gwCode}`);
  assert.ok(check.body.hosts.includes('docs.python.org') && !check.body.hosts.includes('www.bing.com'));
});

await check('the host toggles presets; members and students cannot', async () => {
  assert.equal((await call(`/api/admin/hub/rooms/${room}/gateway`, { method: 'PUT', cookie: mia.cookie, body: { presets: ['search'] } })).status, 401);
  const r = await call(`/api/admin/hub/rooms/${room}/gateway`, { method: 'PUT', cookie: officer, body: { presets: ['search', 'github', 'bogus'] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.presets.filter((p) => p.on).map((p) => p.id), ['github', 'search']);
  assert.equal((await call(`/gw/${gwCode}/stackoverflow.com/questions`)).status, 200);
  assert.equal((await call(`/gw/${gwCode}/docs.python.org/3/`)).status, 403);
  const paused = await call(`/api/admin/hub/rooms/${room}/gateway`, { method: 'PUT', cookie: officer, body: { on: false } });
  assert.equal(paused.body.active, false);
  assert.equal((await call(`/gw/${gwCode}/github.com/`)).status, 403);
  assert.equal((await call('/api/gateway/mine', { cookie: mia.cookie })).body.gateway, null, 'a paused gateway is not handed out');
  await call(`/api/admin/hub/rooms/${room}/gateway`, { method: 'PUT', cookie: officer, body: { on: true } });
  assert.equal((await call(`/gw/${gwCode}/github.com/`)).status, 200);
});

await check('officers edit presets only with approved hosts', async () => {
  const P = '/api/admin/hub/gateway/presets';
  assert.equal((await call(`${P}/practice`, { method: 'PUT', cookie: mia.cookie, body: { hosts: 'cses.fi' } })).status, 401);
  const bad = await call(`${P}/practice`, { method: 'PUT', cookie: officer, body: { hosts: 'cses.fi' } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /approved list first/);
  assert.equal((await call(`${P}/github`, { method: 'PUT', cookie: officer, body: { hosts: '' } })).status, 400, 'the fixed preset is not editable');
  const ok = await call(`${P}/practice`, { method: 'PUT', cookie: officer, body: { hosts: 'cp-algorithms.com' } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.presets.find((p) => p.id === 'practice').hosts, ['cp-algorithms.com']);
});

await check('closing the room ends its gateway', async () => {
  await call(`/api/admin/hub/rooms/${room}/close`, { method: 'POST', cookie: officer });
  assert.equal((await call(`/gw/${gwCode}/github.com/`)).status, 403);
  assert.equal((await call('/api/gateway/mine', { cookie: mia.cookie })).body.gateway, null);
  assert.equal((await call(`/api/admin/hub/rooms/${room}/gateway`, { method: 'PUT', cookie: officer, body: { on: true } })).status, 410, 'cannot turn on for a closed room');
});

await check('an officer-minted code still reaches the whole approved list', async () => {
  const r = await call('/api/admin/hub/gateway', { method: 'POST', cookie: officer, body: { label: 'Hack night', hours: 1 } });
  assert.equal((await call(`/gw/${r.body.code}/stackoverflow.com/x`)).status, 200);
  assert.equal((await call(`/gw/${r.body.code}/evil.example.com/`)).status, 403);
});

globalThis.fetch = realFetch;
console.log(`gateway rooms: ${passed} checks passed`);
