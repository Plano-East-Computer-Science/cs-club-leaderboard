/**
 * Officer analytics (G2). The server does all the counting (one call); this
 * only draws. Bars are inline SVG rows with real text beside them, so labels
 * stay readable at phone width and a screen reader gets a list, not a picture.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner, ErrorNote } from '../../components/bits.jsx';

const short = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const KIND = { attend: 'meetings attended', active: 'meeting bonuses', compete: 'competed', place: 'placed', ship: 'shipped', mentor: 'mentored', solve: 'problems solved', idea: 'ideas', daily: 'daily problems', duel: 'duels', manual: 'manual awards', dropin: 'drop-ins', quest: 'quests' };

function Bars({ rows, label, value, sub }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="an-bars">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="an-l">{label(r)}<span className="d"> {sub?.(r)}</span></span>
          <svg className="an-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <rect className="an-track" x="0" y="0" width="100" height="10" />
            <rect className="an-fill" x="0" y="0" width={(value(r) / max) * 100} height="10" />
          </svg>
          <b className="an-n">{value(r)}</b>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  const [season, setSeason] = useState('');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    api.get(`/admin/hub/analytics${season ? `?season=${season}` : ''}`).then(setD).catch((e) => setError(e.message));
  }, [season]);

  const r = d?.retention;
  return (
    <section>
      <div className="mb-4">
        <p className="eyebrow">Analytics</p>
        <h2 className="display mt-1 text-2xl font-bold">How the season is going</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Attendance is room check-ins. Use it to answer "did duel night work?" and to find people to invite in person.
        </p>
      </div>
      {error && <ErrorNote onRetry={() => setSeason(season)}>{error}</ErrorNote>}
      {!d && !error && <Spinner label="Loading analytics" />}
      {d && (
        <div className="an">
          <label className="cadm-sel">
            <span>Season</span>
            <select className="field" value={d.season} onChange={(e) => setSeason(e.target.value)}>
              {d.seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div className="card p-4">
            <h3 className="font-bold">Attendance per meeting</h3>
            {d.meetings.length ? (
              <Bars rows={d.meetings} label={(m) => m.title || m.code} sub={(m) => short(m.date)} value={(m) => m.n} />
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No meetings in this season yet.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Average check-ins by kind of meeting</h3>
            {d.templates?.length ? (
              <Bars rows={d.templates} label={(t) => t.name} sub={(t) => `${t.meetings} meeting${t.meetings === 1 ? '' : 's'}`} value={(t) => t.avg} />
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No meetings in this season yet.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Retention</h3>
            {r.pct == null ? (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Needs at least one meeting.</p>
            ) : (
              <>
                <p className="an-big"><b>{r.pct}%</b> <span className="d">{r.kept} of {r.base}</span></p>
                <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {r.base} people came in the first month (from {short(r.firstMeeting)}). {r.kept} of them came again since {short(r.recentFrom)}.
                  {r.overlap && ' The season is young, so those two windows overlap and this number runs high.'}
                </p>
              </>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Not seen in 3 weeks <span className="d">({d.notSeen.length})</span></h3>
            {d.notSeen.length ? (
              <table className="cadm-tbl">
                <thead><tr><th scope="col">Member</th><th scope="col">Last meeting</th><th scope="col">Days ago</th></tr></thead>
                <tbody>{d.notSeen.map((m) => <tr key={m.userId}><th scope="row">{m.name}</th><td>{short(m.last)}</td><td>{m.days}</td></tr>)}</tbody>
              </table>
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>Everyone who has come has been back within 3 weeks.</p>
            )}
            {d.neverCame > 0 && <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>{d.neverCame} accounts have never checked in.</p>}
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Activity this season</h3>
            {d.activity.length ? (
              <Bars rows={d.activity} label={(a) => KIND[a.kind] ?? a.kind} sub={(a) => `${a.points} pts`} value={(a) => a.n} />
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No approved activity yet.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Ideas that happened</h3>
            {d.ideas.length ? (
              <ul className="an-ideas">
                {d.ideas.map((i) => (
                  <li key={i.id}>
                    <span className={`an-st ${i.status}`}>{i.status}</span> {i.body.length > 110 ? `${i.body.slice(0, 110)}...` : i.body}
                    <span className="d"> {i.author}, {i.votes} vote{i.votes === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>No idea is marked planned or done yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
