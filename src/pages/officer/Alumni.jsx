/**
 * E6 officer screen: the alumni directory (including contact details, which
 * only officers ever see) and the questions members sent, to forward by hand.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const BLANK = { name: '', grad_year: '', doing: '', topics: '', contact: '' };

export default function Alumni() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState(BLANK);
  const [note, setNote] = useState(null);
  const load = useCallback(() => {
    api.get('/admin/hub/alumni').then(setD).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/hub/alumni', f);
      setF(BLANK);
      setNote(null);
      load();
    } catch (err) {
      setNote(err.message);
    }
  };
  const act = (fn) => async () => {
    await fn().catch((err) => setNote(err.message));
    load();
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <section>
      <header className="mb-3">
        <p className="eyebrow">Alumni</p>
        <h2 className="display text-xl font-extrabold">Graduates and their questions</h2>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members never see contact details. They send a question here, and you forward it by email, then mark it forwarded. Plan an
          ask-me-anything night from the Meeting tab with the speaker template.
        </p>
      </header>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!d && !error && <Spinner label="Loading alumni" />}
      <form className="grid gap-2" onSubmit={add} style={{ maxWidth: 560 }}>
        <input className="field" required maxLength={80} placeholder="Name" aria-label="Name" value={f.name} onChange={set('name')} />
        <input className="field" type="number" placeholder="Graduation year" aria-label="Graduation year" value={f.grad_year} onChange={set('grad_year')} />
        <input className="field" maxLength={200} placeholder="Now doing" aria-label="Now doing" value={f.doing} onChange={set('doing')} />
        <input className="field" maxLength={200} placeholder="Topics they will answer" aria-label="Topics" value={f.topics} onChange={set('topics')} />
        <input className="field" maxLength={200} placeholder="How to reach them (officers only)" aria-label="Contact, officers only" value={f.contact} onChange={set('contact')} />
        <button className="btn btn-primary justify-self-start">Add graduate</button>
        {note && <p className="mono text-xs" role="alert" style={{ color: 'var(--down)' }}>{note}</p>}
      </form>
      {d && (
        <div className="mt-4 grid gap-4">
          <h3 className="text-sm font-bold">Questions to forward ({d.questions.filter((q) => q.status === 'new').length} new)</h3>
          <ul className="card divide-y">
            {d.questions.length === 0 && <li className="p-3 text-sm">No questions yet.</li>}
            {d.questions.map((q) => (
              <li key={q.id} className="grid gap-1 p-3 text-sm">
                <span><b>{q.member}</b> asks {q.alumni_name}</span>
                <p style={{ overflowWrap: 'anywhere' }}>{q.question}</p>
                <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Reach them: {q.contact || 'no contact saved'}</span>
                {q.status === 'new'
                  ? <button className="btn btn-ghost justify-self-start" onClick={act(() => api.post(`/admin/hub/alumni/questions/${q.id}/forwarded`))}>Mark forwarded</button>
                  : <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>forwarded</span>}
              </li>
            ))}
          </ul>
          <h3 className="text-sm font-bold">Directory</h3>
          <ul className="card divide-y">
            {d.alumni.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <b>{a.name}</b> {a.grad_year ? `(${a.grad_year})` : ''} {a.doing} {a.active ? '' : '(hidden)'}
                  <span className="mono block text-xs" style={{ color: 'var(--ink-soft)' }}>{a.contact || 'no contact saved'}</span>
                </span>
                <span className="flex gap-2">
                  <button className="btn btn-ghost" onClick={act(() => api.patch(`/admin/hub/alumni/${a.id}`, { ...a, active: !a.active }))}>{a.active ? 'Hide' : 'Show'}</button>
                  <button className="btn btn-ghost" onClick={() => window.confirm(`Delete ${a.name}?`) && act(() => api.del(`/admin/hub/alumni/${a.id}`))()}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
