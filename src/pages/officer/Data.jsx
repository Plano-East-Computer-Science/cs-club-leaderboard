/**
 * Officer screen for the data arena (C12). Add a challenge from three CSV
 * files: training data (with the answer column), test data (without it) and
 * the hidden answers. The answers are stored on the server and never shown
 * again, here or anywhere. Closing a challenge flips its leaderboard to final
 * scores and stops uploads.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';
import { METRICS, METRIC_IDS } from '../../../shared/data.js';

const BAD = '#c42e2e';
const EMPTY = { title: '', summary: '', metric: 'accuracy', idCol: 'id', targetCol: '', train: '', test: '', answers: '' };

function FileField({ id, label, hint, name, onText }) {
  return (
    <div>
      <label className="eyebrow" htmlFor={id} style={{ display: 'block' }}>{label}</label>
      <input
        id={id}
        className="field"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) f.text().then(onText);
        }}
      />
      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{name ? `Loaded ${Math.round(name / 1000)} KB.` : hint}</p>
    </div>
  );
}

export default function DataAdmin() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/hub/data/challenges').then((d) => setRows(d.challenges)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      await api.post('/admin/hub/data/challenges', f);
      setF(EMPTY);
    });
    setBusy(false);
  };

  return (
    <section className="grid gap-3" style={{ marginTop: 28 }} aria-labelledby="data-admin-h">
      <header>
        <p className="eyebrow">Data arena</p>
        <h2 id="data-admin-h" className="text-xl font-semibold">Data challenges</h2>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Upload train.csv (with the answer column), test.csv (without it) and answers.csv (the id column and the answer column, one row for every test id).
          Each file can be up to 500 KB. Members see the first two; the answers stay on the server.
        </p>
      </header>
      {error && <p className="mono text-sm" role="alert" style={{ color: BAD }}>{error}</p>}

      <form className="card grid gap-3 p-4" onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="eyebrow" htmlFor="dc-title" style={{ display: 'block' }}>Title</label>
            <input id="dc-title" className="field" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={100} required />
          </div>
          <div>
            <label className="eyebrow" htmlFor="dc-metric" style={{ display: 'block' }}>Score with</label>
            <select id="dc-metric" className="field" value={f.metric} onChange={(e) => set('metric', e.target.value)}>
              {METRIC_IDS.map((m) => <option key={m} value={m}>{METRICS[m].label} ({METRICS[m].kind}, {METRICS[m].higherIsBetter ? 'higher' : 'lower'} wins)</option>)}
            </select>
          </div>
          <div>
            <label className="eyebrow" htmlFor="dc-id" style={{ display: 'block' }}>Id column name</label>
            <input id="dc-id" className="field" value={f.idCol} onChange={(e) => set('idCol', e.target.value)} required />
          </div>
          <div>
            <label className="eyebrow" htmlFor="dc-target" style={{ display: 'block' }}>Answer column name</label>
            <input id="dc-target" className="field" value={f.targetCol} onChange={(e) => set('targetCol', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="eyebrow" htmlFor="dc-summary" style={{ display: 'block' }}>Description (what the rows are, what to predict, how it is scored)</label>
          <textarea id="dc-summary" className="field" rows={5} value={f.summary} onChange={(e) => set('summary', e.target.value)} maxLength={3000} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FileField id="dc-train" label="train.csv" hint="Features and the answer column." name={f.train.length} onText={(t) => set('train', t)} />
          <FileField id="dc-test" label="test.csv" hint="Features only, the rows to predict." name={f.test.length} onText={(t) => set('test', t)} />
          <FileField id="dc-answers" label="answers.csv (hidden)" hint="Id and answer for every test row." name={f.answers.length} onText={(t) => set('answers', t)} />
        </div>
        <div>
          <button className="btn pri" disabled={busy || !f.train || !f.test || !f.answers}>{busy ? 'Adding...' : 'Add challenge'}</button>
        </div>
      </form>

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No challenges yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1 text-sm">
                <b>{r.title}</b>
                <span className="chip" style={{ marginLeft: 8 }}>{METRICS[r.metric].label}</span>
                <span className="chip" style={{ marginLeft: 6 }}>{r.status}</span>
                <span className="mono text-xs" style={{ marginLeft: 8, color: 'var(--ink-faint)' }}>{r.rows} rows, {r.submissions} submissions</span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => act(() => api.post(`/admin/hub/data/challenges/${r.id}/status`, { status: r.status === 'open' ? 'closed' : 'open' }))}
              >
                {r.status === 'open' ? 'Close and show final scores' : 'Reopen'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => window.confirm(`Delete "${r.title}" and its ${r.submissions} submissions? This cannot be undone.`) && act(() => api.del(`/admin/hub/data/challenges/${r.id}`))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
