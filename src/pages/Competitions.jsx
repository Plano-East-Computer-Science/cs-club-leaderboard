import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { formatDate } from '../lib/format.js';
import { useApi, useReveal } from '../lib/ui.js';

export default function Competitions() {
  const { data, error, reload } = useApi('/competitions');
  const { opportunities } = useData();
  const [cur, setCur] = useState('all');
  useReveal();

  const all = (data?.competitions ?? []).map((c, i) => ({ ...c, i }));
  const withResult = all.filter((c) => c.result).length;
  const list = all.filter((c) => cur === 'all' || (cur === 'result') === !!c.result);
  const more = opportunities.filter((o) => o.type === 'competition');

  return (
    <>
      <section className="oh">
        <div className="wrap oh2 rv">
          <div>
            <p className="m" style={{ fontSize: 12, marginBottom: 6 }}>where we compete</p>
            <h1>Competitions and results.</h1>
            <p className="sub" style={{ margin: '10px 0 0' }}>
              Competition attendance earns points toward club standing and priority spots on future teams. You do not have to
              win to get them, and it reads well on a college app either way.
            </p>
          </div>
        </div>
      </section>

      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap">
          {error ? (
            <div className="state-note bad">{error}<br /><button className="btn btn-ghost" onClick={reload}>Try again</button></div>
          ) : !data ? (
            <div className="state-note">loading competitions...</div>
          ) : (
            <>
              <div className="ctl2">
                <div className="tabs2" role="tablist" aria-label="Filter competitions">
                  <button role="tab" aria-selected={cur === 'all'} onClick={() => setCur('all')}>all <b>{all.length}</b></button>
                  <button role="tab" aria-selected={cur === 'result'} onClick={() => setCur('result')}>with a result <b>{withResult}</b></button>
                  <button role="tab" aria-selected={cur === 'open'} onClick={() => setCur('open')}>no result yet <b>{all.length - withResult}</b></button>
                </div>
              </div>
              {all.length === 0 ? (
                <div className="state-note">Nothing posted yet.</div>
              ) : (
                <div className="comps">
                  {list.map((c) => (
                    <article key={c.id} className={`cc sp ${c.result ? 'hit' : ''}`}>
                      <span className="no">{String(c.i + 1).padStart(2, '0')}</span>
                      <h2>{c.name}</h2>
                      <p>{c.description}</p>
                      <div className="res">
                        {c.result ? <span className="stamp">{c.result}</span> : <span className="nores">no result posted</span>}
                      </div>
                      <div className="dl2">
                        <span>{c.event_date ? formatDate(c.event_date) : 'Date not set yet'}</span>
                        {c.url && <a href={c.url} target="_blank" rel="noreferrer noopener">More info</a>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="rule rv">
            <div><b>20-40 pts</b>Entering a competition.</div>
            <div><b>40-60 pts</b>Placing in a competition.</div>
            <div><b>Priority spots</b>Attendance counts toward future teams, win or lose.</div>
          </div>
          {more.length > 0 && (
            <>
              <h2 className="mh rv">More places to compete <small>grep -c competition</small></h2>
              <p className="sub rv">Outside contests from the opportunity board that fit a club team or a solo entry.</p>
              <div className="moretags rv">
                {more.map((o) => (
                  <Link key={o.id} to={`/opportunities?q=${encodeURIComponent(o.title)}`}>{o.title}</Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
