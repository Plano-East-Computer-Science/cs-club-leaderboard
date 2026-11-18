// Python for the data arena (C12): a notebook kernel in a worker. Unlike
// py.worker.js (fresh namespace per run, for lessons), variables survive from
// one cell to the next, and matplotlib figures come back as PNGs.
// Everything loads from /pyodide/ on this site, including numpy, pandas and
// matplotlib (copied by scripts/copy-pyodide.mjs). Nothing here is fetched for
// the lessons: this worker only exists once a member opens a data challenge.

const HARNESS = `
import sys, io, json, ast, base64, traceback
import matplotlib
matplotlib.use('agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Dark figures that sit on the site's panels instead of glaring white.
plt.rcParams.update({
    'figure.facecolor': '#0f0f0c', 'axes.facecolor': '#14130e', 'savefig.facecolor': '#0f0f0c',
    'axes.edgecolor': '#3a3622', 'axes.labelcolor': '#ebe7d6', 'text.color': '#ebe7d6',
    'xtick.color': '#9a9480', 'ytick.color': '#9a9480', 'grid.color': '#2a281c',
    'axes.prop_cycle': matplotlib.cycler(color=['#FFC20E', '#3ecf7a', '#5aa9ff', '#ff6253', '#c792ea', '#8fd3c2']),
    'figure.figsize': (6.4, 3.6), 'figure.dpi': 100, 'font.size': 10,
})
pd.set_option('display.width', 100)
pd.set_option('display.max_columns', 30)

_ns = {'__name__': '__main__', 'pd': pd, 'np': np, 'plt': plt}

def _figures():
    out = []
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format='png', bbox_inches='tight')
        out.append(base64.b64encode(buf.getvalue()).decode())
    plt.close('all')
    return out

def _run(code):
    out, err = io.StringIO(), io.StringIO()
    o, e = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    try:
        tree = ast.parse(code, 'your_code.py', 'exec')
        # Like a notebook: a bare expression on the last line prints its value.
        last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        exec(compile(tree, 'your_code.py', 'exec'), _ns)
        if last is not None:
            val = eval(compile(ast.Expression(last.value), 'your_code.py', 'eval'), _ns)
            if val is not None:
                print(val)
    except SystemExit:
        pass
    except BaseException:
        t, v, tb = sys.exc_info()
        err.write(''.join(traceback.format_exception(t, v, tb.tb_next)))
    finally:
        sys.stdout, sys.stderr = o, e
    return json.dumps([out.getvalue(), err.getvalue(), _figures()])

def _submission():
    s = _ns.get('submission')
    if not isinstance(s, pd.DataFrame):
        return json.dumps({'error': 'Make a DataFrame called submission first, with the id column and your predictions.'})
    return json.dumps({'csv': s.to_csv(index=False)})
`;

let py;

const ready = (async () => {
  const runtimeUrl = '/pyodide/pyodide.mjs'; // held in a variable so the bundler leaves it alone
  const { loadPyodide } = await import(/* @vite-ignore */ runtimeUrl);
  py = await loadPyodide({ indexURL: '/pyodide/' });
  postMessage({ type: 'status', text: 'Loading numpy, pandas and matplotlib (first time only)...' });
  await py.loadPackage(['numpy', 'pandas', 'matplotlib']);
  py.runPython(HARNESS);
  postMessage({ type: 'ready' });
})().catch((e) => postMessage({ type: 'fatal', message: String(e?.message || e) }));

self.onmessage = async (ev) => {
  const m = ev.data;
  await ready;
  if (!py) return;
  try {
    if (m.type === 'files') {
      for (const [name, text] of Object.entries(m.files)) py.FS.writeFile(`/home/pyodide/${name}`, text);
      py.runPython(`_ns['train'] = pd.read_csv('train.csv')\n_ns['test'] = pd.read_csv('test.csv')`);
      postMessage({ type: 'result', id: m.id, stdout: '', stderr: '', images: [] });
    } else if (m.type === 'run') {
      // scikit-learn, scipy and friends load here, only when a cell imports them.
      await py.loadPackagesFromImports(m.code);
      const [stdout, stderr, images] = JSON.parse(py.globals.get('_run')(m.code));
      postMessage({ type: 'result', id: m.id, stdout, stderr, images });
    } else if (m.type === 'submission') {
      postMessage({ type: 'result', id: m.id, ...JSON.parse(py.globals.get('_submission')()) });
    }
  } catch (e) {
    postMessage({ type: 'result', id: m.id, stdout: '', stderr: String(e?.message || e), images: [] });
  }
};
