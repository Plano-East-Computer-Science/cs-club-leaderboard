/**
 * E7 officer screen: issue and revoke verified-record codes. Find the member by
 * name, issue a code, hand over the link. Revoking makes the link stop working.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const grouped = (c) => c.replace(/(.{4})(?=.)/g, '$1-');

export default function Records() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/hub/records').then((d) => setRows(d.records)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const search = async (e) => {
    e.preventDefault();
    try {
      setFound((await api.get(`/admin/hub/team/search?q=${encodeURIComponent(q.trim())}`)).members);
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  const issue = async (m) => {
    try {
      const { code } = await api.post('/admin/hub/records', { user_id: m.id });
      setNote({ text: `Issued for ${m.name}: ${window.location.origin}/verify/${grouped(code)}` });
      setFound([]);
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  const revoke = async (code) => {
    if (!window.confirm('Revoke this record? The link stops working at once.')) return;
    try {
      await api.post(`/admin/hub/records/${code}/revoke`);
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Verified records</p>
        <h2 className="display mt-1 text-2xl font-bold">Verified records</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          A printable page of a member's attendance, role and approved results, with a code anyone can check. Issue one when a member asks for it, and only after you have checked their claims.
        </p>
      </div>
      <form onSubmit={search} className="mb-3 flex flex-wrap gap-2">
        <input className="field" style={{ width: 'auto', flex: '1 1 200px' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member name" aria-label="Find a member by name" />
        <button className="btn btn-ghost" disabled={q.trim().length < 2}>Find</button>
      </form>
      {found.length > 0 && (
        <ul className="card divide-y mb-3">
          {found.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><b>{m.name}</b> <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{m.email}</span></span>
              <button className="btn btn-primary" onClick={() => issue(m)}>Issue record</button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)', overflowWrap: 'anywhere' }}>{note.text}</p>}
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!rows && !error && <Spinner label="Loading records" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No records issued yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <b>{r.name}</b>
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {r.revoked_at ? 'revoked' : <a className="uline" href={`/verify/${r.code}`}>{grouped(r.code)}</a>} · issued by {r.issued_by_name}
                </span>
              </span>
              {!r.revoked_at && <button className="btn btn-ghost" onClick={() => revoke(r.code)}>Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
