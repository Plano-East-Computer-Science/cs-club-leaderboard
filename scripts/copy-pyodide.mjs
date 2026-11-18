/**
 * Copies the Python-in-the-browser runtime (Pyodide) into public/pyodide so the
 * site serves it itself. School networks block most CDNs, so the lessons and
 * the data arena (C12) must not depend on one. Runs automatically before
 * `npm run build`.
 *
 * Two parts:
 *  1. The runtime from node_modules (always).
 *  2. The data-science packages (numpy, pandas, matplotlib, scikit-learn and
 *     everything they depend on), which npm does not ship. They are fetched
 *     once, here at build time, from the Pyodide release CDN, checked against
 *     the sha256 in pyodide-lock.json, and kept in public/pyodide. Browsers
 *     never talk to the CDN: the lock file's relative file names resolve to
 *     our own /pyodide/ path, and a member's browser loads them only when a
 *     data challenge is opened.
 *
 * Workers static assets allow 25 MiB per file. Every copied file is checked
 * and the script fails loudly if one is over (R2 would be the way out).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'node_modules', 'pyodide');
const to = path.join(root, 'public', 'pyodide');
const FILES = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const PACKAGES = ['numpy', 'pandas', 'matplotlib', 'scikit-learn'];
const LIMIT = 25 * 1024 * 1024;

fs.mkdirSync(to, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(from, f), path.join(to, f));

const lock = JSON.parse(fs.readFileSync(path.join(to, 'pyodide-lock.json'), 'utf8'));
const version = lock.info.version;

// The packages plus everything they depend on, from the lock file.
const wanted = new Set();
const visit = (name) => {
  if (wanted.has(name)) return;
  const p = lock.packages[name];
  if (!p) throw new Error(`pyodide: ${name} is not in pyodide-lock.json (Pyodide ${version})`);
  wanted.add(name);
  (p.depends || []).forEach(visit);
};
PACKAGES.forEach(visit);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let fetched = 0;
for (const name of wanted) {
  const { file_name: file, sha256: want } = lock.packages[name];
  const dest = path.join(to, file);
  if (!fs.existsSync(dest) || sha256(dest) !== want) {
    const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`pyodide: could not download ${file} (${res.status}) from ${url}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    if (sha256(dest) !== want) throw new Error(`pyodide: ${file} does not match the checksum in pyodide-lock.json`);
    fetched++;
  }
}

let total = 0;
for (const f of [...FILES, ...[...wanted].map((n) => lock.packages[n].file_name)]) {
  const size = fs.statSync(path.join(to, f)).size;
  if (size > LIMIT) {
    throw new Error(`pyodide: ${f} is ${(size / 1048576).toFixed(1)} MiB, over the 25 MiB Workers static-asset limit. Drop it from PACKAGES or move it to R2.`);
  }
  total += size;
}
console.log(`pyodide: ${FILES.length} runtime files + ${wanted.size} packages (${fetched} downloaded) in public/pyodide, ${(total / 1048576).toFixed(1)} MiB`);
