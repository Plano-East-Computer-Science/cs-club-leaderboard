/**
 * Play door: daily seeding (deterministic, Chicago days, no repeats), the
 * content banks (no duplicates, answers accepted, every Java output and bug
 * fix checked by a real `java` when one is installed), scoring, streaks, and
 * the /api/play routes: one result per game per day, the today/yesterday
 * window, and a board that shows public names only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Hono } from 'hono';

import { makeTestDb } from './d1-shim.js';
import { signValue } from '../worker/auth.js';
import { playRouter } from '../worker/hub/play.js';
import {
  GAMES, addDays, bitTargets, chicagoDate, dailyPicks, dateOpen, dayNumber, msToNextPuzzle, pointsFor, practicePicks, resultError, scoreGuess, shuffle, streakOf,
} from '../shared/next/play/core.js';
import { ANSWERS } from '../shared/next/play/words.js';
import { ALLOWED, WORDS } from '../shared/next/play/dict.js';
import { SNIPPETS } from '../shared/next/play/trace.js';
import { BIGO, CLASSES } from '../shared/next/play/bigo.js';
import { BUGS } from '../shared/next/play/bugs.js';
import { BOARDS } from '../shared/next/play/buckets.js';

/* ------------------------------- seeding -------------------------------- */

assert.equal(new Set(GAMES.map((g) => g.slug)).size, GAMES.length);
assert.equal(dayNumber('2026-01-01'), 0);
assert.equal(dayNumber('2026-11-20'), 323);
assert.equal(dayNumber('2025-12-31'), -1);

// Same date, same pick, every time; and the date is the Chicago one.
assert.deepEqual(dailyPicks('keyword', '2026-11-20', 370), dailyPicks('keyword', '2026-11-20', 370));
assert.deepEqual(dailyPicks('trace', '2026-11-20', 100, 5), dailyPicks('trace', '2026-11-20', 100, 5));
assert.equal(chicagoDate(new Date('2026-11-21T05:59:59Z')), '2026-11-20', '11:59pm in Chicago is still the 20th');
assert.equal(chicagoDate(new Date('2026-11-21T06:00:00Z')), '2026-11-21');
assert.equal(chicagoDate(new Date('2026-07-04T04:59:59Z')), '2026-07-03', 'CDT');
// A whole bank is used before anything repeats, across days and within a day.
for (const [n, k] of [[370, 1], [102, 5], [45, 3], [67, 1]]) {
  const seen = [];
  for (let d = 0; d * k < n - k; d++) seen.push(...dailyPicks('x', addDays('2026-03-01', d), n, k));
  // starts mid-cycle, so check a window inside one cycle instead of the first n
  const start = dayNumber('2026-03-01') * k;
  const firstCycleEnd = (Math.floor(start / n) + 1) * n - start;
  const inCycle = seen.slice(0, firstCycleEnd);
  assert.equal(new Set(inCycle).size, inCycle.length, `no repeats inside a cycle of ${n}`);
  assert.ok(seen.every((i) => Number.isInteger(i) && i >= 0 && i < n));
}
const year = [];
for (let d = 0; d < 365; d++) year.push(dailyPicks('keyword', addDays('2026-01-01', d), ANSWERS.length)[0]);
assert.equal(new Set(year).size, 365, 'a full year of Keyword answers with no repeat');
assert.notDeepEqual(dailyPicks('keyword', '2026-11-20', 370), dailyPicks('keyword', '2026-11-21', 370));
assert.deepEqual(shuffle([1, 2, 3, 4], 's'), shuffle([1, 2, 3, 4], 's'));
assert.equal(new Set(practicePicks(80, 10, 'abc')).size, 10);

const ms = msToNextPuzzle(new Date('2026-11-20T18:00:00Z')); // noon in Chicago
assert.equal(ms, 12 * 3600_000);

/* --------------------------------- banks --------------------------------- */

const words = ANSWERS.map((a) => a.word);
assert.ok(words.length >= 365, 'at least a year of answers');
assert.equal(new Set(words).size, words.length, 'no duplicate answers');
for (const a of ANSWERS) {
  assert.match(a.word, /^[a-z]{5}$/, a.word);
  assert.ok(a.def && a.def.length > 15 && !a.def.includes('—'), `definition for ${a.word}`);
  assert.ok(ALLOWED.has(a.word), `${a.word} is accepted as a guess`);
}
assert.equal(new Set(WORDS).size, WORDS.length, 'no duplicate dictionary words');
assert.ok(WORDS.length > 3000 && WORDS.every((w) => /^[a-z]{5}$/.test(w)));

