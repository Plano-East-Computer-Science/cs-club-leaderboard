/**
 * A7: who the officers are, promoting and demoting them, and the audit log.
 * The server decides everything; the buttons only hide what a non-lead cannot do.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const when = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Team() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);

  const load = useCallback(() => {
    api.get('/admin/hub/team').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => {
      api.get(`/admin/hub/team/search?q=${encodeURIComponent(q.trim())}`).then((d) => setFound(d.members)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const setRole = async (u, role) => {
    setError(null);
    try {
      await api.post(`/admin/hub/team/${u.id}/role`, { role });
      setFound((list) => list.map((m) => (m.id === u.id ? { ...m, role } : m)));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const isLead = data?.me?.role === 'lead';

  const row = (u) => (
    <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
      <span className="min-w-40 flex-1">
        <b>{u.name}</b> <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{u.email}</span>
      </span>
      <span className="mono text-xs" style={{ color: u.role === 'member' ? 'var(--ink-faint)' : 'var(--gold)' }}>{u.role}</span>
      {isLead && (
        <select
          className="field"
          style={{ width: 'auto' }}
          value={u.role}
          onChange={(e) => setRole(u, e.target.value)}
          aria-label={`Role for ${u.name}`}
        >
          <option value="member">member</option>
          <option value="officer">officer</option>
          <option value="lead">lead</option>
        </select>
      )}
    </li>
  );

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Team</p>
        <h2 className="display mt-1 text-2xl font-bold">Officers and roles</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Officers sign in with their own account. Only a lead can change roles, and the last lead cannot be removed.
          {data?.me?.userId === null &&
            ' You are on the shared password, which acts as lead: use it to make the first lead, then sign in with your own account.'}
        </p>
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!data && !error && <Spinner label="Loading team" />}

      {data && (
        <div className="grid gap-6">
          {data.officers.length === 0 ? (
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No officer accounts yet. Search for a member below.</p>
          ) : (
            <ul className="card divide-y">{data.officers.map(row)}</ul>
          )}

          {isLead && (
            <div className="grid gap-2">
              <label className="grid gap-1.5">
                <span className="eyebrow">Find a member by name</span>
                <input className="field" value={q} maxLength={40} placeholder="At least 2 letters" onChange={(e) => setQ(e.target.value)} />
              </label>
              {found.length > 0 && <ul className="card divide-y">{found.map(row)}</ul>}
              {q.trim().length >= 2 && found.length === 0 && (
                <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>Nobody by that name has an account yet.</p>
              )}
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">Officer log, last 50</p>
            {data.log.length === 0 ? (
              <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>Nothing yet.</p>
            ) : (
              <ul className="card divide-y">
                {data.log.map((r, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3 p-3 text-sm">
                    <span className="mono text-xs" style={{ color: 'var(--ink-faint)', minWidth: 110 }}>{when(r.ts)}</span>
                    <b>{r.officer_name}</b>
                    <span style={{ color: 'var(--ink-soft)' }}>{r.action === 'write' ? r.detail : `${r.action}: ${r.detail}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
