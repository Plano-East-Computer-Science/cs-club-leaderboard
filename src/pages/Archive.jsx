import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';

/** G4 year archive. /archive lists school years; /archive/:year is one, read-only, first names only. */
export default function Archive() {
  const { year } = useParams();
  return year ? <Year year={year} /> : <Years />;
}

function Years() {
  useReveal();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/archive').then(setD).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="state-note bad">{error}</div>;
  if (!d) return <div className="state-note">loading...</div>;
  return (
    <>
      <PageHead eyebrow="archive" title={<>What the club <em>did</em>.</>} lead="One page per school year, built from the meetings, results and projects we recorded. Names are first names only." one />
      <section className="sec">
        <div className="wrap">
          <Pane file="school-years" meta="newest first" spot={false}>
            <ul className="pn-b ar-years">
              {d.years.map((y) => <li key={y.year}><Link className="u" to={`/archive/${y.year}`}>{y.label}</Link></li>)}
            </ul>
          </Pane>
        </div>
      </section>
    </>
  );
}

function Top({ title, rows, unit }) {
  return (
    <div>
      <p className="m">{title}</p>
      {rows.length === 0 ? <p className="d">Nobody yet.</p> : (
        <ol className="ar-top">{rows.map((r) => <li key={r.name}><b>{r.name}</b> <span className="d">{r.n} {unit}</span></li>)}</ol>
      )}
    </div>
  );
}

function Year({ year }) {
  useReveal();
  const [a, setA] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setA(null); api.get(`/archive/${year}`).then(setA).catch((e) => setError(e.message)); }, [year]);
  if (error) return <div className="state-note bad">{error} <Link className="u" to="/archive">All years</Link></div>;
  if (!a) return <div className="state-note">loading...</div>;
  const t = a.totals;
  return (
    <>
      <PageHead
        eyebrow={`archive --year ${a.label}`}
        title={<>The {a.label} <em>year</em>.</>}
        lead={a.summary || (a.current ? 'This year is still in progress.' : 'No written summary for this year.')}
        kv={
          <div className="kv">
            <div><span>meetings</span><strong>{t.meetings}</strong></div>
            <div><span>members</span><strong>{t.people}</strong></div>
            <div><span>projects</span><strong>{a.projects.count}</strong></div>
          </div>
        }
      />
      <section className="sec">
        <div className="wrap ar-grid">
          <Pane file="meetings" meta={`${t.checkins} check-ins, ${t.dropins} drop-ins`}>
            <div className="pn-b">
              {a.templates.length === 0 ? <p className="d">No meetings recorded.</p> : (
                <ul className="ar-list">
                  {a.templates.map((m) => <li key={m.template}><b>{m.name}</b> <span className="d">{m.meetings} held, {m.avg} came on average</span></li>)}
                </ul>
              )}
            </div>
          </Pane>
          <Pane file="competitions" meta={`${a.placements} placed`}>
            <div className="pn-b">
              {a.competitions.length === 0 ? <p className="d">No competitions recorded.</p> : (
                <ul className="ar-list">
                  {a.competitions.map((c) => <li key={`${c.name}${c.event_date}`}><b>{c.name}</b> <span className="d">{c.result || 'entered'}</span></li>)}
                </ul>
              )}
            </div>
          </Pane>
          <Pane file="projects-shipped" meta={`${a.projects.count} total`}>
            <div className="pn-b">
              {a.projects.list.length === 0 ? <p className="d">No projects recorded.</p> : (
                <ul className="ar-list">{a.projects.list.map((p, i) => <li key={i}><b>{p.title}</b> <span className="d">by {p.by}</span></li>)}</ul>
              )}
            </div>
          </Pane>
          <Pane file="top-contributors" meta="first names">
            <div className="pn-b ar-tops">
              <Top title="Showed up" rows={a.top.attendance} unit="meetings" />
              <Top title="Helped others" rows={a.top.mentoring} unit="times" />
              <Top title="Shipped" rows={a.top.projects} unit="projects" />
              <Top title="Competed" rows={a.top.competing} unit="entries" />
            </div>
          </Pane>
        </div>
        <div className="wrap" style={{ marginTop: 16 }}>
          <Link className="u" to="/archive">All years</Link>
          {' '}<span className="d">and</span>{' '}<Link className="u" to="/officers/apply">help run the club next year</Link>
        </div>
      </section>
    </>
  );
}
