/**
 * The whole schema file must apply cleanly to an empty database, twice
 * (every statement is IF NOT EXISTS). Parallel branches all append to this
 * file, so a bad merge shows up here instead of on deploy day.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(sql);
db.exec(sql);
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map((r) => r.name);
for (const t of ['students', 'users', 'activity', 'problems', 'rungs', 'kudos', 'cf_solves', 'repo_stats', 'duel_results', 'daily_results']) {
  assert.ok(tables.includes(t), `schema creates ${t}`);
}
console.log(`schema: ok (${tables.length} tables)`);
