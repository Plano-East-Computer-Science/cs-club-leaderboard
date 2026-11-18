/**
 * Officer ship-cycle screen (D1). Create a cycle (optionally from an ideas-board
 * idea), open it, move it to demo, tick which entries demoed, and close it.
 * Closing pays a ship to each member of each demoed entry through the ledger.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const NEXT = { draft: ['open', 'Open it'], open: ['demo', 'Start the demo'], demo: ['closed', 'Close and award ships'] };

export default function Cycles() {
  const [cycles, setCycles] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const blank = { title: '', theme: '', rubric: '', starts_on: '', demo_on: '', idea_id: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const load = useCallback(() => {
    api.get('/admin/hub/cycles').then((d) => setCycles(d.cycles)).catch((e) => setError(e.message));
    api.get('/ideas').then((d) => setIdeas(d.ideas.filter((i) => i.kind === 'project' && i.status === 'open'))).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const say = (text, bad) => setNote({ text, bad });
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/hub/cycles', { ...f, idea_id: f.idea_id ? Number(f.idea_id) : undefined });
      setF(blank);
      say('Created as a draft.');
      load();
    } catch (err) {
      say(err.message, true);
    }
  };
  const fromIdea = (e) => {
    const idea = ideas.find((i) => String(i.id) === e.target.value);
    setF((s) => ({ ...s, idea_id: e.target.value, theme: idea ? idea.body : s.theme, title: s.title || (idea ? idea.body.slice(0, 60) : '') }));
  };
  const move = async (c, to) => {
    if (to === 'closed' && !window.confirm(`Close "${c.title}"? Every member of an entry ticked as demoed gets a ship.`)) return;
    try {
      const r = await api.post(`/admin/hub/cycles/${c.id}/status`, { status: to });
      say(to === 'closed' ? `Closed. ${r.paid} ships awarded${r.skipped ? `, ${r.skipped} members have no leaderboard entry yet` : ''}.` : `Now ${to}.`);
      load();
    } catch (err) {
      say(err.message, true);
    }
  };
  const tick = async (c, e, demoed) => {
    try {
      await api.post(`/admin/hub/cycles/${c.id}/entries/${e.id}/demoed`, { demoed });
      load();
    } catch (err) {
      say(err.message, true);
    }
  };

  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Ship cycles</p>
        <h2 className="display mt-1 text-2xl font-bold">Cycles</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          A cycle runs draft, open, demo, closed. Only one runs at a time. At the demo, tick each entry that showed its work; closing awards a ship to every
          member of those entries, once.
        </p>
      </div>
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}

      <form onSubmit={create} className="card mb-4 grid gap-3 p-4">
        <label className="grid gap-1">
          <span className="eyebrow">Start from an idea (optional, marks it planned)</span>
          <select className="field" value={f.idea_id} onChange={fromIdea}>
            <option value="">No idea, write it fresh</option>
            {ideas.map((i) => <option key={i.id} value={i.id}>{i.votes} votes: {i.body.slice(0, 80)}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Title</span>
          <input className="field" maxLength={80} value={f.title} onChange={set('title')} required />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">Theme</span>
          <textarea className="field" rows={2} maxLength={400} value={f.theme} onChange={set('theme')} />
        </label>
        <label className="grid gap-1">
          <span className="eyebrow">How it is judged</span>
          <input className="field" maxLength={600} value={f.rubric} onChange={set('rubric')} placeholder="Does it run, is it clear, did you finish something" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1"><span className="eyebrow">Starts</span><input className="field" type="date" value={f.starts_on} onChange={set('starts_on')} /></label>
          <label className="grid gap-1"><span className="eyebrow">Demo day</span><input className="field" type="date" value={f.demo_on} onChange={set('demo_on')} /></label>
        </div>
        <div><button className="btn btn-primary">Create draft</button></div>
      </form>

      {!cycles && !error && <Spinner label="Loading cycles" />}
      {cycles && cycles.length === 0 && <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No cycles yet.</p>}
      {cycles && cycles.length > 0 && (
        <ul className="card divide-y">
          {cycles.map((c) => (
            <li key={c.id} className="grid gap-2 p-4 text-sm">
              <span className="flex flex-wrap items-center gap-3">
                <b style={{ color: 'var(--gold)' }}>{c.title}</b>
                <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{c.status}{c.demo_on ? ` · demo ${c.demo_on}` : ''}</span>
                {NEXT[c.status] && (
                  <button className="btn btn-primary ml-auto" onClick={() => move(c, NEXT[c.status][0])}>{NEXT[c.status][1]}</button>
                )}
              </span>
              {c.entries.length === 0 && c.status !== 'draft' && <span style={{ color: 'var(--ink-soft)' }}>No entries yet.</span>}
              {c.entries.map((e) => (
                <label key={e.id} className="flex flex-wrap items-center gap-2" style={{ color: 'var(--ink-soft)' }}>
                  <input
                    type="checkbox"
                    checked={e.demoed}
                    disabled={c.status !== 'open' && c.status !== 'demo'}
                    onChange={(ev) => tick(c, e, ev.target.checked)}
                    aria-label={`${e.title} demoed`}
                  />
                  <span><b>{e.title}</b> <span className="mono text-xs">{e.team}</span></span>
                  <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{e.votes} {e.votes === 1 ? 'vote' : 'votes'}</span>
                </label>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
