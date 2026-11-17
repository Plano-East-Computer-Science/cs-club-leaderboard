/**
 * Copies the Python-in-the-browser runtime (Pyodide) into public/pyodide so the
 * site serves it itself. School networks block most CDNs, so the lessons must
 * not depend on one. Runs automatically before `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'node_modules', 'pyodide');
const to = path.join(root, 'public', 'pyodide');
const FILES = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

fs.mkdirSync(to, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(from, f), path.join(to, f));
console.log(`pyodide: copied ${FILES.length} files to public/pyodide`);
