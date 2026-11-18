/**
 * Officer raffle and full standings (A6). Members at or above the first season
 * tier hold one ticket per season point. The draw runs on the server with a
 * crypto-random number and every draw is recorded; a second draw for the same
 * season is a redraw and needs a reason. The full ranked list lives here
 * because the public page only shows the top five and each member's
 * neighbours. Tier thresholds are edited here too.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';
import { seasonOf, prevSeason, seasonLabel } from '../../../shared/points.js';
import { TIER_NAMES } from '../../../shared/standings.js';

const when = (v) => new Date(`${String(v).replace(' ', 'T')}Z`).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Raffle() {
  const now = seasonOf(new Date());
  const [season, setSeason] = useState(now);
  const [d, setD] = useState(null);
  const [full, setFull] = useState(null);
  const [showFull, setShowFull] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [tiers, setTiers] = useState('');

  const load = useCallback(() => {
    setError(null);
    setD(null);
    api.get(`/admin/hub/raffle?season=${season}`).then(setD).catch((e) => setError(e.message));
    api.get(`/admin/hub/standings/full?season=${season}`).then(setFull).catch(() => setFull(null));
  }, [season]);
  useEffect(load, [load]);
  useEffect(() => {
    api.get('/admin/hub/season-tiers').then((x) => setTiers(x.tiers.join(', '))).catch(() => {});
  }, []);

  const draw = async () => {
    setBusy(true);
    setNote(null);
    try {
      const x = await api.post('/admin/hub/raffle/draw', { season, reason });
      setD(x);
      setReason('');
      setNote({ text: `Winner: ${x.winner.name}, holding ${x.winner.tickets} of ${x.total} tickets.` });
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
    setBusy(false);
  };

  const saveTiers = async (e) => {
    e.preventDefault();
    try {
      const list = tiers.split(/[\s,]+/).filter(Boolean).map(Number);
      const x = await api.put('/admin/hub/season-tiers', { tiers: list });
      setTiers(x.tiers.join(', '));
      setNote({ text: 'Tiers saved.' });
      load();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    }
  };

  const drawn = d?.draws?.length > 0;

  return (
    <section id="raffle">
      <div className="mb-4">
        <p className="eyebrow">Standings</p>
        <h2 className="display mt-1 text-2xl font-bold">Season raffle and full list</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Everyone at {TIER_NAMES[0]} or above holds one ticket per season point. The server draws the winner and logs every draw. Draw
          again only with a reason, which is kept.
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
      {note && (
        <p className="mono mb-3 text-xs" role="status" style={{ color: note.bad ? 'var(--down)' : 'var(--up)' }}>{note.text}</p>
      )}
      {!d && !error && <Spinner label="Loading raffle" />}

      {d && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
          <div className="card p-4">
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
              {d.entries.length} entrant{d.entries.length === 1 ? '' : 's'}, {d.total} tickets, first tier {d.firstTier} pts
            </p>
            <ul className="mt-3 grid gap-1 text-sm" aria-label="Ticket holders">
              {d.entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{e.name}</span>
                  <span className="mono" style={{ color: 'var(--gold)' }}>
                    {e.tickets} <span style={{ color: 'var(--ink-faint)' }}>({d.total ? Math.round((e.tickets / d.total) * 100) : 0}%)</span>
                  </span>
                </li>
              ))}
              {!d.entries.length && <li style={{ color: 'var(--ink-soft)' }}>Nobody has reached the first tier yet.</li>}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {drawn && (
                <input
                  className="field"
                  style={{ flex: '1 1 200px', width: 'auto' }}
                  maxLength={200}
                  placeholder="Reason for redrawing"
                  aria-label="Reason for redrawing"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
              <button className="btn btn-primary" disabled={busy || !d.entries.length || (drawn && reason.trim().length < 3)} onClick={draw}>
                {drawn ? 'Redraw' : 'Draw a winner'}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Draw log</p>
            <ol className="mt-3 grid gap-3 text-sm">
              {d.draws.map((x, i) => (
                <li key={x.id}>
                  <b style={{ color: i === 0 ? 'var(--gold)' : undefined }}>{x.student_name}</b>
                  <span className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {' '}{x.tickets}/{x.total_tickets} tickets, {x.entrants} entrants, {when(x.drawn_at)} by {x.drawn_name}
                  </span>
                  {x.reason && <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>Redraw reason: {x.reason}</div>}
                  {i > 0 && <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>Superseded</div>}
                </li>
              ))}
              {!d.draws.length && <li style={{ color: 'var(--ink-soft)' }}>No draw yet for {d.label}.</li>}
            </ol>
          </div>

          <form className="card p-4" onSubmit={saveTiers}>
            <label className="mono text-xs" htmlFor="season-tiers" style={{ color: 'var(--ink-soft)' }}>
              Season tiers, lowest first (1 to 5 numbers)
            </label>
            <div className="mt-2 flex gap-2">
              <input id="season-tiers" className="field" value={tiers} onChange={(e) => setTiers(e.target.value)} placeholder="60, 120, 200" />
              <button className="btn btn-ghost" type="submit">Save</button>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>Names: {TIER_NAMES.join(', ')}. The first tier is the raffle line.</p>
          </form>
        </div>
      )}

      <div className="mt-6">
        <button className="btn btn-ghost" aria-expanded={showFull} onClick={() => setShowFull(!showFull)}>
          {showFull ? 'Hide' : 'Show'} the full ranked list ({full?.rows.length ?? 0})
        </button>
        {showFull && full && (
          <div className="card mt-3" style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" aria-label="Full standings">
              <thead>
                <tr className="mono text-xs" style={{ color: 'var(--ink-soft)', textAlign: 'left' }}>
                  <th className="p-2">#</th><th className="p-2">member</th><th className="p-2">rank</th><th className="p-2" style={{ textAlign: 'right' }}>season</th><th className="p-2" style={{ textAlign: 'right' }}>all time</th>
                </tr>
              </thead>
              <tbody>
                {full.rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="p-2 mono">{r.place}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.rank}</td>
                    <td className="p-2 mono" style={{ textAlign: 'right', color: 'var(--gold)' }}>{r.points}</td>
                    <td className="p-2 mono" style={{ textAlign: 'right' }}>{r.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
