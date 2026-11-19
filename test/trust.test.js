/**
 * V3-A trust fixes: private block notes, attendance on check-in, auto-close,
 * one points table (GET /api/club), readable point labels, 60/120 templates.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { makeTestDb } from './d1-shim.js';
import { Room } from '../worker/hub/room-do.js';
import * as S from '../worker/hub/session.js';
import { cleanBlocks } from '../shared/session-templates.js';

const SCHEMA = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok   ${name}`);
}

class Ws {
  constructor(att) {
    this.att = att;
    this.sent = [];
  }
  deserializeAttachment() {
    return this.att;
  }
  send(x) {
    this.sent.push(JSON.parse(x));
  }
}

function makeRoom(db, sockets, code) {
  const store = new Map();
  const ctx = {
    storage: {
      get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k)),
      put: async (k, v) => void store.set(k, v),
      setAlarm: async () => {},
    },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => sockets,
  };
  const room = new Room(ctx, { DB: db });
  room.s.code = code;
  return room;
}

/* ------------------------------ 1. private notes ------------------------------ */

await check('a student socket never receives block notes; the host does', async () => {
  const SECRET = 'answer is 42, ask Sam first';
  const db = makeTestDb(SCHEMA);
  const host = new Ws({ role: 'host', uid: 'host' });
  const ana = new Ws({ role: 'student', uid: '1', name: 'Ana' });
  const room = makeRoom(db, [host, ana], 'NOTE');
  await new Promise((r) => setTimeout(r, 0));
  room.s.session = S.newSession({
    template: 'build',
    blocks: [
      { type: 'poll', title: 'Warm-up', minutes: 5, notes: SECRET, screen: 'Answer the poll' },
      // A block saved before `screen` existed: its old text is officer-only now.
      { type: 'close', title: 'Close', minutes: 2, notes: `legacy ${SECRET}` },
    ],
  });
  const msg = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
  await msg(host, { t: 'block_next' });
  await msg(host, { t: 'blocks_set', blocks: [...room.s.session.blocks, { type: 'show', title: 'Show', minutes: 3, notes: SECRET }] });
  await msg(ana, { t: 'pulse', v: 'fast' });
  assert.ok(ana.sent.length >= 3);
  for (const view of ana.sent) {
    const text = JSON.stringify(view);
    assert.ok(!text.includes(SECRET), 'no officer note text in a student payload');
    assert.ok(!text.includes('"notes"'), 'no notes field in a student payload');
  }
  assert.equal(ana.sent.at(-1).session.blocks[0].screen, 'Answer the poll', 'students get the on-screen text');
  assert.equal(host.sent.at(-1).session.blocks[0].notes, SECRET, 'the host console keeps the notes');
});

await check('cleanBlocks keeps notes and screen apart and bounds both', async () => {
  const [x] = cleanBlocks([{ type: 'hook', title: 'Hi', minutes: 3, notes: ` ${'n'.repeat(600)} `, screen: '  Look up  ' }]);
  assert.equal(x.notes.length, 500);
  assert.equal(x.screen, 'Look up');
  const [legacy] = cleanBlocks([{ type: 'hook', title: 'Old', minutes: 3, notes: 'old text' }]);
  assert.deepEqual([legacy.notes, legacy.screen], ['old text', ''], 'legacy notes stay officer-only');
});

console.log(`trust: ${passed} checks passed`);
