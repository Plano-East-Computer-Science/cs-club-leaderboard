/**
 * Officer screen for the problem bank (C2): list, create, edit, retire.
 * "Check solution" runs the reference solution against every case in this
 * browser; a problem cannot be set live until that passes for the current
 * solution and cases. The server never runs code.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';
import CodeRunner from '../../components/CodeRunner.jsx';
import { Body } from '../Course.jsx';
import { parseStarter } from '../../../shared/starter.js';

const BAD = '#c42e2e';
const EMPTY = {
  slug: '', title: '', body: '', difficulty: 1, tags: '', starter: '', cases: [{ stdin: '', stdout: '' }],
  solution: '', source_url: '', status: 'draft',
};

// Changes to either invalidate a passed check.
const keyOf = (f) => JSON.stringify([f.solution, f.cases]);

export default function Problems() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null = list view
  const [fStatus, setFStatus] = useState('');
  const [fDiff, setFDiff] = useState('');
  const [fText, setFText] = useState('');

  const load = useCallback(() => {
    api.get('/admin/hub/problems').then((d) => setRows(d.problems)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const t = fText.trim().toLowerCase();
    return (rows || []).filter(
      (r) =>
        (!fStatus || r.status === fStatus) &&
        (!fDiff || r.difficulty === Number(fDiff)) &&
        (!t || `${r.title} ${r.slug} ${r.tags.join(' ')}`.toLowerCase().includes(t))
    );
  }, [rows, fStatus, fDiff, fText]);

  const edit = async (id) => {
    setError(null);
    try {
      const p = await api.get(`/admin/hub/problems/${id}`);
      setForm({ ...p, tags: p.tags.join(', '), id: p.id });
    } catch (e) {
      setError(e.message);
    }
  };

  const retire = async (id) => {
    if (!window.confirm('Retire this problem? It leaves the public bank but old results keep working.')) return;
    await api.post(`/admin/hub/problems/${id}/retire`).then(load).catch((e) => setError(e.message));
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Arena</p>
        <h2 className="display mt-1 text-2xl font-bold">Problem bank</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Problems that duels, the daily problem and contests draw from. Tests run in your browser, so check the
          solution before you set a problem live.
        </p>
      </div>
      {error && <p className="mono mb-3 text-xs" style={{ color: BAD }} role="alert">{error}</p>}

      {form ? (
        <Editor
          start={form}
          onDone={() => {
            setForm(null);
            load();
          }}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="grid gap-1">
              <span className="eyebrow">Search</span>
              <input className="field" value={fText} onChange={(e) => setFText(e.target.value)} placeholder="title, slug or tag" />
            </label>
            <label className="grid gap-1">
              <span className="eyebrow">Status</span>
              <select className="field" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="retired">Retired</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="eyebrow">Difficulty</span>
              <select className="field" value={fDiff} onChange={(e) => setFDiff(e.target.value)}>
                <option value="">All</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="btn pri" onClick={() => setForm({ ...EMPTY })}>New problem</button>
          </div>

          {!rows ? (
            <Spinner />
          ) : shown.length === 0 ? (
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No problems match.</p>
          ) : (
            <ul className="grid gap-2">
              {shown.map((r) => (
                <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <b>{r.title}</b>{' '}
                    <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                      {r.slug} / level {r.difficulty} / {r.status}{r.tags.length ? ` / ${r.tags.join(', ')}` : ''}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="btn" onClick={() => edit(r.id)}>Edit</button>
                    {r.status !== 'retired' && <button type="button" className="btn" onClick={() => retire(r.id)}>Retire</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Editor({ start, onDone }) {
  const [f, setF] = useState(start);
  const [passedKey, setPassedKey] = useState(null);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const isNew = !start.id;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setCase = (i, k, v) => set('cases', f.cases.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const checked = passedKey === keyOf(f);

  const save = async () => {
    setErr(null);
    if (f.status === 'live' && !checked) {
      setErr('Run "Check solution" and pass every case before setting this problem live.');
      return;
    }
    setBusy(true);
    try {
      const body = { ...f, difficulty: Number(f.difficulty) };
      if (isNew) await api.post('/admin/hub/problems', body);
      else await api.put(`/admin/hub/problems/${start.id}`, body);
      onDone();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="card grid gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="eyebrow">Title</span>
          <input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Slug {isNew ? '(cannot change later)' : '(fixed)'}</span>
          <input className="field mono" value={f.slug} disabled={!isNew} onChange={(e) => set('slug', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Difficulty (1 easy, 5 hard)</span>
          <select className="field" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Tags (comma list)</span>
          <input className="field" value={f.tags} onChange={(e) => set('tags', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Source link (https, optional)</span>
          <input className="field" value={f.source_url} onChange={(e) => set('source_url', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Status</span>
          <select className="field" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="live">Live (needs a passed check)</option>
            <option value="retired">Retired</option>
          </select>
        </label>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="eyebrow" htmlFor="pb-body">Statement (markdown: ``` fences, ## headings, - bullets)</label>
          <button type="button" className="btn" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <div className="card p-3">
            <Body text={f.body} />
            <div className="mt-4">
              <CodeRunner id="pb-prev" cases={f.cases} initial={parseStarter(f.starter).python} runLabel="Run tests as a student" />
            </div>
          </div>
        ) : (
          <textarea id="pb-body" className="field mono" rows={8} value={f.body} onChange={(e) => set('body', e.target.value)} />
        )}
      </div>

      <label className="grid gap-1">
        <span className="eyebrow">Starter code shown to students (Python, or JSON with java and python keys)</span>
        <textarea className="field mono" rows={5} value={f.starter} onChange={(e) => set('starter', e.target.value)} spellCheck={false} />
      </label>

      <fieldset className="grid gap-2">
        <legend className="eyebrow mb-1">Test cases (what the program reads, and what it must print)</legend>
        {f.cases.map((c, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1">
              <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Case {i + 1} stdin</span>
              <textarea className="field mono" rows={2} value={c.stdin} onChange={(e) => setCase(i, 'stdin', e.target.value)} spellCheck={false} />
            </label>
            <label className="grid gap-1">
              <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Case {i + 1} expected stdout</span>
              <textarea className="field mono" rows={2} value={c.stdout} onChange={(e) => setCase(i, 'stdout', e.target.value)} spellCheck={false} />
            </label>
            <button type="button" className="btn self-end" onClick={() => set('cases', f.cases.filter((_, j) => j !== i))} aria-label={`Remove case ${i + 1}`}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn justify-self-start" onClick={() => set('cases', [...f.cases, { stdin: '', stdout: '' }])}>
          Add case
        </button>
      </fieldset>

      <div>
        <p className="eyebrow mb-1">Reference solution (never shown to students)</p>
        <CodeRunner
          id="pb-sol"
          cases={f.cases}
          value={f.solution}
          onChange={(v) => set('solution', v)}
          onResults={(_, ok) => setPassedKey(ok ? keyOf(f) : null)}
          runLabel="Check solution"
        />
        <p className="mono mt-2 text-xs" style={{ color: checked ? '#2f8f5b' : 'var(--ink-soft)' }} role="status">
          {checked ? 'Solution passes every case.' : 'Not checked yet for this solution and these cases.'}
        </p>
      </div>

      {err && <p className="mono text-xs" style={{ color: BAD }} role="alert">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
