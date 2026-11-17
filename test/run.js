/**
 * Runs every check: the original self-test, the hub checks, and any
 * test/*.test.js file. New areas add their own *.test.js file instead of
 * editing a shared one, so parallel work does not collide here.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = ['selftest.js', 'hub.js', ...fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()];

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) {
    failed++;
    console.error(`FAILED: test/${f}`);
  }
}
if (failed) process.exit(1);
console.log(`all ${files.length} test files passed`);
