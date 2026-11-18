/**
 * C15 officer screen: set the paper of the month, and see every member's
 * science-fair card (soonest deadline first) so you know who to follow up with.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

export default function Research() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ title: '', url: '', why: '' });
  const [note, setNote] = useState(null);
  const load = useCallback(() => {
    api.get('/admin/hub/research/projects').then((d) => setRows(d.projects)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const post = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/hub/research/paper', f);
      setF({ title: '', url: '', why: '' });
      setNote({ text: 'Paper of the month set.' });
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <header className="mb-3">
        <p className="eyebrow">Research</p>
        <h2 className="display text-xl font-extrabold">Paper of the month and science fair</h2>
      </header>
      <form className="grid gap-2" onSubmit={post} style={{ maxWidth: 560 }}>
        <input className="field" required maxLength={160} placeholder="Paper title" aria-label="Paper title" value={f.title} onChange={set('title')} />
        <input className="field" required type="url" placeholder="https:// link" aria-label="Paper link" value={f.url} onChange={set('url')} />
        <textarea className="field" rows={2} maxLength={400} placeholder="Why this paper" aria-label="Why this paper" value={f.why} onChange={set('why')} />
        <button className="btn btn-primary justify-self-start">Set as paper of the month</button>
        {note && <p className="mono text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--ink-soft)' }}>{note.text}</p>}
      </form>
      <h3 className="mt-4 mb-2 text-sm font-bold">Science-fair cards</h3>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!rows && !error && <Spinner label="Loading projects" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No cards yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((p) => (
            <li key={p.user_id} className="grid gap-1 p-3 text-sm">
              <span><b>{p.name}</b> · {p.stage}{p.deadline ? ` · due ${p.deadline}` : ''}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{p.question || 'No question yet'}{p.mentor ? ` · mentor: ${p.mentor}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
