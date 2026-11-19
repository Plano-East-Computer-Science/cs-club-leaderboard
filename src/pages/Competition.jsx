/**
 * One club competition (E4): what it is, who is signed up, and what to
 * practice first. Officers set the prep plan and enter results from the
 * officer console, not here.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { formatDate, daysUntil } from '../lib/format.js';
import { useReveal } from '../lib/ui.js';

const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')}`;

export default function Competition() {
  const { id } = useParams();
  const { user } = useUser();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useReveal();

  const load = useCallback(() => api.get(`/competitions/${id}`).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load, user?.id]);

  if (error) return <div className="state-note bad">{error}<br /><Link to="/competitions">All competitions</Link></div>;
  if (!d) return <div className="state-note">loading competition...</div>;

  const { competition: c, roster, prep } = d;
  const past = c.status === 'past';
  const days = c.event_date ? daysUntil(c.event_date) : null;

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      await (roster.mine ? api.del(`/competitions/${id}/roster`) : api.post(`/competitions/${id}/roster`));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={past ? 'competition --done' : 'competition'}
        title={c.name}
        lead={c.description}
        kv={
          <div className="kv">
            <div><span>date</span><strong>{c.event_date ? formatDate(c.event_date) : 'not set'}</strong></div>
            <div><span>{past ? 'result' : 'countdown'}</span><strong>{past ? c.result || 'posted' : days == null ? 'n/a' : days < 0 ? 'passed' : `${days} days`}</strong></div>
            <div><span>signed up</span><strong>{roster.count}</strong></div>
          </div>
        }
      />
      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap"><div className="cmp">
          <Pane file="roster" meta={`${roster.count} signed up`}>
            <div className="pn-b">
              {!d.signedIn ? (
                <p><Link to="/signin">Sign in</Link> to join the roster and see who else is on it.</p>
              ) : (
                <>
                  <ul className="cmp-roster" aria-label="Roster">
                    {roster.members.map((m, i) => (
                      <li key={i}>
                        {m.name}
                        {past && m.placement ? <span className="g"> {ord(m.placement)} place</span> : past && !m.participated ? <span className="d"> did not go</span> : null}
                      </li>
                    ))}
                    {!roster.members.length && <li className="d">Nobody yet. Be first.</li>}
                  </ul>
                  {!past && (
                    <button className={`btn ${roster.mine ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} aria-pressed={roster.mine} onClick={toggle}>
                      {roster.mine ? 'Leave the roster' : 'Join the roster'}
                    </button>
                  )}
                  {past && <p className="d">The roster is closed. Points for taking part and placing are on the standings.</p>}
                </>
              )}
            </div>
          </Pane>

          <Pane file="prep-plan" meta="what to practice">
            <div className="pn-b">
              {!prep.rungs.length && !prep.problems.length ? (
                <p className="d">The officers have not posted a plan yet.</p>
              ) : (
                <>
                  {prep.rungs.length > 0 && (
                    <>
                      <h3 className="cmp-h">Arena rungs</h3>
                      <ol className="cmp-list">
                        {prep.rungs.map((r) => (
                          <li key={r.id} className={r.done ? 'done' : ''}>
                            {r.url.startsWith('/') ? <Link to={r.url}>{r.title}</Link> : <a href={r.url} target="_blank" rel="noreferrer noopener">{r.title}</a>}
                            <span className="d"> {r.track}, {r.tier}</span>
                            {r.done && <span className="g"> done</span>}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                  {prep.problems.length > 0 && (
                    <>
                      <h3 className="cmp-h">Practice problems</h3>
                      <ol className="cmp-list">
                        {prep.problems.map((p) => (
                          <li key={p.id}>
                            <Link to={`/p/${p.slug}`}>{p.title}</Link>
                            <span className="d"> difficulty {p.difficulty} of 5</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </>
              )}
            </div>
          </Pane>
          {c.url && (
            <p className="d" style={{ marginTop: 14 }}>
              <a href={c.url} target="_blank" rel="noreferrer noopener">Official page</a>
            </p>
          )}
          <p style={{ marginTop: 14 }}><Link to="/competitions">&larr; all competitions</Link></p></div>
        </div>
      </section>
    </>
  );
}
