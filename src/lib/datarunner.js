// Main-thread side of the data notebook (C12). One kernel per open challenge:
// a worker (src/lib/data.worker.js) that keeps variables between cells. A cell
// that runs past the timeout kills the worker; the next run starts a fresh one
// and the member's variables are gone (the datasets reload by themselves).

export function createKernel(files, { onStatus } = {}) {
  let worker = null;
  let starting = null;
  let nextId = 1;

  const stop = () => {
    worker?.terminate();
    worker = null;
    starting = null;
  };

  const start = () => {
    if (starting) return starting;
    const w = new Worker(new URL('./data.worker.js', import.meta.url), { type: 'module' });
    worker = w;
    starting = new Promise((resolve, reject) => {
      const fail = (msg) => {
        if (worker === w) stop();
        reject(new Error(msg));
      };
      w.addEventListener('message', (ev) => {
        if (ev.data.type === 'status') onStatus?.(ev.data.text);
        else if (ev.data.type === 'fatal') fail(`Could not load Python: ${ev.data.message}`);
        else if (ev.data.type === 'ready') {
          send(w, { type: 'files', files }).then(resolve, (e) => fail(e.message));
        }
      });
      w.addEventListener('error', () => fail('Could not load Python.'));
    });
    return starting;
  };

  const send = (w, msg, timeoutMs) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = timeoutMs
        ? setTimeout(() => {
            w.removeEventListener('message', onMsg);
            if (worker === w) stop();
            resolve({ stdout: '', stderr: `Stopped: that cell took longer than ${timeoutMs / 1000}s (infinite loop?). Your variables were reset.`, images: [], timedOut: true });
          }, timeoutMs)
        : null;
      const onMsg = (ev) => {
        if (ev.data.type !== 'result' || ev.data.id !== id) return;
        clearTimeout(timer);
        w.removeEventListener('message', onMsg);
        resolve(ev.data);
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ ...msg, id });
    });

  return {
    /** Starts the kernel (downloads the packages the first time). */
    ready: start,
    /** -> { stdout, stderr, images: [base64 png], timedOut } */
    async run(code, timeoutMs = 60_000) {
      await start(); // load time is not counted against the timeout
      return send(worker, { type: 'run', code }, timeoutMs);
    },
    /** The `submission` DataFrame as CSV text, or { error }. */
    async submission() {
      await start();
      return send(worker, { type: 'submission' });
    },
    dispose: stop,
  };
}
