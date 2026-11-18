/**
 * C6 officer screen: editorials members wrote for bank problems. Accepting pays
 * the author one mentor activity (once); you cannot accept your own. Text is
 * shown as plain React text, never HTML.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

export default function Editorials() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    api.get(`/admin/hub/editorials?status=${status}`).then((d) => setRows(d.editorials)).catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const act = async (id, verb) => {
    try {
      const r = await api.post(`/admin/hub/editorials/${id}/${verb}`);
      setNote({ text: verb === 'accept' ? `Accepted.${r.awarded ? ` ${r.awarded} points paid.` : ''}` : 'Rejected.' });
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Editorials</p>
        <h2 className="display mt-1 text-2xl font-bold">Member editorials</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members who solved a problem can explain it. Accepting one shows it to other solvers and pays the author a mentor award, once.
          Read the code before you accept.
        </p>
      </div>
      <div className="mb-3 flex gap-2" role="group" aria-label="Which editorials">
        {['pending', 'accepted', 'rejected', 'hidden'].map((s) => (
          <button key={s} className={`btn ${status === s ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}
      {!rows && !error && <Spinner label="Loading editorials" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nothing {status}.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 p-4 text-sm">
              <span>
                <b>{r.title || r.slug}</b> by {r.author}
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{r.created_at}</span>
              </span>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</p>
              {r.code && <pre className="mono overflow-auto rounded border p-2.5 text-[0.8rem]">{r.code}</pre>}
              {r.status === 'pending' ? (
                <span className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={() => act(r.id, 'accept')}>Accept</button>
                  <button className="btn btn-ghost" onClick={() => act(r.id, 'reject')}>Reject</button>
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
