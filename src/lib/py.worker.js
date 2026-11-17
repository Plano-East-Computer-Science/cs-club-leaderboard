// Runs student Python in a worker so an infinite loop can be terminated.
// Pyodide is self-hosted (/pyodide/); school networks block CDNs.

const HARNESS = `
import sys, io, json, traceback
def _run(code, stdin):
    out, err = io.StringIO(), io.StringIO()
    o, e, i = sys.stdout, sys.stderr, sys.stdin
    sys.stdout, sys.stderr, sys.stdin = out, err, io.StringIO(stdin)
    try:
        exec(compile(code, 'your_code.py', 'exec'), {'__name__': '__main__'})
    except SystemExit:
        pass
    except BaseException:
        t, v, tb = sys.exc_info()
        # drop the harness's own exec() frame so the traceback starts at student code
        err.write(''.join(traceback.format_exception(t, v, tb.tb_next)))
    finally:
        sys.stdout, sys.stderr, sys.stdin = o, e, i
    return json.dumps([out.getvalue(), err.getvalue()])
`;

let run;

const ready = (async () => {
  // Held in a variable so the bundler leaves it alone: this file is served
  // as-is from /pyodide/ (copied there by scripts/copy-pyodide.mjs).
  const runtimeUrl = '/pyodide/pyodide.mjs';
  const { loadPyodide } = await import(/* @vite-ignore */ runtimeUrl);
  const py = await loadPyodide({ indexURL: '/pyodide/' });
  py.runPython(HARNESS);
  run = py.globals.get('_run');
  postMessage({ type: 'ready' });
})().catch((e) => postMessage({ type: 'fatal', message: String(e?.message || e) }));

self.onmessage = async (ev) => {
  const { id, code, stdin } = ev.data;
  await ready;
  if (!run) return;
  try {
    const [stdout, stderr] = JSON.parse(run(code, stdin ?? ''));
    postMessage({ type: 'result', id, stdout, stderr });
  } catch (e) {
    postMessage({ type: 'result', id, stdout: '', stderr: String(e?.message || e) });
  }
};
