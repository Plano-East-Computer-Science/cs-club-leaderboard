import { useState } from 'react';
import { useApi, useReveal } from '../lib/ui.js';

const TRACKS = [
  { id: 'fall', label: 'Fall', sub: 'Beginner', blurb: 'Print statements to object-oriented programming. No experience assumed.' },
  { id: 'spring', label: 'Spring', sub: 'Advanced', blurb: 'Searching, sorting, data structures, graphs, and dynamic programming.' },
];

const Check = () => (
  <svg viewBox="0 0 12 12"><path d="M2 6.5l3 3 5-6" /></svg>
);

export default function Curriculum() {
  const { data, error, reload } = useApi('/curriculum');
  const [cur, setCur] = useState('all');
  useReveal();

  const topics = data?.topics ?? [];
  const tracks = TRACKS.filter((t) => topics.some((x) => x.track === t.id));
  const shown = tracks.filter((t) => cur === 'all' || t.id === cur);

  return (
    <>
      <section className="oh">
        <div className="wrap oh2 rv">
          <div>
            <p className="m" style={{ fontSize: 12, marginBottom: 6 }}>the java track</p>
            <h1>What we teach, all year.</h1>
            <p className="sub" style={{ margin: '10px 0 0' }}>
              Beginners and returning members are both covered. The fall track assumes nothing, the spring track goes further.
              A checked topic has already been taught this year.
            </p>
          </div>
          <div className="rulep rv"><b>live</b> Officers check topics off as each lesson is taught, so this reflects the real year.</div>
        </div>
      </section>

      <section className="sec" style={{ border: 0, paddingTop: 14 }}>
        <div className="wrap">
          {error ? (
            <div className="state-note bad">{error}<br /><button className="btn btn-ghost" onClick={reload}>Try again</button></div>
          ) : !data ? (
            <div className="state-note">loading curriculum...</div>
          ) : !topics.length ? (
            <div className="state-note">No topics posted yet. Check back once the roadmap is up.</div>
          ) : (
            <>
              <div className="ctl2">
                <div className="tabs2" role="tablist" aria-label="Track">
                  <button role="tab" aria-selected={cur === 'all'} onClick={() => setCur('all')}>all tracks <b>{topics.length}</b></button>
                  {tracks.map((t) => (
                    <button key={t.id} role="tab" aria-selected={cur === t.id} onClick={() => setCur(t.id)}>
                      {t.id} <b>{topics.filter((x) => x.track === t.id).length}</b>
                    </button>
                  ))}
                </div>
              </div>
              <div className={`tr2 ${shown.length > 1 ? 'two2' : ''}`}>
                {shown.map((t) => {
                  const items = topics.filter((x) => x.track === t.id);
                  const n = items.filter((x) => x.covered).length;
                  return (
                    <section key={t.id} className="tk">
                      <div className="hd">
                        <div className="pane-h"><span><b>track</b> {t.id}</span><span>java</span></div>
                        <h2>{t.label}: <em>{t.sub}</em></h2>
                        <p className="bl">{t.blurb}</p>
                        <div className="pr">
                          <span>{n} of {items.length} covered so far</span>
                          <span className="meter"><i style={{ width: `${(n / items.length) * 100}%` }} /></span>
                        </div>
                      </div>
                      <ol>
                        {items.map((x, i) => (
                          <li key={x.id} className={x.covered ? 'on' : ''}>
                            <div className="crow">
                              <span className="num">{String(i + 1).padStart(2, '0')}</span>
                              <span className="nd"><Check /></span>
                              <span className="tt">{x.title}</span>
                              <span className="st">{x.covered ? 'covered' : 'not yet'}</span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
