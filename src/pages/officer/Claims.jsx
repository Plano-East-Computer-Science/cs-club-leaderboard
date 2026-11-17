/**
 * Officer claims queue (A3). One tap approves (the ledger pays by the rules)
 * or rejects with an optional reason the member sees. The server refuses an
 * officer approving their own claim.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const KIND_LABEL = { compete: 'competed in', place: 'placed in', ship: 'shipped', mentor: 'mentored', manual: 'manual award' };

export default function Claims() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [reason, setReason] = useState({});

  const load = useCallback(() => {
    setRows(null);
    api.get(`/admin/hub/claims?status=${status}`).then((d) => setRows(d.claims)).catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const act = async (id, verb) => {
    try {
      const d = await api.post(`/admin/hub/claims/${id}/${verb}`, verb === 'reject' ? { reason: reason[id] ?? '' } : undefined);
      setNote({ text: verb === 'approve' ? `Approved, ${d.awarded} points.` : 'Rejected.' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Claims</p>
        <h2 className="display mt-1 text-2xl font-bold">Claims queue</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Members claim competitions, placings and shipped projects. Check the proof, then approve or reject. Points
          follow the club's rules, and you cannot approve your own.
        </p>
      </div>
      <div className="mb-3 flex gap-2" role="group" aria-label="Which claims">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button key={s} className={`btn ${status === s ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && (
        <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>
          {note.text}
        </p>
      )}
      {!rows && !error && <Spinner label="Loading claims" />}
      {rows && rows.length === 0 && (
        <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nothing {status}.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 p-4 text-sm">
              <span>
                <b>{r.student_name}</b> {KIND_LABEL[r.kind] ?? r.kind}{' '}
                <b style={{ color: 'var(--gold)' }}>{r.title || r.ref}</b>
                {r.place ? ` (place ${r.place})` : ''}
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{r.created_at}</span>
              </span>
              {r.note && <span style={{ color: 'var(--ink-soft)' }}>{r.note}</span>}
              {r.proof_url && (
                <a className="uline mono text-xs" href={r.proof_url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--gold)', overflowWrap: 'anywhere' }}>
                  {r.proof_url}
                </a>
              )}
              {status === 'pending' ? (
                <span className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-primary" onClick={() => act(r.id, 'approve')}>Approve</button>
                  <input
                    className="field"
                    style={{ width: 'auto', flex: '1 1 160px' }}
                    maxLength={200}
                    placeholder="Reason, if rejecting"
                    aria-label={`Reason for rejecting ${r.student_name}'s claim`}
                    value={reason[r.id] ?? ''}
                    onChange={(e) => setReason((x) => ({ ...x, [r.id]: e.target.value }))}
                  />
                  <button className="btn btn-ghost" onClick={() => act(r.id, 'reject')}>Reject</button>
                </span>
              ) : (
                <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {status} by {r.decided_name || 'unknown'}
                  {status === 'approved' ? `, ${r.points} points` : r.reject_reason ? `: ${r.reject_reason}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
