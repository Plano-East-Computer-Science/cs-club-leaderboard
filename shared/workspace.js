/**
 * D2: workspace rules shared by the Worker and the browser. Limits, path
 * validation, the size check a save must pass, starter files, the multi-file
 * Python program, the sandboxed web preview and a tiny .zip writer. Pure
 * functions, tested in test/workspace.test.js.
 */

export const LIMITS = {
  files: 50,
  fileBytes: 200 * 1024,
  totalBytes: 2 * 1024 * 1024,
  workspaces: 30, // per member
  title: 60,
};
export const KINDS = ['python', 'web'];
export const ENTRY = { python: 'main.py', web: 'index.html' };

const enc = new TextEncoder();
export const bytes = (s) => enc.encode(String(s ?? '')).length;

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,63}$/;

/** A readable reason the path is not allowed, or null when it is fine. */
export function pathError(path) {
  const p = String(path ?? '');
  if (!p) return 'Give the file a name.';
  if (p.includes('\\')) return 'Use / in paths, not \\.';
  if (p.startsWith('/')) return 'Paths start with a name, not /.';
  if (p.length > 120) return 'That path is too long.';
  const parts = p.split('/');
  if (parts.some((s) => s === '..' || s === '.')) return 'Paths cannot use . or .. folders.';
  if (parts.length > 4) return 'Keep folders at most three deep.';
  if (!parts.every((s) => SEGMENT.test(s))) return 'Use letters, numbers, dots, dashes and underscores. Names cannot start with a dot.';
  return null;
}

/**
 * Checks a save against what is already stored.
 * existing: Map path -> size in bytes. change: { files: [{path, content}], deleted: [path] }.
 * Returns { error } or { files, deleted } cleaned for writing.
 */
export function checkSave(existing, change) {
  const files = Array.isArray(change?.files) ? change.files : [];
  const deleted = Array.isArray(change?.deleted) ? change.deleted.map(String) : [];
  if (files.length > LIMITS.files || deleted.length > 200) return { error: 'Too many files in one save.' };

  const sizes = new Map(existing);
  for (const p of deleted) sizes.delete(p);
  const clean = [];
  for (const f of files) {
    const path = String(f?.path ?? '');
    const err = pathError(path);
    if (err) return { error: `${path || 'File'}: ${err}` };
    if (typeof f.content !== 'string') return { error: `${path}: content must be text.` };
    const n = bytes(f.content);
    if (n > LIMITS.fileBytes) return { error: `${path} is over ${LIMITS.fileBytes / 1024} KB. Split it into smaller files.` };
    sizes.set(path, n);
    clean.push({ path, content: f.content });
  }
  if (sizes.size > LIMITS.files) return { error: `A workspace holds at most ${LIMITS.files} files.` };
  let total = 0;
  for (const n of sizes.values()) total += n;
  if (total > LIMITS.totalBytes) return { error: `A workspace holds at most ${LIMITS.totalBytes / 1024 / 1024} MB.` };
  return { files: clean, deleted: deleted.filter((p) => !clean.some((f) => f.path === p)) };
}

/** What a new workspace starts with. */
export const STARTERS = {
  python: {
    'main.py': `from helpers import greet

name = input("Your name: ")
print(greet(name))
`,
    'helpers.py': `def greet(name):
    return f"Hello, {name or 'world'}."
`,
  },
  web: {
    'index.html': `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>My page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello</h1>
  <button id="b">Click me</button>
  <script src="script.js"></script>
</body>
</html>
`,
    'style.css': `body { font-family: system-ui, sans-serif; margin: 2rem; }
h1 { color: #c47f00; }
`,
    'script.js': `let n = 0;
document.getElementById("b").onclick = () => {
  n += 1;
  console.log("clicked", n);
};
`,
  },
};

/* ---------------------------- python program ---------------------------- */

/**
 * One Python source that lays the workspace's .py (and data) files out in a
 * scratch folder, imports from there and runs the entry file, so the existing
 * single-file runner (src/lib/pyrunner.js) can run a multi-file project.
 * Modules from the previous run are dropped so an edited helper is re-read,
 * and cwd and sys.path are put back so lessons run in the same worker after.
 * A JSON string literal is also a valid Python string literal.
 */
export function pythonProgram(files, entry = ENTRY.python) {
  const payload = JSON.stringify(JSON.stringify(files));
  return `import json as _j, os as _o, sys as _s, shutil as _sh
_root = '/home/pyodide/workspace'
_sh.rmtree(_root, ignore_errors=True)
for _p, _c in _j.loads(${payload}).items():
    _f = _o.path.join(_root, _p)
    _o.makedirs(_o.path.dirname(_f), exist_ok=True)
    with open(_f, 'w') as _h:
        _h.write(_c)
for _m in [k for k, v in list(_s.modules.items()) if str(getattr(v, '__file__', '') or '').startswith(_root)]:
    del _s.modules[_m]
_cwd, _path = _o.getcwd(), list(_s.path)
_o.chdir(_root)
_s.path.insert(0, _root)
try:
    with open(${JSON.stringify(entry)}) as _h:
        exec(compile(_h.read(), ${JSON.stringify(entry)}, 'exec'), {'__name__': '__main__'})
finally:
    _o.chdir(_cwd)
    _s.path[:] = _path
`;
}

/* ------------------------------ web preview ------------------------------ */

// First thing in the frame: no network (so a shared page cannot phone home or
// post a fake login form anywhere), then console capture sent to the parent.
const PRELUDE = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data:; media-src data: blob: https:; form-action 'none'">
<script>(function(){function show(a){try{if(typeof a==='string')return a;if(a instanceof Error)return a.stack||String(a);var s=JSON.stringify(a);return s===undefined?String(a):s}catch(e){return String(a)}}
function send(level,args){try{parent.postMessage({wsConsole:1,level:level,text:Array.prototype.map.call(args,show).join(' ')},'*')}catch(e){}}
['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){send(l,arguments);o.apply(console,arguments)}});
addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});
addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise: '+show(e.reason&&e.reason.message||e.reason)])});})();</script>`;

const local = (href) => String(href ?? '').replace(/^\.\//, '');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((x) => x != null);

/**
 * One HTML document with the workspace's local CSS and JS inlined, for an
 * iframe with sandbox="allow-scripts" (no same-origin) and srcdoc.
 * files: { path: content }.
 */
export function buildPreview(files) {
  let html = files['index.html'] ?? '<p>Add an index.html file to see a preview.</p>';
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = local(attr(tag, 'href'));
    if (!/stylesheet/i.test(attr(tag, 'rel') ?? '') || !(href in files)) return tag;
    return `<style>\n${files[href].replace(/<\/style/gi, '<\\/style')}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (tag, attrs) => {
    const src = local(attr(tag, 'src'));
    if (!(src in files)) return tag;
    const rest = attrs.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<script${rest}>\n${files[src].replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => `${h}\n${PRELUDE}`);
  return `${PRELUDE}\n${html}`;
}

/* --------------------------------- zip --------------------------------- */

let CRC;
function crc32(buf) {
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A stored (uncompressed) .zip of { path: text }, as bytes. Small files, so no compression needed. */
export function zip(files, folder = 'workspace') {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = enc.encode(`${folder}/${path}`);
    const data = enc.encode(text);
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true); // names are UTF-8
    head.setUint16(12, 0x21, true); // 1980-01-01
    head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(14, 0x21, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    parts.push(new Uint8Array(head.buffer), name, data);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length / 2, true);
  end.setUint16(10, central.length / 2, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of all) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
