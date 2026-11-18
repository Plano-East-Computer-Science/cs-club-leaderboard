/**
 * G5 officer screen: reports members filed on ideas, projects and feed items.
 * Hide removes the content from public pages; dismiss leaves it up.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const KIND = { idea: 'Idea', project: 'Project', feed: 'Feed item' };

export default function Reports() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    api.get(`/admin/hub/reports?status=${status}`).then((d) => setRows(d.reports)).catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const act = async (id, verb) => {
    try {
      await api.post(`/admin/hub/reports/${id}/${verb}`);
      setNote({ text: verb === 'hide' ? 'Hidden from public pages.' : 'Dismissed.' });
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Reports</p>
        <h2 className="display mt-1 text-2xl font-bold">Member reports</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members flag ideas, projects and feed items they think do not belong. Hide takes it off public pages. Dismiss keeps it up.
        </p>
      </div>
      <div className="mb-3 flex gap-2" role="group" aria-label="Which reports">
        {['open', 'hidden', 'dismissed'].map((s) => (
          <button key={s} className={`btn ${status === s ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && (
        <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>
      )}
      {!rows && !error && <Spinner label="Loading reports" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nothing {status}.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 p-4 text-sm">
              <span>
                <b>{KIND[r.kind] ?? r.kind}</b> by {r.author || 'someone'}
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>reported {r.created_at} by {r.reporter || 'a member'}</span>
              </span>
              <blockquote className="border-l pl-3" style={{ color: 'var(--ink-soft)', overflowWrap: 'anywhere' }}>{r.content ?? '(removed)'}</blockquote>
              {r.reason && <span>Reason given: {r.reason}</span>}
              {status === 'open' ? (
                <span className="flex flex-wrap gap-2">
                  <button className="btn btn-danger" onClick={() => act(r.id, 'hide')}>Hide it</button>
                  <button className="btn btn-ghost" onClick={() => act(r.id, 'dismiss')}>Dismiss</button>
                </span>
              ) : (
                <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{r.status} by {r.decided_name || 'unknown'}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