assert.ok(SNIPPETS.length >= 60);
assert.equal(new Set(SNIPPETS.map((s) => (s.helpers || '') + s.code)).size, SNIPPETS.length, 'no duplicate snippets');
for (const s of SNIPPETS) {
  assert.equal(s.wrong.length, 3, s.code);
  assert.equal(new Set([s.out, ...s.wrong]).size, 4, `four distinct choices: ${s.code}`);
  assert.ok([1, 2, 3].includes(s.level) && s.why);
}

assert.ok(BIGO.length >= 80);
assert.equal(new Set(BIGO.map((b) => b.code)).size, BIGO.length, 'no duplicate Big-O snippets');
for (const b of BIGO) assert.ok(CLASSES.some((c) => c.id === b.ans) && b.why, b.code);
for (const c of CLASSES) assert.ok(BIGO.filter((b) => b.ans === c.id).length >= 6, `enough ${c.label}`);

assert.ok(BUGS.length >= 40);
assert.equal(new Set(BUGS.map((b) => b.code)).size, BUGS.length, 'no duplicate bugs');
for (const b of BUGS) {
  assert.ok(b.bug >= 0 && b.bug < b.code.split('\n').length, b.goal);
  assert.equal(new Set(b.fixes).size, 3, b.goal);
  assert.ok(!b.fixes.includes(b.code.split('\n')[b.bug]), `a fix differs from the bug: ${b.goal}`);
}

assert.ok(BOARDS.length >= 60);
const boardKeys = new Set();
for (const [i, b] of BOARDS.entries()) {
  assert.equal(b.groups.length, 4, `board ${i}`);
  const terms = b.groups.flatMap((g) => g.terms);
  assert.ok(b.groups.every((g) => g.terms.length === 4 && g.label), `board ${i} has four of four`);
  assert.equal(new Set(terms.map((t) => t.toLowerCase())).size, 16, `board ${i} has 16 different tiles`);
  boardKeys.add(terms.slice().sort().join('|'));
}
assert.equal(boardKeys.size, BOARDS.length, 'no duplicate boards');

/* ------------------------- real Java checks the banks ------------------------- */

function runJava(name, src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-'));
  fs.writeFileSync(path.join(dir, `${name}.java`), src);
  const r = spawnSync('java', [`${name}.java`], { cwd: dir, encoding: 'utf8', timeout: 120_000 });
  fs.rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(r.stderr || 'java failed');
  return r.stdout.replace(/\r\n/g, '\n');
}

if (spawnSync('java', ['-version']).status === 0) {
  // Trace: every snippet's printed output is exactly `out`.
  const cls = SNIPPETS.map((s, i) => `static class T${i} {\n${(s.helpers || '').replace(/^class /gm, 'static class ')}\nstatic void run() throws Exception {\n${s.code}\n}\n}`).join('\n');
  const main = SNIPPETS.map((_, i) => `{ ByteArrayOutputStream b = new ByteArrayOutputStream(); System.setOut(new PrintStream(b, true, "UTF-8")); try { T${i}.run(); } catch (Throwable e) { System.out.print("<error>"); } System.setOut(o); o.print("@@@" + b.toString("UTF-8")); }`).join('\n');
  const outs = runJava('TraceCheck', `import java.util.*;\nimport java.io.*;\npublic class TraceCheck {\n${cls}\npublic static void main(String[] a) throws Exception {\nPrintStream o = System.out;\n${main}\n}\n}\n`).split('@@@').slice(1);
  SNIPPETS.forEach((s, i) => assert.equal(outs[i].replace(/\n$/, ''), s.out, `Trace snippet ${i} (${s.topic})`));

  // Squash: the bug fails, the fix passes, each wrong fix fails.
  const variants = BUGS.flatMap((b, i) => [null, 0, 1, 2].map((f) => {
    const lines = b.code.split('\n');
    if (f !== null) lines[b.bug] = b.fixes[f];
    return { i, f, src: lines.join('\n') };
  }));
  const vcls = variants.map((v, k) => `static class V${k} {\n${v.src}\nstatic String run() { return String.valueOf(${BUGS[v.i].call}); }\n}`).join('\n');
  const vmain = variants.map((_, k) => `{ String r; try { r = V${k}.run(); } catch (Throwable e) { r = "<error>"; } System.out.print("@@@" + r); }`).join('\n');
  const got = runJava('BugCheck', `import java.util.*;\npublic class BugCheck {\n${vcls}\npublic static void main(String[] a) {\n${vmain}\n}\n}\n`).split('@@@').slice(1);
  variants.forEach((v, k) => {
    const b = BUGS[v.i];
    if (v.f === 0) assert.equal(got[k], b.expect, `Squash ${v.i}: the right fix works`);
    else assert.notEqual(got[k], b.expect, `Squash ${v.i}: variant ${v.f ?? 'bug'} must fail`);
  });
  console.log(`  ok   ${SNIPPETS.length} Trace outputs and ${BUGS.length} Squash fixes checked with java`);
} else {
  console.log('  skip Java checks (no java installed)');
}

