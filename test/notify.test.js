/** Discord notify (F4) and announce-once digest notes (G3). */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { isDiscordWebhook, notify } from '../worker/hub/notify.js';
import { buildDigest } from '../worker/digest.js';
import { setSetting } from '../worker/db.js';
import { makeTestDb } from './d1-shim.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

assert.ok(isDiscordWebhook('https://discord.com/api/webhooks/123/abc'));
assert.ok(isDiscordWebhook('https://discordapp.com/api/webhooks/123/abc'));
for (const bad of ['', null, 'http://discord.com/api/webhooks/1/a', 'https://evil.com/api/webhooks/1/a',
  'https://discord.com.evil.com/api/webhooks/1/a', 'https://discord.com/api/webhooks/', 'https://example.com/?https://discord.com/api/webhooks/1/a']) {
  assert.ok(!isDiscordWebhook(bad), `rejects ${bad}`);
}

const db = makeTestDb(SCHEMA);
const realFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 204 };
};

// No webhook configured: nothing sent, no throw.
assert.equal(await notify({}, db, 'hi'), false);
// A non-Discord URL is never fetched.
await setSetting(db, 'discord_webhook_url', 'https://evil.com/hook');
assert.equal(await notify({}, db, 'hi'), false);
assert.equal(calls.length, 0);
// A real one is, and can never ping everyone.
await setSetting(db, 'discord_webhook_url', 'https://discord.com/api/webhooks/1/abc');
assert.equal(await notify({}, db, '@everyone hi'), true);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0].body.allowed_mentions, { parse: [] });
// A network failure is swallowed.
globalThis.fetch = async () => { throw new Error('down'); };
assert.equal(await notify({}, db, 'hi'), false);
globalThis.fetch = realFetch;

// Queued announcements make a digest on their own.
const since = new Date().toISOString();
assert.equal(await buildDigest(db, since), null);
await setSetting(db, 'digest_notes', JSON.stringify(['Pizza at the next meeting']));
const d = await buildDigest(db, since);
assert.deepEqual(d.notes, ['Pizza at the next meeting']);

console.log('notify tests passed');
