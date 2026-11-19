/**
 * Wave 4 app shell: the Live pill reads GET /api/me/live. Members only (the
 * code checks you in), null when nothing is open, and the same room Today shows.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import worker from '../worker/index.js';
import { signValue } from '../worker/auth.js';
import { USER_COOKIE } from '../worker/hub/users.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const env = { ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'test-secret', DB: makeTestDb(SCHEMA) };
const db = env.DB;

const call = async (path, cookie) => {
  const res = await worker.fetch(new Request(`https://club.test/api${path}`, { headers: cookie ? { Cookie: cookie } : {} }), env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const u = await db.prepare('INSERT INTO users (email, name) VALUES (?, ?)').bind('maya@example.com', 'Maya').run();
const uid = u.meta.last_row_id;
const cookie = `${USER_COOKIE}=${await signValue(env, `${uid}:${Date.now() + 60_000}`)}`;

assert.equal((await call('/me/live')).status, 401, 'signed out cannot read the live room');
assert.deepEqual((await call('/me/live', cookie)).body, { live: null }, 'nothing open');

await db.prepare(`INSERT INTO rooms (code, title, created_at) VALUES ('OLD1', 'Stale', datetime('now', '-9 hours'))`).run();
assert.deepEqual((await call('/me/live', cookie)).body, { live: null }, 'a room open nine hours is not live');

await db.prepare(`INSERT INTO rooms (code, title) VALUES ('WXYZ', 'Duel night')`).run();
let live = (await call('/me/live', cookie)).body.live;
assert.equal(live.code, 'WXYZ');
assert.equal(live.title, 'Duel night');
assert.equal(live.here, false);

await db.prepare('INSERT INTO room_checkins (code, user_id) VALUES (?, ?)').bind('WXYZ', uid).run();
live = (await call('/me/live', cookie)).body.live;
assert.equal(live.here, true, 'checked in shows as here');

const dash = (await call('/me/dashboard', cookie)).body;
assert.equal(dash.meeting.kind, 'live');
assert.equal(dash.meeting.code, live.code, 'Today and the pill agree');

await db.prepare(`UPDATE rooms SET closed_at = datetime('now') WHERE code = 'WXYZ'`).run();
assert.deepEqual((await call('/me/live', cookie)).body, { live: null }, 'closed rooms drop off');

console.log('  ok   shell: /me/live (5 checks)');