/* -------------------------------- Keyword -------------------------------- */

const sg = (g, a) => scoreGuess(g, a).map((x) => x[0]).join('');
assert.equal(sg('stack', 'stack'), 'hhhhh');
assert.equal(sg('crane', 'stack'), 'nmhmm');
assert.equal(sg('array', 'stack'), 'nmmmm', 'one a in the answer: only one near');
assert.equal(sg('llama', 'hello'), 'nnmmm', 'two l in the answer, both near');
assert.equal(sg('sassy', 'stack'), 'hnmmm', 'repeated guess letter beyond the answer count is a miss');
assert.equal(sg('eerie', 'merge'), 'mhhmh', 'the only spare e is used up by the hits');

/* --------------------------------- scores -------------------------------- */

assert.equal(pointsFor('keyword', { won: true, guesses: 1 }), 100);
assert.equal(pointsFor('keyword', { won: true, guesses: 6 }), 50);
assert.equal(pointsFor('keyword', { won: false, guesses: 6 }), 10);
assert.equal(pointsFor('trace', { correct: 5 }), 100);
assert.equal(pointsFor('trace', { correct: 2 }), 40);
assert.equal(pointsFor('buckets', { won: true, mistakes: 0 }), 100);
assert.equal(pointsFor('buckets', { won: true, mistakes: 3 }), 40);
assert.equal(pointsFor('buckets', { won: false, found: 2 }), 20);
assert.equal(pointsFor('order-up', { correct: 30 }), 100, 'capped');
assert.equal(pointsFor('order-up', { correct: 10 }), 40);
assert.equal(pointsFor('squash', { fixed: 3, mistakes: 0 }), 100);
assert.equal(pointsFor('squash', { fixed: 1, mistakes: 3 }), 3);
assert.equal(pointsFor('squash', { fixed: 0, mistakes: 3 }), 0, 'never negative');
assert.equal(pointsFor('bits', { ms: 25_000 }), 100);
assert.equal(pointsFor('bits', { ms: 70_000 }), 60);
assert.equal(pointsFor('bits', { ms: 900_000 }), 20, 'finishing always counts for something');
assert.equal(pointsFor('nope', {}), 0);
for (const g of GAMES) assert.ok(pointsFor(g.slug, { won: true, guesses: 3, correct: 3, mistakes: 1, fixed: 2, found: 1, ms: 40_000 }) > 0, g.slug);
const targets = bitTargets('2026-11-20');
assert.deepEqual(targets, bitTargets('2026-11-20'));
assert.ok(targets.length === 5 && targets.every((t) => t.value >= 1 && t.value <= 255) && targets[4].hex && !targets[0].hex);

/* --------------------------- streaks and windows --------------------------- */

assert.equal(streakOf([], '2026-11-20'), 0);
assert.equal(streakOf(['2026-11-20', '2026-11-19', '2026-11-18'], '2026-11-20'), 3);
assert.equal(streakOf(['2026-11-19', '2026-11-18'], '2026-11-20'), 2, 'today not played yet keeps the streak');
assert.equal(streakOf(['2026-11-18'], '2026-11-20'), 0, 'a missed day breaks it');
assert.equal(streakOf(['2026-11-20', '2026-11-20', '2026-11-19'], '2026-11-20'), 2, 'two games one day count once');
assert.ok(dateOpen('2026-11-20', '2026-11-20') && dateOpen('2026-11-19', '2026-11-20'));
assert.ok(!dateOpen('2026-11-18', '2026-11-20') && !dateOpen('2026-11-21', '2026-11-20'));

