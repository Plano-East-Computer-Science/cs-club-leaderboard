/**
 * Duel Packs 1 and 2 (V3-B): worker/seed-packs.sql loads into the schema, is
 * safe to re-run, resumes a half-applied big case, never touches a problem an
 * officer edited, and every stored problem passes the bank's own validation.
 * Each Python reference solution is run against every stored case. (Java was
 * matched byte for byte by scripts/packs/build.mjs when the seed was written.)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import { makeTestDb } from './d1-shim.js';
import { validateProblem, publicProblem } from '../worker/hub/problems.js';
import { checkSet, checkBank, slugsOf } from '../worker/hub/sets.js';

const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const seed = fs.readFileSync(new URL('../worker/seed-packs.sql', import.meta.url), 'utf8');

const db = makeTestDb(schema);
db.exec(seed);
db.exec(seed);
const rows = (await db.prepare('SELECT * FROM problems ORDER BY id').all()).results;
assert.equal(rows.length, 22, '11 problems per pack');
const sets = (await db.prepare('SELECT * FROM problem_sets ORDER BY slug').all()).results;
assert.deepEqual(sets.map((s) => s.slug), ['duel-pack-1', 'duel-pack-2']);

for (const s of sets) {
  const { value, error } = checkSet({ slug: s.slug, kind: s.kind, title: s.title, status: s.status, body: JSON.parse(s.body) });
  assert.ok(value, `${s.slug}: ${error}`);
  assert.equal(await checkBank(db, slugsOf(value.kind, value.body)), null, `${s.slug} names only live problems`);
  for (const slug of slugsOf(value.kind, value.body)) {
    const p = rows.find((r) => r.slug === slug);
    assert.ok(p.tags.split(',').includes('duel') && p.tags.split(',').includes(s.slug), `${slug} is tagged duel and ${s.slug}`);
  }
}
// Contest level 3 to 5, at least one 5 in Pack 2 (the brief's spread).
const levels = (slug) => JSON.parse(sets.find((s) => s.slug === slug).body).contest.map((x) => rows.find((r) => r.slug === x).difficulty);
assert.ok(levels('duel-pack-2').every((d) => d >= 3) && levels('duel-pack-2').includes(5));

for (const r of rows) {
  const v = validateProblem({ ...r, cases: JSON.parse(r.cases) });
  assert.ok(v.value, `${r.slug} must stay editable in the officer editor: ${v.error}`);
  const cases = JSON.parse(r.cases);
  assert.ok(cases.length >= 9, `${r.slug} has samples and at least 8 hidden cases`);
  assert.ok(r.cases.length < 210_000, `${r.slug} cases stay near 200 KB`);
  assert.equal(r.status, 'live');
  assert.match(r.body, /## Sample input/);
  assert.ok(r.body.includes(cases[0].stdin.trimEnd()), `${r.slug}: the first sample in the statement is case 1`);
  const pub = publicProblem(r);
  assert.ok(pub.starters.java.includes('class Main') && pub.starters.python && pub.starter === pub.starters.python, `${r.slug} has both starters`);
}

// A big case appended in pieces: if a run stopped part way, the next run finishes it.
{
  const before = (await db.prepare(`SELECT cases FROM problems WHERE slug = 'win-streak'`).first()).cases;
  db.exec(`UPDATE problems SET cases = json_remove(cases, '$[#-1]') WHERE slug = 'win-streak'`);
  db.exec(`UPDATE problems SET cases = json_set(cases, '$[#-1].stdin', substr(json_extract(cases, '$[#-1].stdin'), 1, 60000)) WHERE slug = 'fire-drill' AND length(json_extract(cases, '$[#-1].stdin')) > 60000`);
  db.exec(seed);
  assert.equal((await db.prepare(`SELECT cases FROM problems WHERE slug = 'win-streak'`).first()).cases, before, 'a missing appended case comes back');
  const fire = rows.find((r) => r.slug === 'fire-drill').cases;
  assert.equal((await db.prepare(`SELECT cases FROM problems WHERE slug = 'fire-drill'`).first()).cases, fire, 'a half-written case is completed');
}
// An officer's edit is never overwritten or appended to.
{
  db.exec(`UPDATE problems SET cases = '[{"stdin":"1\\n","stdout":"1"}]', updated_at = datetime('now', '+1 day') WHERE slug = 'range-sums'`);
  db.exec(seed);
  assert.equal(JSON.parse((await db.prepare(`SELECT cases FROM problems WHERE slug = 'range-sums'`).first()).cases).length, 1);
}

const py = ['python', 'python3', 'py'].find((bin) => spawnSync(bin, ['--version']).status === 0);
if (!py) {
  console.log('packs: python not found, skipped running the reference solutions');
} else {
  const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
  let ran = 0;
  for (const r of rows) {
    for (const [i, c] of JSON.parse(r.cases).entries()) {
      const p = spawnSync(py, ['-c', r.solution], { input: c.stdin, encoding: 'utf8', timeout: 20_000, maxBuffer: 16 << 20 });
      assert.equal(p.status, 0, `${r.slug} case ${i + 1} crashed: ${p.stderr}`);
      assert.equal(norm(p.stdout), c.stdout, `${r.slug} case ${i + 1}`);
      ran++;
    }
  }
  console.log(`packs: ran ${ran} stored cases through ${py}`);
}
console.log('packs: ok');
