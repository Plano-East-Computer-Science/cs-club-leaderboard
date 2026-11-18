/**
 * Officer review of member-written CTF challenges (C11). Officers see the
 * puzzle and can test a flag against it, but the flag itself is only a hash.
 * The server refuses an officer approving their own challenge.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

export default function CtfAdmin() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [reason, setReason] = useState({});
  const [test, setTest] = useState({});

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    api.get(`/admin/hub/ctf?status=${status}`).then((d) => setRows(d.challenges)).catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const act = async (id, verb) => {
    try {
      const d = await api.post(`/admin/hub/ctf/${id}/${verb}`, verb === 'reject' ? { reason: reason[id] ?? '' } : undefined);
      setNote({ text: verb === 'approve' ? `Approved. Author got ${d.awarded} points.` : verb === 'reject' ? 'Rejected.' : 'Retired.' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };
  const check = async (id) => {
    try {
      const d = await api.post(`/admin/hub/ctf/${id}/check`, { flag: test[id] ?? '' });
      setNote({ text: d.correct ? 'That flag is correct.' : 'That flag does not match.', bad: !d.correct });
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">CTF board</p>
        <h2 className="display mt-1 text-2xl font-bold">CTF challenges</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members write puzzles. Read it, solve it with the flag tester, then approve. An approved challenge pays its
          author a shipped project, and you cannot approve your own.
        </p>
      </div>
      <div className="mb-3 flex gap-2" role="group" aria-label="Which challenges">
        {['pending', 'live', 'rejected', 'retired'].map((s) => (
          <button key={s} className={`btn ${status === s ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}
      {!rows && !error && <Spinner label="Loading challenges" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nothing {status}.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 p-4 text-sm">
              <span>
                <b style={{ color: 'var(--gold)' }}>{r.title}</b> <span className="mono text-xs">{r.category}, difficulty {r.difficulty}</span>
                {r.author_name && <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>by {r.author_name}</span>}
              </span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{r.body}</span>
              {r.hint && <span style={{ color: 'var(--ink-soft)' }}>Hint: {r.hint}</span>}
              {r.file_data && (
                <pre className="mono text-xs" tabIndex={0} aria-label={`File ${r.file_name}`} style={{ maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.file_data}</pre>
              )}
              <span className="flex flex-wrap items-center gap-2">
                <input className="field" style={{ width: 'auto', flex: '1 1 160px' }} placeholder="Test a flag" aria-label={`Test a flag for ${r.title}`} value={test[r.id] ?? ''} onChange={(e) => setTest((x) => ({ ...x, [r.id]: e.target.value }))} />
                <button className="btn btn-ghost" onClick={() => check(r.id)}>Test</button>
              </span>
              {status === 'pending' && (
                <span className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-primary" onClick={() => act(r.id, 'approve')}>Approve</button>
                  <input className="field" style={{ width: 'auto', flex: '1 1 160px' }} maxLength={200} placeholder="Reason, if rejecting" aria-label={`Reason for rejecting ${r.title}`} value={reason[r.id] ?? ''} onChange={(e) => setReason((x) => ({ ...x, [r.id]: e.target.value }))} />
                  <button className="btn btn-ghost" onClick={() => act(r.id, 'reject')}>Reject</button>
                </span>
              )}
              {status === 'live' && <span><button className="btn btn-ghost" onClick={() => act(r.id, 'retire')}>Retire</button></span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
