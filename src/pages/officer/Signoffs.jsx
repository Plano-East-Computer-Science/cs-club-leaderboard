/**
 * D6 officer screen: write one sentence about a member. It shows on their
 * portfolio (when they make it public) with your name and the date. Only say
 * what you have seen the member do.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

export default function Signoffs() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [member, setMember] = useState(null);
  const [line, setLine] = useState('');
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/hub/portfolio/signoffs').then((d) => setRows(d.signoffs)).catch((e) => setError(e.message));
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

  const sign = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/hub/portfolio/signoffs', { user_id: member.id, line });
      setNote({ text: `Signed for ${member.name}.` });
      setMember(null);
      setLine('');
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this line from the portfolio?')) return;
    try {
      await api.del(`/admin/hub/portfolio/signoffs/${id}`);
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Portfolios</p>
        <h2 className="display mt-1 text-2xl font-bold">Signed lines</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          One sentence about a member, shown on their portfolio with your name and today's date. Up to three per member. Write only what you have seen them do.
        </p>
      </div>
      <form onSubmit={search} className="mb-3 flex flex-wrap gap-2">
        <input className="field" style={{ width: 'auto', flex: '1 1 200px' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member name" aria-label="Find a member by name" />
        <button className="btn" disabled={q.trim().length < 2}>Find</button>
      </form>
      {found.length > 0 && !member && (
        <ul className="card divide-y mb-3">
          {found.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <b>{m.name}</b>
              <button className="btn" onClick={() => { setMember(m); setFound([]); }}>Write a line</button>
            </li>
          ))}
        </ul>
      )}
      {member && (
        <form onSubmit={sign} className="card mb-3 grid gap-2 p-3">
          <label className="text-sm" htmlFor="signoff-line">About {member.name}</label>
          <textarea id="signoff-line" className="field" rows={3} maxLength={200} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Ran the debugging station for new members three weeks in a row." />
          <div className="flex gap-2">
            <button className="btn pri" disabled={line.trim().length < 10}>Sign it</button>
            <button type="button" className="btn" onClick={() => setMember(null)}>Cancel</button>
          </div>
        </form>
      )}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {!rows && !error && <Spinner label="Loading signed lines" />}
      {rows && rows.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No signed lines yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <b>{r.member}</b>: {r.line}
                <span className="mono ml-2 text-xs" style={{ color: 'var(--ink-faint)' }}>{r.officer_name}, {r.date}</span>
              </span>
              <button className="btn" onClick={() => remove(r.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
