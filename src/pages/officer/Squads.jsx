/**
 * Officer squads (A5). Officers assign mixed-skill squads each season. The
 * "suggest" button snake-drafts by lifetime points and avoids last season's
 * pairings where it can; nothing is saved until "Use these squads". Move a
 * member by dragging their name onto a squad, or with the select next to it.
 * A squad's score is its median member's season points.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';
import { seasonOf, prevSeason, seasonLabel } from '../../../shared/points.js';

const PALETTE = ['#ffc20e', '#6b97ff', '#2dd4bf', '#ff6253', '#b093ff', '#3ecf7a', '#f4f1e8', '#ff9f43'];
const NAMES = ['Ada', 'Turing', 'Hopper', 'Knuth', 'Lovelace', 'Dijkstra', 'Ritchie', 'Hamilton', 'Liskov', 'Shannon'];

export default function Squads() {
  const now = seasonOf(new Date());
  const [season, setSeason] = useState(now);
  const [d, setD] = useState(null);
  const [plan, setPlan] = useState(null);
  const [count, setCount] = useState('');
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [form, setForm] = useState({ name: '', color: PALETTE[0] });
  const [over, setOver] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.get(`/admin/hub/squads?season=${season}`).then(setD).catch((e) => setError(e.message));
  }, [season]);
  useEffect(() => {
    setD(null);
    setPlan(null);
    load();
  }, [load]);

  const say = (text, bad) => setNote({ text, bad });
  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) say(ok);
      load();
    } catch (err) {
      say(err.message, true);
    }
  };

  const move = (studentId, squadId) => run(() => api.post('/admin/hub/squads/move', { season, studentId, squadId }));
  const create = (e) => {
    e.preventDefault();
    run(() => api.post('/admin/hub/squads', { season, ...form }), 'Squad created.');
    setForm({ name: '', color: PALETTE[((d?.squads.length ?? 0) + 1) % PALETTE.length] });
  };
  const suggest = async () => {
    try {
      setPlan(await api.post('/admin/hub/squads/suggest', { season, count: Number(count) || undefined }));
      setNote(null);
    } catch (err) {
      say(err.message, true);
    }
  };
  const apply = () =>
    run(async () => {
      await api.post('/admin/hub/squads/apply', {
        season,
        squads: plan.squads.map((s, i) => ({ name: `Team ${NAMES[i % NAMES.length]}`, color: PALETTE[i % PALETTE.length], members: s.members.map((m) => m.id) })),
      });
      setPlan(null);
    }, 'Squads saved for the season.');

  const squads = d?.squads ?? [];
  const options = (current) => (
    <>
      <option value="">no squad</option>
      {squads.map((s) => (
        <option key={s.id} value={s.id} disabled={s.id === current}>{s.name}</option>
      ))}
    </>
  );
  const Member = ({ m, squadId }) => (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(m.id))}
      className="flex items-center justify-between gap-2 py-1 text-sm"
      style={{ cursor: 'grab' }}
    >
      <span>{m.name} <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{m.points} / {m.lifetime}</span></span>
      <select
        className="field"
        style={{ width: 'auto', padding: '2px 4px', fontSize: 12 }}
        aria-label={`Move ${m.name}`}
        value=""
        onChange={(e) => move(m.id, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="" disabled hidden>move</option>
        {options(squadId)}
      </select>
    </li>
  );
  const dropZone = (squadId) => ({
    onDragOver: (e) => {
      e.preventDefault();
      setOver(squadId ?? 'none');
    },
    onDragLeave: () => setOver(null),
    onDrop: (e) => {
      e.preventDefault();
      setOver(null);
      move(Number(e.dataTransfer.getData('text/plain')), squadId);
    },
  });

  return (
    <section id="squads">
      <div className="mb-4">
        <p className="eyebrow">Squads</p>
        <h2 className="display mt-1 text-2xl font-bold">Squads for the season</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Mix levels: a squad scores its middle member&apos;s season points, so it only wins by bringing everyone along. Reshuffle each
          season. Numbers after a name are season / lifetime points.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Season">
        {[now, prevSeason(now)].map((s) => (
          <button key={s} className={`btn ${season === s ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={season === s} onClick={() => setSeason(s)}>
            {seasonLabel(s)}
          </button>
        ))}
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {note && <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>}
      {!d && !error && <Spinner label="Loading squads" />}

      {d && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <form className="flex flex-wrap items-end gap-2" onSubmit={create}>
              <label className="grid gap-1 text-xs">
                <span style={{ color: 'var(--ink-soft)' }}>New squad</span>
                <input className="field" style={{ width: 160 }} maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Team Hopper" />
              </label>
              <label className="grid gap-1 text-xs">
                <span style={{ color: 'var(--ink-soft)' }}>Colour</span>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 44, height: 34, background: 'transparent', border: '1px solid var(--line2)' }} />
              </label>
              <button className="btn btn-ghost" type="submit">Create</button>
            </form>
            <span className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs">
                <span style={{ color: 'var(--ink-soft)' }}>How many squads</span>
                <input className="field" style={{ width: 90 }} type="number" min={1} max={30} value={count} onChange={(e) => setCount(e.target.value)} placeholder="auto" />
              </label>
              <button className="btn btn-primary" onClick={suggest}>Suggest balanced squads</button>
            </span>
          </div>

          {plan && (
            <div className="card mb-4 p-4">
              <p className="text-sm">
                Suggestion for {seasonLabel(season)}: snake draft by lifetime points.{' '}
                {plan.squads.some((s) => s.repeats) ? 'A few pairs from last season could not be split.' : 'No pair repeats last season.'}
              </p>
              <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
                {plan.squads.map((s, i) => (
                  <div key={i} className="text-sm">
                    <b style={{ color: PALETTE[i % PALETTE.length] }}>Team {NAMES[i % NAMES.length]}</b>
                    <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}> median {s.median}</span>
                    <ul>{s.members.map((m) => <li key={m.id}>{m.name} <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{m.lifetime}</span></li>)}</ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-primary" onClick={apply}>Use these squads</button>
                <button className="btn btn-ghost" onClick={() => setPlan(null)}>Discard</button>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>Using them replaces every squad this season.</p>
            </div>
          )}

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))' }}>
            {squads.map((s) => (
              <div key={s.id} className="card p-3" {...dropZone(s.id)} style={{ borderTop: `3px solid ${s.color}`, outline: over === s.id ? '2px dashed var(--gold)' : undefined }}>
                <div className="flex items-baseline justify-between gap-2">
                  <b>{s.name}</b>
                  <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>#{s.place} · score {s.score}</span>
                </div>
                <ul className="mt-2">{s.members.map((m) => <Member key={m.id} m={{ ...m }} squadId={s.id} />)}</ul>
                {!s.members.length && <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>Drop members here.</p>}
                <button className="btn btn-ghost mt-2" style={{ fontSize: 12 }} onClick={() => run(() => api.del(`/admin/hub/squads/${s.id}`), 'Squad removed.')}>
                  Remove squad
                </button>
              </div>
            ))}
            <div className="card p-3" {...dropZone(null)} style={{ outline: over === 'none' ? '2px dashed var(--gold)' : undefined }}>
              <b>No squad</b> <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>{d.unassigned.length}</span>
              <ul className="mt-2">{d.unassigned.map((m) => <Member key={m.id} m={m} squadId={null} />)}</ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
