// Main-thread side of the Java runner, shaped like ../pyrunner.js: one cached
// worker; if a run exceeds the timeout the worker is terminated and recreated
// lazily on the next run (the compiler reloads from the browser cache).

let worker = null;
let readyPromise = null;
let ready = false;
let nextId = 1;

export const isReady = () => ready;

function start() {
  if (worker) return readyPromise;
  worker = new Worker(new URL('./java.worker.js', import.meta.url), { type: 'module' });
  const w = worker;
  readyPromise = new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      if (ev.data.type === 'ready') {
        ready = true;
        w.removeEventListener('message', onMsg);
        resolve();
      } else if (ev.data.type === 'fatal') {
        reset(w);
        reject(new Error(`Could not load Java: ${ev.data.message}`));
      }
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', () => {
      reset(w);
      reject(new Error('Could not load Java.'));
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

/**
 * Compiles once and runs once per stdin.
 * -> { compile: { ok, diagnostics, fileName, timeMs }, results: [{ stdout, stderr, exitCode, timeMs, diagnostics, timedOut }] }
 * Load and compile time are not counted against `timeoutMs`; each run is.
 */
export async function runJava(source, stdins, { timeoutMs = 5000, onPhase } = {}) {
  onPhase?.(ready ? 'compiling' : 'loading');
  await start();
  onPhase?.('compiling');
  const w = worker;
  const id = nextId++;
  return new Promise((resolve) => {
    const results = [];
    let compile = null;
    let timer = null;
    const finish = () => {
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      resolve({ compile, results });
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reset(w);
        results.push({ stdout: '', stderr: `Stopped: took longer than ${timeoutMs / 1000}s (infinite loop?)`, exitCode: 1, timeMs: timeoutMs, diagnostics: [], timedOut: true });
        while (results.length < stdins.length) {
          results.push({ stdout: '', stderr: 'Skipped after a timeout.', exitCode: 1, timeMs: 0, diagnostics: [], timedOut: false });
        }
        finish();
      }, timeoutMs);
    };
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.id !== id) return;
      if (m.type === 'compiled') {
        compile = { ok: m.ok, diagnostics: m.diagnostics || [], fileName: m.fileName, timeMs: m.timeMs };
        if (!m.ok || !stdins.length) return finish();
        onPhase?.('running');
        arm();
      } else if (m.type === 'case') {
        results.push({ ...m.result, timedOut: false });
        if (results.length === stdins.length) finish();
        else arm();
      }
    };
    w.addEventListener('message', onMsg);
    // Compiling should take seconds; a stuck compiler must not hang the page forever.
    timer = setTimeout(() => {
      reset(w);
      compile = { ok: false, diagnostics: [{ line: null, col: null, severity: 'error', message: 'Compiling took too long. Try again.' }] };
      finish();
    }, 90_000);
    w.postMessage({ id, source, stdins });
  });
}
