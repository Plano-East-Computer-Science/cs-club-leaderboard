/**
 * /arena/data (C12): the list of data challenges. Each one opens a notebook
 * where members explore a dataset with pandas and submit predictions.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { METRICS } from '../../shared/data.js';

export default function DataArena() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useReveal();

  const load = () => {
    setError('');
    api.get('/data/challenges').then(setD).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <div className="state-note bad">{error} <button className="btn" onClick={load}>Try again</button></div>;
  if (!d) return <div className="state-note">loading challenges...</div>;

  return (
    <>
      <PageHead
        eyebrow="arena / data"
        title="Data challenges"
        lead="Each challenge is a dataset with hidden answers. Explore it with pandas and matplotlib right here, predict the missing column, and see your score on the leaderboard."
        kv={
          <div className="kv two2">
            <div><span>challenges</span><strong>{d.challenges.length}</strong></div>
            <div><span>you entered</span><strong>{d.signedIn ? d.challenges.filter((c) => c.submitted).length : '-'}</strong></div>
          </div>
        }
      />
      <section className="sec">
        <div className="wrap">
          <p className="ar-note" style={{ marginTop: 0, marginBottom: 14 }}>
            <Link className="uline" to="/arena">Back to the board</Link>. Python runs in your browser from this site, so it works on school wifi. The first time you start a notebook it downloads about 20 MB.
          </p>
          {d.challenges.length === 0 ? (
            <p className="ar-note">No challenges yet. Officers add them from the officer page.</p>
          ) : (
            <ul className="dt-list">
              {d.challenges.map((c) => (
                <li key={c.id} className="pn sp rv">
                  <div className="pane-h">
                    <span><b>{METRICS[c.metric]?.kind ?? 'data'}</b></span>
                    <span>{c.status === 'closed' ? 'closed' : 'open'}</span>
                  </div>
                  <div className="pn-b">
                    <h2 className="dt-title"><Link to={`/arena/data/${c.id}`} className="uline">{c.title}</Link></h2>
                    <p className="dt-meta">
                      <span>{METRICS[c.metric]?.label}</span>
                      <span>{c.rows} rows to predict</span>
                      <span>{c.players} {c.players === 1 ? 'player' : 'players'}</span>
                      {c.submitted && <span className="up">you have entered</span>}
                    </p>
                    <p className="d">{c.summary.split('\n')[0]}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
