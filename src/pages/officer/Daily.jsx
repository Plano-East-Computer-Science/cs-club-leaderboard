/**
 * Officer screen for the daily problem (C3): the next 14 days and what each
 * will show. Pin a live problem to a date, or unpin to go back to the automatic pick.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/bits.jsx';

export default function DailyAdmin() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState({}); // date -> chosen problem id (unsaved)

  const load = useCallback(() => {
    api.get('/admin/hub/daily/plan').then(setPlan).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!plan) return error ? <p className="mono text-sm" style={{ color: '#c42e2e' }}>{error}</p> : <Spinner />;

  return (
    <section className="grid gap-3" style={{ marginTop: 28 }} aria-labelledby="daily-admin-h">
      <header>
        <p className="eyebrow">Daily problem</p>
        <h2 id="daily-admin-h" className="text-xl font-semibold">Next 14 days</h2>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Days without a pin are chosen automatically from live problems at level 1 to 3, never repeating inside 30 days.
          The day changes at midnight Central.
        </p>
      </header>
      {error && <p className="mono text-sm" role="alert" style={{ color: '#c42e2e' }}>{error}</p>}
      <ul className="grid gap-2">
        {plan.days.map((day) => (
          <li key={day.date} className="card flex flex-wrap items-center gap-3 p-3">
            <span className="mono text-sm" style={{ minWidth: '6.5rem' }}>{day.date}</span>
            <span className="min-w-0 flex-1 text-sm">
              {day.problem ? `${day.problem.title} (level ${day.problem.difficulty})` : 'No problem available'}
              {day.pinned && <span className="chip" style={{ marginLeft: 8 }}>pinned</span>}
            </span>
            <label className="sr-only" htmlFor={`pin-${day.date}`}>Problem to pin on {day.date}</label>
            <select
              id={`pin-${day.date}`}
              className="field"
              style={{ maxWidth: '16rem' }}
              value={pick[day.date] ?? ''}
              onChange={(e) => setPick({ ...pick, [day.date]: e.target.value })}
            >
              <option value="">Pick a problem</option>
              {plan.options.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.difficulty})</option>)}
            </select>
            <button
              type="button"
              className="btn"
              disabled={!pick[day.date]}
              onClick={() => act(() => api.put(`/admin/hub/daily/pins/${day.date}`, { problemId: Number(pick[day.date]) }).then(() => setPick({ ...pick, [day.date]: '' })))}
            >
              Pin
            </button>
            {day.pinned && (
              <button type="button" className="btn btn-ghost" onClick={() => act(() => api.del(`/admin/hub/daily/pins/${day.date}`))}>
                Unpin
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
