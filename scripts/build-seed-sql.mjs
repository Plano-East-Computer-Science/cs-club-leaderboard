/**
 * Turns shared/seed-data.js into worker/seed.sql.
 *
 * Run this after editing the seed data:  npm run build:seed
 * Then load it into D1 once:             npm run db:seed
 *
 * Generating the SQL rather than hand-writing it means the demo roster, the
 * badge list, and the opportunity catalogue stay in one readable JavaScript
 * file instead of a thousand lines of INSERT statements nobody wants to edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGES, DEMO_STUDENTS, OPPORTUNITIES, SETTINGS } from '../shared/seed-data.js';
import { milesFromSchool, fingerprintOf } from '../worker/geo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** SQLite string literal. Doubling single quotes is the whole escape rule. */
const q = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const n = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'NULL' : String(v));

const lines = [
  '-- GENERATED FILE -- edit shared/seed-data.js and run `npm run build:seed`.',
  '--',
  '-- Loaded once when the site is first set up. Safe to re-run: every statement',
  '-- is INSERT OR IGNORE, so it will not duplicate or overwrite real club data.',
  '',
];

lines.push('-- Badges');
for (const b of BADGES) {
  lines.push(
    `INSERT OR IGNORE INTO badges (name, emoji, description, color) VALUES (${q(b.name)}, ${q(b.emoji)}, ${q(b.description)}, ${q(b.color)});`
  );
}

lines.push('', '-- Demo members. Delete these from the admin panel once real members are added.');
DEMO_STUDENTS.forEach((s, i) => {
  const seed = s.name.toLowerCase().replace(/\W+/g, '');
  lines.push(
    `INSERT OR IGNORE INTO students (id, name, grade, avatar_seed) VALUES (${i + 1}, ${q(s.name)}, ${n(s.grade)}, ${q(seed)});`
  );
  for (const [delta, reason] of s.events) {
    lines.push(
      `INSERT INTO point_events (student_id, delta, reason) SELECT ${i + 1}, ${n(delta)}, ${q(reason)} WHERE NOT EXISTS (SELECT 1 FROM point_events WHERE student_id = ${i + 1} AND reason = ${q(reason)});`
    );
  }
  for (const badge of s.badges) {
    lines.push(
      `INSERT OR IGNORE INTO student_badges (student_id, badge_id) SELECT ${i + 1}, id FROM badges WHERE name = ${q(badge)};`
    );
  }
});

lines.push('', '-- Verified opportunity catalogue');
for (const o of OPPORTUNITIES) {
  const lat = o.lat ?? null;
  const lng = o.lng ?? null;
  const distance =
    o.format === 'local' && lat != null && lng != null
      ? Math.round(milesFromSchool(lat, lng) * 10) / 10
      : null;
  lines.push(
    `INSERT OR IGNORE INTO opportunities (title, org, description, url, type, cost, format, location, lat, lng, distance_mi, age_min, age_max, source, status, fingerprint) VALUES (` +
      [
        q(o.title), q(o.org), q(o.description), q(o.url), q(o.type ?? 'program'),
        q(o.cost ?? 'free'), q(o.format ?? 'online'), q(o.location ?? ''),
        n(lat), n(lng), n(distance), n(o.age_min ?? 14), n(o.age_max ?? 17),
        `'seed'`, `'live'`, q(fingerprintOf(o)),
      ].join(', ') +
      ');'
  );
}

lines.push('', '-- Editable page text');
for (const [k, v] of Object.entries(SETTINGS)) {
  lines.push(`INSERT OR IGNORE INTO settings (key, value) VALUES (${q(k)}, ${q(v)});`);
}

const out = path.join(ROOT, 'worker', 'seed.sql');
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');

// Sanity: every local opportunity must be inside the radius, or the seed is wrong.
const tooFar = OPPORTUNITIES.filter(
  (o) => o.format === 'local' && o.lat != null && milesFromSchool(o.lat, o.lng) > 15
);
if (tooFar.length) {
  console.error('Seed error -- local opportunities beyond 15 miles:', tooFar.map((o) => o.title));
  process.exit(1);
}

console.log(`Wrote ${out} (${lines.length} lines, ${OPPORTUNITIES.length} opportunities)`);
