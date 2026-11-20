/**
 * `next` Club door: meeting formats and the playbook are well-formed, every
 * format plans cleanly onto an HQ template, and the kit helpers date and fill
 * things in correctly.
 */
import assert from 'node:assert/strict';
import { FORMATS, formatMinutes, prepSchedule, announcement, blockClock, daysBefore } from '../shared/next/club/formats.js';
import { CHAPTERS } from '../shared/next/club/playbook.js';
import { TEMPLATES, cleanBlocks, BLOCK_TYPES } from '../shared/session-templates.js';

const ids = new Set();
for (const f of FORMATS) {
  assert.ok(!ids.has(f.id), `duplicate format ${f.id}`);
  ids.add(f.id);
  assert.equal(formatMinutes(f), 60, `${f.id} should run 60 minutes`);
  assert.ok(Object.hasOwn(TEMPLATES, f.template), `${f.id} uses unknown template ${f.template}`);
  for (const b of f.blocks) assert.ok(BLOCK_TYPES.includes(b.type), `${f.id}: unknown block ${b.type}`);
  // The kit builder posts these blocks to the planner; nothing may be dropped.
  assert.equal(cleanBlocks(f.blocks).length, f.blocks.length, `${f.id}: blocks lost in cleanBlocks`);
  for (const k of ['name', 'line', 'bestFor', 'bring', 'success', 'announce']) assert.ok(String(f[k] ?? '').trim(), `${f.id} missing ${k}`);
  assert.ok(f.prep.length && f.roles.length && f.script.length && f.pitfalls.length, `${f.id} incomplete`);
  const text = JSON.stringify(f);
  assert.ok(!/\u2014/.test(text), `${f.id} has an em dash`);
}

assert.equal(daysBefore('2026-12-02', 7), '2026-11-25');
assert.equal(daysBefore('2026-12-02', -1), '2026-12-03');
assert.equal(daysBefore('2027-03-01', 1), '2027-02-28');

const speaker = FORMATS.find((f) => f.id === 'speaker');
const sched = prepSchedule(speaker, '2026-12-02');
assert.equal(sched[0].due, '2026-11-02');
assert.equal(sched.at(-1).due, '2026-12-03');
for (let i = 1; i < sched.length; i++) assert.ok(sched[i - 1].due <= sched[i].due);

const a = announcement(speaker, { date: '2026-12-02', time: '4:30 PM', place: 'Room 1201' });
assert.ok(a.includes('Wednesday, December 2') && a.includes('4:30 PM in Room 1201'));
assert.ok(!/[{}]/.test(a));
assert.ok(!/[{}]/.test(announcement(speaker, { date: '2026-12-02' })));

const clock = blockClock(speaker, '4:30 PM');
assert.deepEqual(clock.map((b) => b.at), ['4:30', '4:35', '4:38', '4:58', '5:20']);

for (const c of CHAPTERS) {
  assert.ok(c.id && c.title && c.line && c.body.length > 200, `chapter ${c.id} too thin`);
  assert.ok(!/\u2014/.test(c.body + c.line), `chapter ${c.id} has an em dash`);
}
console.log('club-next: ok');
