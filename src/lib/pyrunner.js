// Main-thread side of the Python runner. One cached worker; if a run exceeds
// the timeout the worker is terminated and recreated lazily on the next run.

let worker = null;
let readyPromise = null;
let ready = false;
let nextId = 1;

export const isReady = () => ready;

function start() {
  if (worker) return readyPromise;
  worker = new Worker(new URL('./py.worker.js', import.meta.url), { type: 'module' });
  const w = worker;
  readyPromise = new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      if (ev.data.type === 'ready') {
        ready = true;
        w.removeEventListener('message', onMsg);
        resolve();
      } else if (ev.data.type === 'fatal') {
        reset(w);
        reject(new Error(`Could not load Python: ${ev.data.message}`));
      }
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', () => {
      reset(w);
      reject(new Error('Could not load Python.'));
    });
  });
  return readyPromise;
}

function reset(w) {
  w.terminate();
  if (worker === w) {
    worker = null;
    readyPromise = null;
    ready = false;
  }
}

export function warmUp() {
  return start().catch(() => {});
}

const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').trimEnd();

function runOne(code, stdin, timeoutMs) {
  const w = worker;
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', onMsg);
      reset(w);
      resolve({ stdout: '', stderr: `Stopped: took longer than ${timeoutMs / 1000}s (infinite loop?)`, timedOut: true });
    }, timeoutMs);
    const onMsg = (ev) => {
      if (ev.data.type !== 'result' || ev.data.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      resolve({ stdout: ev.data.stdout, stderr: ev.data.stderr, timedOut: false });
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, code, stdin });
  });
}

/** -> [{ok, stdout, stderr, expected, timedOut}], one per case. */
export async function runCases(code, cases, { timeoutMs = 5000 } = {}) {
  await start(); // load time is not counted against the timeout
  const out = [];
  for (const c of cases) {
    const expected = c.stdout ?? '';
    if (out.some((r) => r.timedOut)) {
      out.push({ ok: false, stdout: '', stderr: 'Skipped after a timeout.', expected, timedOut: false });
      continue;
    }
    if (!worker) await start();
    const r = await runOne(code, c.stdin ?? '', timeoutMs);
    out.push({
      ok: !r.timedOut && !r.stderr && norm(r.stdout) === norm(expected),
      stdout: r.stdout,
      stderr: r.stderr,
      expected,
      timedOut: r.timedOut,
    });
  }
  return out;
}
