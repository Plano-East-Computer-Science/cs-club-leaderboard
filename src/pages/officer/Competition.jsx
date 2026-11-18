/**
 * Officer screen for a club competition (E4): pick the prep plan (Arena rungs
 * and bank problems) and enter results. One form records who took part and who
 * placed, and the ledger pays each once (ref comp:<id>), approved as you.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

function Picker({ label, items, chosen, onChange }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => items.filter((i) => `${i.title} ${i.sub}`.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);
  const toggle = (id) => onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  return (
    <fieldset className="cadm-pick">
      <legend>{label} <span className="d">({chosen.length} picked)</span></legend>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${label.toLowerCase()}`} aria-label={`Filter ${label.toLowerCase()}`} />
      <div className="cadm-box">
        {shown.slice(0, 80).map((i) => (
          <label key={i.id}>
            <input type="checkbox" checked={chosen.includes(i.id)} onChange={() => toggle(i.id)} />
            <span>{i.title} <span className="d">{i.sub}</span></span>
          </label>
        ))}
        {!shown.length && <p className="d">Nothing matches.</p>}
        {shown.length > 80 && <p className="d">Showing 80 of {shown.length}. Narrow the filter.</p>}
      </div>
    </fieldset>
  );
}

export default function CompetitionAdmin() {
  const [list, setList] = useState(null);
  const [id, setId] = useState('');
  const [m, setM] = useState(null);
  const [rungs, setRungs] = useState([]);
  const [problems, setProblems] = useState([]);
  const [plan, setPlan] = useState({ rungs: [], problems: [] });
  const [rows, setRows] = useState({});
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    api.get('/competitions').then((d) => setList(d.competitions)).catch((e) => setError(e.message));
    api.get('/admin/hub/board/rungs').then((d) => setRungs(d.rungs.filter((r) => !r.hidden).map((r) => ({ id: r.id, title: r.title, sub: `${r.track}, ${r.tier}` })))).catch(() => {});
    api.get('/admin/hub/problems?status=live').then((d) => setProblems(d.problems.map((p) => ({ id: p.id, title: p.title, sub: `difficulty ${p.difficulty}` })))).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!id) return setM(null);
    setM(null);
    setNote(null);
    api.get(`/admin/hub/competitions/${id}/manage`).then((d) => {
      setM(d);
      setPlan(d.prep);
      setLabel(d.competition.result || '');
      setRows(Object.fromEntries(d.roster.map((r) => [r.userId, { participated: r.participated, placement: r.placement ?? '' }])));
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const savePlan = async () => {
    try {
      await api.put(`/admin/hub/competitions/${id}/prep`, plan);
      setNote({ text: 'Prep plan saved.' });
    } catch (e) {
      setNote({ text: e.message, bad: true });
    }
  };

  const saveResults = async (e) => {
    e.preventDefault();
    setNote(null);
    try {
      const results = m.roster.map((r) => ({ userId: r.userId, participated: rows[r.userId].participated, placement: rows[r.userId].placement }));
      const d = await api.post(`/admin/hub/competitions/${id}/results`, { result: label, results });
      const bits = [`${d.compete} competed, ${d.place} placed, ${d.points} points.`];
      if (d.already) bits.push(`${d.already} were already recorded.`);
      if (d.held.length) bits.push(`Waiting: ${d.held.join('; ')}.`);
      setNote({ text: bits.join(' ') });
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };
  const set = (uid, patch) => setRows((r) => ({ ...r, [uid]: { ...r[uid], ...patch } }));

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Competitions</p>
        <h2 className="display mt-1 text-2xl font-bold">Prep plan and results</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Pick what the team should practise, then after the event record who took part and who placed. Points are paid once
          per person and approved as you. Saving again only adds what is new.
        </p>
      </div>
      {error && <ErrorNote onRetry={() => location.reload()}>{error}</ErrorNote>}
      {!list && !error && <Spinner label="Loading competitions" />}
      {list && (
        <label className="cadm-sel">
          <span>Competition</span>
          <select className="field" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Choose one</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === 'past' ? ' (results in)' : ''}</option>)}
          </select>
        </label>
      )}
      {id && !m && !error && <Spinner label="Loading roster" />}
      {m && (
        <div className="cadm">
          <div className="card p-4">
            <h3 className="font-bold">Prep plan</h3>
            <div className="cadm-picks">
              <Picker label="Arena rungs" items={rungs} chosen={plan.rungs} onChange={(v) => setPlan({ ...plan, rungs: v })} />
              <Picker label="Bank problems" items={problems} chosen={plan.problems} onChange={(v) => setPlan({ ...plan, problems: v })} />
            </div>
            <button type="button" className="btn btn-primary" onClick={savePlan}>Save plan</button>
          </div>

          <form className="card p-4" onSubmit={saveResults}>
            <h3 className="font-bold">Results</h3>
            {!m.roster.length ? (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Nobody has joined the roster yet.</p>
            ) : (
              <table className="cadm-tbl">
                <thead><tr><th scope="col">Member</th><th scope="col">Took part</th><th scope="col">Placement</th></tr></thead>
                <tbody>
                  {m.roster.map((r) => (
                    <tr key={r.userId}>
                      <th scope="row">{r.name}</th>
                      <td><input type="checkbox" aria-label={`${r.name} took part`} checked={rows[r.userId]?.participated || rows[r.userId]?.placement !== ''} onChange={(e) => set(r.userId, { participated: e.target.checked, ...(e.target.checked ? {} : { placement: '' }) })} /></td>
                      <td><input className="field" type="number" min="1" max="999" inputMode="numeric" aria-label={`${r.name} placement`} placeholder="none" value={rows[r.userId]?.placement ?? ''} onChange={(e) => set(r.userId, { placement: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <label className="cadm-sel">
              <span>Result line on the public page (optional)</span>
              <input className="field" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="2nd place, regional" />
            </label>
            <button className="btn btn-primary" disabled={!m.roster.length}>Record results</button>
          </form>
        </div>
      )}
      {note && <p className="mono mt-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}
    </section>
  );
}
