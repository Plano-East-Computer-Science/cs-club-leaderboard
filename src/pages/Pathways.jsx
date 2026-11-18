/**
 * Pathways (E5): goal pages. The list at /pathways, one goal at /pathways/:id
 * with its steps, what each is for, and whether you have done it. Steps the
 * club's records already prove tick themselves; the rest you tick by hand.
 * Ticks are private and earn no points.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { PATHWAYS, MAX_FOLLOW, pathwayOf, linkOf } from '../../shared/pathways.js';

/** Internal paths use the router; outside sites open in a new tab. */
function StepLink({ to, children }) {
  if (!to) return <span>{children}</span>;
  if (to.startsWith('/')) return <Link to={to}>{children}</Link>;
  return <a href={to} target="_blank" rel="noreferrer noopener">{children}</a>;
}

export default function Pathways() {
  const { user } = useUser();
  const [mine, setMine] = useState(null);
  useReveal();
  useEffect(() => {
    if (user) api.get('/me/pathways').then(setMine).catch(() => {});
  }, [user]);

  return (
    <>
      <PageHead
        eyebrow="ls pathways/"
        title="Pick a goal"
        lead="Each pathway is a short plan toward one goal, built from things the club already has: Arena rungs, competitions, ship cycles and good free sites. Follow one or two and your next step shows on Today."
        one
      />
      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap pw-grid">
          {PATHWAYS.map((p, i) => {
            const pr = mine?.progress[p.id];
            const on = mine?.following.includes(p.id);
            return (
              <Pane key={p.id} file={`${p.id}.md`} meta={on ? 'following' : `${p.steps.length} steps`} delay={i}>
                <div className="pn-b">
                  <h2 className="pw-t"><Link to={`/pathways/${p.id}`}>{p.title}</Link></h2>
                  <p className="d">{p.about}</p>
                  {pr && (
                    <p className="pw-prog">
                      <span className="g">{pr.done}</span> of {pr.total} done{on && <span className="g">, following</span>}
                    </p>
                  )}
                </div>
              </Pane>
            );
          })}
        </div>
        <div className="wrap">
          {!user && <p className="d" style={{ marginTop: 14 }}><Link to="/signin">Sign in</Link> to follow a pathway and keep track of your steps.</p>}
          <p className="d" style={{ marginTop: 14 }}>Not sure which goal is yours? <Link to="/compass">Take the compass</Link> first.</p>
        </div>
      </section>
    </>
  );
}

export function Pathway() {
  const { id } = useParams();
  const p = pathwayOf(id);
  const { user } = useUser();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useReveal();

  const load = useCallback(() => {
    if (user && p) api.get(`/me/pathways/${p.id}`).then(setD).catch((e) => setErr(e.message));
  }, [user, p]);
  useEffect(load, [load]);

  if (!p) return <div className="state-note bad">No such pathway.<br /><Link to="/pathways">All pathways</Link></div>;

  const state = Object.fromEntries((d?.steps ?? []).map((s) => [s.id, s]));
  const done = (d?.steps ?? []).filter((s) => s.done).length;
  const full = d && !d.following && d.followCount >= d.max;

  const act = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const follow = () => act(() => (d.following ? api.del(`/me/pathways/${p.id}/follow`) : api.post(`/me/pathways/${p.id}/follow`)));
  const tick = (step, on) => act(() => api.put(`/me/pathways/${p.id}/steps/${step}`, { done: on }));

  return (
    <>
      <PageHead
        eyebrow={`cat pathways/${p.id}.md`}
        title={p.title}
        lead={p.about}
        kv={
          <div className="kv">
            <div><span>steps</span><strong>{p.steps.length}</strong></div>
            <div><span>done</span><strong>{d ? done : '-'}</strong></div>
            <div><span>following</span><strong>{d ? (d.following ? 'yes' : 'no') : '-'}</strong></div>
          </div>
        }
      />
      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap">
          {user ? (
            d && (
              <div className="pw-bar">
                <button className={`btn ${d.following ? 'btn-ghost' : 'pri'}`} disabled={busy || full} aria-pressed={d.following} onClick={follow}>
                  {d.following ? 'Stop following' : 'Follow this pathway'}
                </button>
                <span className="d">
                  {full ? `You follow ${MAX_FOLLOW} already. Stop one to follow this.` : d.following ? 'Your next step shows on Today.' : `Follow up to ${MAX_FOLLOW} at a time.`}
                </span>
              </div>
            )
          ) : (
            <p className="d"><Link to="/signin">Sign in</Link> to follow this pathway and tick off steps.</p>
          )}
          {err && <p className="dn" role="status">{err}</p>}

          <Pane file="steps" meta="in order, skip what you know">
            <ol className="pw-steps">
              {p.steps.map((s, i) => {
                const st = state[s.id];
                return (
                  <li key={s.id} className={st?.done ? 'done' : ''}>
                    <span className="pw-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    <div className="pw-body">
                      <h3><StepLink to={linkOf(s, user?.id)}>{s.title}</StepLink></h3>
                      <p>{s.why}</p>
                      <p className="pw-meta">
                        <span>{s.time}</span>
                        {st?.auto && <span className="g">done, from your club record</span>}
                      </p>
                    </div>
                    {st && (
                      <label className="pw-tick">
                        <input
                          type="checkbox"
                          checked={st.done}
                          disabled={busy || st.auto}
                          onChange={(e) => tick(s.id, e.target.checked)}
                          aria-label={`Mark "${s.title}" done`}
                        />
                        <span aria-hidden="true">{st.done ? '[x]' : '[ ]'}</span>
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>
          </Pane>
          <p className="d" style={{ marginTop: 14 }}>
            Ticks are for you. They are private and earn no points; points come from the work itself.
          </p>
          <p style={{ marginTop: 14 }}><Link to="/pathways">&larr; all pathways</Link></p>
        </div>
      </section>
    </>
  );
}