for (const bad of [null, {}, { game: 'chess', date: '2026-11-20', score: 5 }, { game: 'trace', date: '2026-13-40', score: 5 }, { game: 'trace', date: '2026-11-20', score: 101 },
  { game: 'trace', date: '2026-11-20', score: 5.5 }, { game: 'trace', date: '2026-11-20', score: 5, guesses: -1 }, { game: 'trace', date: '2026-11-20', score: 5, detail: 'x'.repeat(401) }]) {
  assert.ok(resultError(bad), `reject ${JSON.stringify(bad)?.slice(0, 60)}`);
}
assert.equal(resultError({ game: 'trace', date: '2026-11-20', score: 80, guesses: 5, ms: 1000, detail: 'x' }), null);

/* -------------------------------- routes --------------------------------- */

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const db = makeTestDb(schema);
const env = { DB: db, SESSION_SECRET: 'test' };
db.exec(`INSERT INTO users (id, email, name, show_full_name) VALUES (1, 'ada@x.test', 'Ada Lovelace', 0), (2, 'grace@x.test', 'Grace Hopper', 1), (3, 'gone@x.test', 'Gone Person', 0)`);
db.exec(`UPDATE users SET deleted_at = datetime('now') WHERE id = 3`);
const app = new Hono();
app.route('/api', playRouter);
const call = async (method, url, body, user) => {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Cookie = `cslb_user=${await signValue(env, `${user}:${Date.now() + 3600_000}`)}`;
  const res = await app.request(url, { method, headers, body: body && JSON.stringify(body) }, env);
  return { status: res.status, json: await res.json() };
};
const today = chicagoDate();
const yesterday = addDays(today, -1);

assert.equal((await call('GET', '/api/play/me')).status, 401, 'signed out: browser keeps it');
assert.equal((await call('POST', '/api/play/results', { game: 'trace', date: today, score: 80 })).status, 401);
assert.equal((await call('GET', '/api/play/board')).status, 401);

let r = await call('POST', '/api/play/results', { game: 'trace', date: today, score: 80, guesses: 5, detail: '🟩🟩🟥🟩🟩' }, 1);
assert.equal(r.status, 200);
assert.equal(r.json.streak, 1);
assert.equal(r.json.results.length, 1);
assert.equal(r.json.results[0].detail, '🟩🟩🟥🟩🟩');
r = await call('POST', '/api/play/results', { game: 'trace', date: today, score: 100 }, 1);
assert.equal(r.status, 409, 'one result per game per day');
r = await call('GET', '/api/play/me', null, 1);
assert.equal(r.json.results[0].score, 80, 'the first result stands');

assert.equal((await call('POST', '/api/play/results', { game: 'keyword', date: yesterday, score: 70, guesses: 4 }, 1)).status, 200, 'yesterday is open');
assert.equal((await call('POST', '/api/play/results', { game: 'keyword', date: addDays(today, -2), score: 70 }, 1)).status, 400, 'two days back is closed');
assert.equal((await call('POST', '/api/play/results', { game: 'keyword', date: addDays(today, 1), score: 70 }, 1)).status, 400, 'tomorrow is closed');
assert.equal((await call('POST', '/api/play/results', { game: 'keyword', date: today, score: 900 }, 1)).status, 400);
r = await call('GET', '/api/play/me', null, 1);
assert.equal(r.json.streak, 2, 'server computes the streak');
assert.equal(r.json.today, today);

await call('POST', '/api/play/results', { game: 'buckets', date: today, score: 100 }, 2);
await call('POST', '/api/play/results', { game: 'squash', date: today, score: 60 }, 2);
db.exec(`INSERT INTO play_results (user_id, game, date, score) VALUES (3, 'bits', '${today}', 100)`);
r = await call('GET', '/api/play/board', null, 1);
assert.equal(r.status, 200);
const raw = JSON.stringify(r.json);
assert.ok(!/@x\.test|Lovelace|Gone|"id"|uid/.test(raw), 'no emails, surnames without opt-in, deleted members or ids');
assert.deepEqual(r.json.rows.map((x) => x.name), ['Grace Hopper', 'Ada'], 'opted-in full name, otherwise first name');
assert.equal(r.json.rows[0].points, 160);
assert.equal(r.json.rows[0].games, 2);
assert.equal(r.json.rows[1].me, true);
assert.ok(r.json.rows.length <= 10);
// A week from now, this week's results drop off the board (rows only count this week).
assert.ok(r.json.week <= today);

console.log('play: ok');
