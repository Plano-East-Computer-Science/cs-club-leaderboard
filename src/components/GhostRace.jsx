/**
 * C7: pick a ghost (a clubmate's recorded solve time, first name only, or the
 * club median) and watch its bar run at their pace while you solve. The page
 * that owns the editor starts the clock; this shows the picker, the bar and
 * the result, and lists your past races.
 *
 * Props:
 *   slug     problem slug
 *   race     null | { ghost: { id, name, ms }, start: epoch ms }, owned by the page
 *   onStart  (ghost) => void
 *   result   null | { ms, won, diffMs, ghostMs, ghostName } after the solve
 *   refresh  changes after a result so the history reloads
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatMs } from '../../shared/daily.js';
import { ghostProgress } from '../../shared/ghost.js';

const sec = (ms) => formatMs(ms);

export default function GhostRace({ slug, race, onStart, result, refresh = 0 }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.get(`/problems/${encodeURIComponent(slug)}/ghosts`).then(setD).catch((e) => setError(e.status === 401 ? 'Sign in to race a clubmate.' : e.message));
  }, [slug, refresh]);

  useEffect(() => {
    if (!race || result) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [race, result]);

  const options = d
    ? [...(d.medianMs != null ? [{ id: 'median', name: 'the club median', ms: d.medianMs }] : []), ...d.ghosts]
    : [];

  const elapsed = race ? now - race.start : 0;
  const frac = race ? ghostProgress(result ? result.ghostMs : elapsed, race.ghost.ms) : 0;

  return (
    <section className="pn in" aria-label="Ghost race">
      <div className="pane-h"><span><b>ghost.log</b></span><span className="hide-xs">race a recorded solve</span></div>
      <div className="pn-b">
        {error && <p className="d" role="status">{error}</p>}
        {!error && !d && <p className="d">Loading ghosts...</p>}

        {d && !race && (
          options.length === 0
            ? <p className="d">Nobody has a recorded time on this problem yet. Solve it and you become the first ghost.</p>
            : (
              <>
                <p className="d">Pick someone to race. Their bar runs at their pace from the moment you start.</p>
                <ul className="gh-pick">
                  {options.map((g) => (
                    <li key={g.id}>
                      <button type="button" className="btn" onClick={() => onStart(g)}>
                        Race {g.name} <span className="d">{sec(g.ms)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
        )}

        {race && (
          <div>
            <p className="mono">
              Racing <b className="g">{race.ghost.name}</b> ({sec(race.ghost.ms)}). You: {sec(result ? result.ms : elapsed)}
            </p>
            <div
              className="gh-bar"
              role="progressbar"
              aria-label={`${race.ghost.name}'s progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(frac * 100)}
            >
              <i style={{ width: `${frac * 100}%` }} />
            </div>
            {!result && frac >= 1 && <p className="mono d" role="status">{race.ghost.name} has finished. Keep going, your time still counts.</p>}
            {result && (
              <p className="mono" role="status" style={{ color: result.won ? 'var(--up)' : 'var(--down)' }}>
                {result.won
                  ? `You beat ${result.ghostName} by ${sec(result.diffMs)}.`
                  : `${result.ghostName} won by ${sec(result.diffMs)}.`}
              </p>
            )}
          </div>
        )}

        {d?.history?.length > 0 && (
          <div className="gh-hist">
            <p className="eb">Your races on this problem</p>
            <ul className="mono">
              {d.history.map((h, i) => (
                <li key={i}>{h.won ? 'won' : 'lost'} against {h.ghost_name}: {sec(h.ms)} to {sec(h.ghost_ms)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
