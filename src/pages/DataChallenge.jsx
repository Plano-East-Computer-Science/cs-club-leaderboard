/**
 * /arena/data/:id (C12): one data challenge. A notebook (Python cells with
 * pandas and matplotlib, run in the browser by src/lib/data.worker.js), the
 * challenge brief, the leaderboard and the submit form. Nothing loads from a
 * third-party domain, and the hidden answers never reach this page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCodeKeys } from '../lib/codeKeys.js';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { createKernel } from '../lib/datarunner.js';
import { PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { Body } from './Course.jsx';
import { METRICS } from '../../shared/data.js';

const starter = (c) => [
  'print(train.shape)\ntrain.head()',
  'train.describe()',
  'train.hist(figsize=(9, 5))\nplt.tight_layout()',
  `# A first submission: predict the ${METRICS[c.metric].kind === 'regression' ? 'average' : 'most common answer'} for everyone.\n` +
    `submission = test[['${c.idCol}']].copy()\n` +
    `submission['${c.targetCol}'] = train['${c.targetCol}'].${METRICS[c.metric].kind === 'regression' ? 'mean()' : 'mode()[0]'}\n` +
    'submission.head()',
];

function Cell({ n, cell, ready, busy, onChange, onRun, onRemove }) {
  const keys = useCodeKeys(cell.code, onChange, () => ready && !busy && onRun());
  const out = cell.out;
  return (
    <div className="dt-cell">
      <label className="eyebrow" htmlFor={`cell-${n}`}>Cell {n}</label>
      <textarea
        id={`cell-${n}`}
        className="mono dt-code"
        value={cell.code}
        onChange={(e) => onChange(e.target.value)}
        {...keys}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={Math.min(16, Math.max(3, cell.code.split('\n').length + 1))}
      />
      <div className="ar-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn" disabled={!ready || busy} onClick={onRun}>{cell.running ? 'Running...' : 'Run cell'}</button>
        <span className="d" style={{ fontSize: 12 }}>Ctrl+Enter runs. Tab indents, Esc then Tab moves on.</span>
        <button type="button" className="linkb" onClick={onRemove}>Remove</button>
      </div>
      {out && (
        <div className="dt-out" aria-live="polite">
          {out.stdout && <pre>{out.stdout}</pre>}
          {out.images.map((b64, i) => (
            <img key={i} src={`data:image/png;base64,${b64}`} alt={`Plot ${i + 1} from cell ${n}`} />
          ))}
          {out.stderr && <pre className="dn">{out.stderr}</pre>}
          {!out.stdout && !out.stderr && out.images.length === 0 && <p className="d">Ran with no output.</p>}
        </div>
      )}
    </div>
  );
}

export default function DataChallenge() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | ready | failed
  const [status, setStatus] = useState('');
  const [cells, setCells] = useState([]);
  const kernel = useRef(null);
  const [sub, setSub] = useState({ busy: false, msg: null });
  useReveal();

  const load = useCallback(() => {
    setError('');
    api.get(`/data/challenges/${id}`).then((x) => {
      setC(x);
      setCells((old) => (old.length ? old : starter(x).map((code) => ({ code, out: null, running: false }))));
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => () => kernel.current?.dispose(), []);

  const start = async () => {
    setState('loading');
    setStatus('Fetching the data...');
    try {
      const [train, test] = await Promise.all(['train', 'test'].map((f) => fetch(`/api/data/challenges/${id}/${f}.csv`).then((r) => {
        if (!r.ok) throw new Error('Could not load the dataset.');
        return r.text();
      })));
      setStatus('Starting Python...');
      kernel.current = createKernel({ 'train.csv': train, 'test.csv': test }, { onStatus: setStatus });
      await kernel.current.ready();
      setState('ready');
    } catch (e) {
      setStatus(e.message);
      setState('failed');
    }
  };

  const setCell = (i, patch) => setCells((cs) => cs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const anyRunning = cells.some((x) => x.running);
  const run = async (i) => {
    setCell(i, { running: true });
    const out = await kernel.current.run(cells[i].code).catch((e) => ({ stdout: '', stderr: e.message, images: [] }));
    setCell(i, { running: false, out });
  };

  const submit = async (csv) => {
    setSub({ busy: true, msg: null });
    try {
      const r = await api.post(`/data/challenges/${id}/submit`, { csv });
      setC((x) => ({ ...x, leaderboard: r.leaderboard, mine: { tries: (x.mine?.tries ?? 0) + 1 } }));
      setSub({
        busy: false,
        msg: { ok: true, t: `Scored ${r.publicScore} ${METRICS[c.metric].label}${c.status === 'open' ? ' on the public rows. The final score counts every row and shows when the challenge closes.' : '.'}${r.awarded ? ` You earned ${r.awarded} point${r.awarded === 1 ? '' : 's'}.` : ''}` },
      });
    } catch (e) {
      setSub({ busy: false, msg: { ok: false, t: e.message } });
    }
  };
  const fromNotebook = async () => {
    const r = await kernel.current.submission();
    if (r.error) setSub({ busy: false, msg: { ok: false, t: r.error } });
    else submit(r.csv);
  };
  const fromFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 500_000) return setSub({ busy: false, msg: { ok: false, t: 'That file is too big. Keep it under 500 KB.' } });
    f.text().then(submit);
  };

  if (error) return <div className="state-note bad">{error} <button className="btn" onClick={load}>Try again</button></div>;
  if (!c) return <div className="state-note">loading the challenge...</div>;
  const m = METRICS[c.metric];
  const open = c.status === 'open';

  return (
    <>
      <PageHead
        eyebrow="arena / data"
        title={c.title}
        kv={
          <div className="kv two2">
            <div><span>metric</span><strong>{m.label}</strong></div>
            <div><span>{m.higherIsBetter ? 'higher' : 'lower'} wins</span><strong>{c.rows} rows</strong></div>
          </div>
        }
      />
      <section className="sec">
        <div className="wrap dt-grid">
          <div className="dt-main">
            <div className="pn sp rv">
              <div className="pane-h"><span><b>brief.md</b></span><span>{open ? 'open' : 'closed'}</span></div>
              <div className="pn-b">
                <Body text={c.summary} />
                <p className="ar-note">
                  Files: <a className="uline" href={`/api/data/challenges/${c.id}/train.csv`} download={`${c.title}-train.csv`}>train.csv</a> (has the answer column <b>{c.targetCol}</b>),{' '}
                  <a className="uline" href={`/api/data/challenges/${c.id}/test.csv`} download={`${c.title}-test.csv`}>test.csv</a> (does not). In the notebook they are already loaded as <code>train</code> and <code>test</code>.
                </p>
                <p className="ar-note"><Link className="uline" to="/arena/data">All challenges</Link></p>
              </div>
            </div>

            <div className="pn sp rv">
              <div className="pane-h"><span><b>notebook.py</b></span><span>pandas, numpy, matplotlib</span></div>
              <div className="pn-b">
                {state !== 'ready' ? (
                  <div>
                    <p className="d">Python runs in your browser, loaded from this site. Starting the notebook downloads pandas and matplotlib the first time (about 20 MB), then your browser keeps them.</p>
                    <div className="ar-row" style={{ marginTop: 12 }}>
                      <button type="button" className="btn pri" onClick={start} disabled={state === 'loading'}>
                        {state === 'loading' ? 'Starting...' : state === 'failed' ? 'Try again' : 'Start the notebook'}
                      </button>
                      {status && <span role="status" className={state === 'failed' ? 'dn' : 'd'}>{status}</span>}
                    </div>
                  </div>
                ) : (
                  <p className="up" role="status">Ready. <span className="d">Variables stay between cells. Import scikit-learn if you want it, it loads on demand.</span></p>
                )}
                {cells.map((cell, i) => (
                  <Cell
                    key={i}
                    n={i + 1}
                    cell={cell}
                    ready={state === 'ready'}
                    busy={anyRunning}
                    onChange={(code) => setCell(i, { code })}
                    onRun={() => run(i)}
                    onRemove={() => setCells((cs) => cs.filter((_, j) => j !== i))}
                  />
                ))}
                <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => setCells((cs) => [...cs, { code: '', out: null, running: false }])}>Add a cell</button>
              </div>
            </div>
          </div>

          <aside className="dt-side">
            <div className="pn sp rv">
              <div className="pane-h"><span><b>submit</b></span><span>{c.mine?.tries ? `${c.mine.tries} so far` : ''}</span></div>
              <div className="pn-b">
                {!c.signedIn ? (
                  <p className="d"><Link className="uline g" to="/signin">Sign in</Link> to submit predictions.</p>
                ) : !open ? (
                  <p className="d">This challenge is closed. The leaderboard shows final scores.</p>
                ) : (
                  <>
                    <p className="d">A CSV with two columns, <code>{c.idCol}</code> and <code>{c.targetCol}</code>, one row for every id in test.csv.</p>
                    <div className="ar-row" style={{ marginTop: 10 }}>
                      <button type="button" className="btn pri" disabled={state !== 'ready' || sub.busy} onClick={fromNotebook}>
                        Submit my <code>submission</code>
                      </button>
                    </div>
                    {state !== 'ready' && <p className="ar-note">Start the notebook to use this, or upload a file below.</p>}
                    <label className="eyebrow" htmlFor="sub-file" style={{ display: 'block', marginTop: 14 }}>Or upload a CSV</label>
                    <input id="sub-file" className="field" type="file" accept=".csv,text/csv" disabled={sub.busy} onChange={fromFile} />
                  </>
                )}
                {sub.msg && <p className={sub.msg.ok ? 'up' : 'dn'} role="status" style={{ marginTop: 10 }}>{sub.msg.t}</p>}
              </div>
            </div>

            <div className="pn sp rv">
              <div className="pane-h"><span><b>leaderboard</b></span><span>{open ? `public ${m.label}` : `final ${m.label}`}</span></div>
              <div className="pn-b">
                {c.leaderboard.length === 0 ? (
                  <p className="d">Nobody has submitted yet. Be first.</p>
                ) : (
                  <table className="dt-board">
                    <thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">{m.label}</th><th scope="col">Tries</th></tr></thead>
                    <tbody>
                      {c.leaderboard.map((r, i) => (
                        <tr key={i} className={r.mine ? 'me' : undefined}>
                          <td>{r.rank}</td><td>{r.name}{r.mine ? ' (you)' : ''}</td><td>{r.score}</td><td>{r.tries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {open && <p className="ar-note">Rank pays nothing. Your first valid submission earns the points, once. The final score uses all rows, not just the ones shown here.</p>}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
