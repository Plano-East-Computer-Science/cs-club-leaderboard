/**
 * Merge duplicate leaderboard entries (A1). Since every account gets its own
 * entry at sign-up, a member who was already on the board ends up twice. This
 * folds one entry into the other in a single transaction: points, activity,
 * badges and linked accounts move, and the duplicate is deactivated.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function Merge() {
  const [students, setStudents] = useState([]);
  const [keep, setKeep] = useState('');
  const [from, setFrom] = useState('');
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/students').then((d) => setStudents(d.leaderboard)).catch((e) => setNote({ text: e.message, bad: true }));
  }, []);
  useEffect(load, [load]);

  const label = (s) => `${s.name} (#${s.id}, ${s.points} pts)`;
  const byId = (id) => students.find((s) => s.id === Number(id));

  const merge = async (e) => {
    e.preventDefault();
    const a = byId(keep);
    const b = byId(from);
    if (!window.confirm(`Move everything from ${b.name} into ${a.name}? ${b.name} disappears from the board.`)) return;
    setBusy(true);
    try {
      await api.post('/admin/hub/students/merge', { keep: a.id, from: b.id });
      setNote({ text: `Merged ${b.name} into ${a.name}.` });
      setKeep('');
      setFrom('');
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Accounts</p>
        <h2 className="display mt-1 text-2xl font-bold">Merge duplicate entries</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Same person on the board twice? Pick the entry to keep and the duplicate. Points, badges and accounts move
          over. Attendance both entries have for the same meeting counts once.
        </p>
      </div>
      <form onSubmit={merge} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="grid min-w-56 flex-1 gap-1.5">
          <span className="eyebrow">Keep</span>
          <select className="field" required value={keep} onChange={(e) => setKeep(e.target.value)}>
            <option value="">Pick an entry</option>
            {students.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
          </select>
        </label>
        <label className="grid min-w-56 flex-1 gap-1.5">
          <span className="eyebrow">Fold in and remove</span>
          <select className="field" required value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Pick the duplicate</option>
            {students.filter((s) => String(s.id) !== keep).map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
          </select>
        </label>
        <button className="btn btn-danger" disabled={busy || !keep || !from || keep === from}>
          {busy ? 'Merging' : 'Merge'}
        </button>
      </form>
      {note && (
        <p className="mono mt-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>
      )}
    </section>
  );
}
