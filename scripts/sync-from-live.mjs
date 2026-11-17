/**
 * Mirrors the live site's PUBLIC content into the LOCAL database, so what you
 * develop and demo against matches what visitors actually see.
 *
 * Read-only against the live site (plain GETs of its public API) and write-only
 * against local D1 (`--local`); it can never touch production. It copies page
 * content only -- settings, officers, curriculum, competitions, puzzles,
 * opportunities -- and leaves members, points, accounts and hub data alone.
 *
 *   npm run sync:live            (needs the local schema: npm run db:schema:local)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGIN = process.env.LIVE_ORIGIN || 'https://peshcompsci.org';

const get = async (p) => {
  const res = await fetch(`${ORIGIN}/api/${p}`);
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.json();
};

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const insert = (table, rows) =>
  rows.map((r) => {
    const cols = Object.keys(r);
    return `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => q(r[c])).join(',')});`;
  });

const [site, officers, curriculum, competitions, puzzles, opps] = await Promise.all(
  ['site', 'officers', 'curriculum', 'competitions', 'puzzles', 'opportunities'].map(get)
);

const sql = [
  ...['settings', 'officers', 'curriculum_topics', 'competitions', 'puzzles', 'opportunities'].map((t) => `DELETE FROM ${t};`),
  ...insert('settings', Object.entries(site.settings).map(([key, value]) => ({ key, value }))),
  ...insert('officers', officers.officers),
  ...insert('curriculum_topics', curriculum.topics),
  ...insert('competitions', competitions.competitions),
  ...insert('puzzles', puzzles.puzzles),
  ...insert('opportunities', opps.opportunities),
].join('\n');

const file = path.join(os.tmpdir(), 'cs-club-sync-live.sql');
fs.writeFileSync(file, sql);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'cs-club', '--local', '--file', file], {
  stdio: 'inherit',
  shell: true,
});
console.log(
  `Synced from ${ORIGIN}: ${officers.officers.length} officers, ${curriculum.topics.length} topics, ` +
    `${competitions.competitions.length} competitions, ${puzzles.puzzles.length} puzzles, ${opps.opportunities.length} opportunities.`
);
