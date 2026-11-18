import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { TIERS, tierIndex, tierProgress } from '../lib/tiers.js';
import { useData } from '../lib/data.jsx';
import { parseTs, dayOf, shortDate } from '../lib/season.js';
import { first, useMedia, useReveal } from '../lib/ui.js';
import { formatDate } from '../lib/format.js';
import { Crest } from '../components/Crest.jsx';

const bar = (p) => {
  const i = tierIndex(p);
  const nx = TIERS[i + 1];
  if (!nx) return `[${'#'.repeat(20)}] top rank`;
  const f = Math.round(tierProgress(p) * 20);
  return `[${'#'.repeat(f)}${'-'.repeat(20 - f)}] ${nx.min - p} pts to ${nx.name.toLowerCase()}`;
};

const ago = (t) => {
  const n = Math.floor((Date.now() - t) / 86_400_000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n}d ago`;
};

export default function Student() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { students, events: allEvents, season } = useData();
  const [state, setState] = useState({ data: null, error: null });
  useReveal();

  const load = () => {
    setState({ data: null, error: null });
    api.get(`/student/${id}`).then((data) => setState({ data, error: null })).catch((e) => setState({ data: null, error: e.message }));
  };
  useEffect(load, [id]);

  const idx = students.findIndex((s) => String(s.id) === String(id));
  const pv = idx > 0 ? students[idx - 1] : null;
  const nv = idx >= 0 && idx < students.length - 1 ? students[idx + 1] : null;

  // ← / → step through members
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' && pv) navigate(`/student/${pv.id}`);
      if (e.key === 'ArrowRight' && nv) navigate(`/student/${nv.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const { data, error } = state;
  if (error)
    return (
      <div className="state-note bad">
        {error}
        <br />
        <button className="btn btn-ghost" onClick={load}>Try again</button>
        {' '}
        <Link className="btn btn-ghost" to="/standings">cd ../standings</Link>
      </div>
    );
  if (!data) return <div className="state-note">loading profile...</div>;

  const ti = tierIndex(data.peak);
  const t = TIERS[ti];
  const nx = TIERS[ti + 1];
  const lead = students[0];
  const asc = [...data.events].sort((a, b) => (parseTs(a.created_at) - parseTs(b.created_at)) || a.id - b.id);
  const desc = [...asc].reverse();
  let run = 0;
  const tot = new Map(asc.map((e) => [e.id, (run += e.delta)]));
  const earned = data.events.filter((e) => e.delta > 0);
  const best = earned.reduce((a, b) => (b.delta > (a?.delta ?? 0) ? b : a), null);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = data.events.filter((e) => parseTs(e.created_at) >= weekAgo).reduce((a, e) => a + e.delta, 0);
  const gap = idx > 0 && students[idx - 1] ? `${students[idx - 1].points - data.points} behind #${students[idx - 1].place}` : students[1] && idx === 0 ? `${data.points - students[1].points} clear of #2` : '';

  return (
    <div className="wrap">
      <div className="pf-crumb">
        <Link className="back" to="/standings#roster">&larr; cd ../standings</Link>
        <div className="pf-nav" role="navigation" aria-label="Members">
          <Link className={pv ? '' : 'off'} to={pv ? `/student/${pv.id}` : '#'} aria-label="Previous member"><kbd>&larr;</kbd>{pv ? first(pv.name).toLowerCase() : 'start'}</Link>
          <span className="mid"><b className="cur">{String(idx + 1).padStart(2, '0')}</b>&nbsp;/ {String(students.length).padStart(2, '0')}</span>
          <Link className={nv ? '' : 'off'} to={nv ? `/student/${nv.id}` : '#'} aria-label="Next member">{nv ? first(nv.name).toLowerCase() : 'end'}<kbd>&rarr;</kbd></Link>
        </div>
      </div>

      <header className="pf-hero" style={{ '--c': t.color }}>
        <Crest i={ti} />
        <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
          <h1><span className="p">&gt;</span>{data.name}</h1>
          <p className="pf-meta">
            <span>{data.grade ? <>grade <b>{data.grade}</b></> : <b>member</b>}</span>
            <span>joined <b>{formatDate(data.joined_at)}</b></span>
            <span>rank <b style={{ color: t.color }}>{t.name.toUpperCase()}</b></span>
            {data.squad && <span>squad <b style={{ color: data.squad.color }}>{data.squad.name}</b></span>}
            {gap && <span>{gap}</span>}
          </p>
        </div>
        <div className="pf-score">
          <strong>{data.points}</strong>
          <span>season points &middot; place <b>{data.place}</b> of {data.total_students} &middot; {data.lifetime} all time</span>
        </div>
      </header>

      <div className="pf-grid">
        <div className="pf-col">
          <section className="sp panel">
            <div className="pane-h">
              <span><b>points.plot</b> cumulative, {shortDate(season, 0)} to {shortDate(season, season.today)}</span>
              <span className="hide-xs">dashed = leader</span>
            </div>
            <PointsChart m={data} lead={lead} events={allEvents} season={season} asc={asc.filter((e) => dayOf(season, parseTs(e.created_at)) >= 0)} />
          </section>
          <section className="panel">
            <div className="pane-h">
              <span><b>git log --points {first(data.name).toLowerCase()}</b> {data.events.length} awards</span>
              <span className="hide-xs">newest first</span>
            </div>
            {desc.length ? (
              <div className="tbw" style={{ overflowX: 'auto' }}>
                <table className="pf-t">
                  <thead>
                    <tr><th>date</th><th>reason</th><th style={{ textAlign: 'right' }}>pts</th><th className="hx" style={{ textAlign: 'right' }}>total</th></tr>
                  </thead>
                  <tbody>
                    {desc.map((e, k) => (
                      <tr key={e.id} style={{ '--i': k }}>
                        <td className="d1">{shortDate(season, dayOf(season, parseTs(e.created_at)))}</td>
                        <td className="rs">{e.reason || 'No reason recorded'}<small>{ago(parseTs(e.created_at))}</small></td>
                        <td className={`pp ${e.delta < 0 ? 'neg' : ''}`}>{e.delta > 0 ? '+' : ''}{e.delta}</td>
                        <td className="tot hx">{tot.get(e.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pf-empty">No points awarded yet. Show up to a meeting and that changes.</div>
            )}
          </section>
        </div>

        <aside className="pf-col">
          <section className="panel sp" style={{ '--c': t.color }}>
            <div className="pane-h"><span><b>rank</b> lifetime, never drops</span><span>{ti + 1} of {TIERS.length}</span></div>
            <div className="pf-tier">
              <div className="tn"><Crest i={ti} /><h3>{t.name}</h3></div>
              <p>{t.blurb}</p>
              <div className="prog">{bar(data.peak)}</div>
              <span className="xp" style={{ '--c': t.color }}><i className="fillbar" style={{ '--p': tierProgress(data.peak), transform: `scaleX(${tierProgress(data.peak)})` }} /></span>
              <div className="pf-lab"><span>{t.min}</span><span>{nx ? `${nx.name.toLowerCase()} at ${nx.min}` : 'no higher rank'}</span></div>
              <div className="pf-steps">
                {TIERS.map((x, k) => <i key={x.name} className={`${k <= ti ? 'on' : ''} ${k === ti ? 'now' : ''}`} style={{ '--c': x.color }} title={x.name} />)}
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="pane-h"><span><b>badges</b> {data.badges.length}</span></div>
            <div className="pf-tier" style={{ paddingTop: 8, paddingBottom: 12 }}>
              {data.badges.length ? (
                data.badges.map((b) => (
                  <div key={b.id} className="pf-badge"><span className="tag gd">{b.name}</span><span>{b.description}</span></div>
                ))
              ) : (
                <p className="d" style={{ padding: '2px 0 4px' }}>None yet. Badges are awarded by officers for specific wins.</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="pane-h"><span><b>at a glance</b> stat --member</span></div>
            <div className="pf-stats">
              <div className="dline"><span>awards received</span><span>{data.award_count}</span></div>
              <div className="dline"><span>biggest single award</span><span className="g">{best ? `+${best.delta}` : 'none'}</span></div>
              <div className="dline"><span>last award</span><span>{data.last_award ? ago(parseTs(data.last_award)) : 'none'}</span></div>
              <div className="dline"><span>this week</span><span>{thisWeek > 0 ? '+' : ''}{thisWeek}</span></div>
              {best?.reason && <p className="pf-note">Best haul: <b>{best.reason}</b></p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Cumulative points over the season as a staircase, with the leader dashed behind it. */
function PointsChart({ m, lead, events, season, asc }) {
  const narrow = useMedia('(max-width:560px)');
  const svgRef = useRef(null);
  const [read, setRead] = useState(null);
  const [cursor, setCursor] = useState(null);

  const today = season.today;
  const W = narrow ? 400 : 640;
  const H = narrow ? 250 : 230;
  const pl = 34, pr = 16, pt = 14, pb = 26;

  const leadEvs = useMemo(
    () =>
      events
        .filter((e) => e.student_id === lead?.id)
        .map((e) => ({ d: dayOf(season, parseTs(e.created_at)), p: e.delta }))
        .sort((a, b) => a.d - b.d),
    [events, lead, season]
  );
  const mine = asc.map((e) => ({ d: dayOf(season, parseTs(e.created_at)), p: e.delta }));
  const cum = (list, d) => list.reduce((a, e) => (e.d <= d ? a + e.p : a), 0);

  const ymax = Math.max(40, Math.ceil((Math.max(lead?.points ?? 0, m.points) * 1.1) / 40) * 40);
  const X = (d) => pl + (Math.max(0, Math.min(d, today)) / today) * (W - pl - pr);
  const Y = (v) => H - pb - (v / ymax) * (H - pt - pb);
  const stair = (list) => {
    let v = 0;
    let p = `M${X(0)} ${Y(0)}`;
    for (const e of list) {
      p += `L${X(e.d).toFixed(1)} ${Y(v).toFixed(1)}`;
      v += e.p;
      p += `L${X(e.d).toFixed(1)} ${Y(v).toFixed(1)}`;
    }
    return `${p}L${X(today)} ${Y(v)}`;
  };

  const ticks = [];
  for (let v = 0; v <= ymax; v += ymax / 4) ticks.push(v);
  const months = [];
  for (let k = 0; k < 14; k++) {
    const d0 = new Date(season.start.getFullYear(), season.start.getMonth() + 1 + k, 1);
    const d = dayOf(season, d0);
    if (d > today - 2) break;
    months.push([d, d0.toLocaleDateString('en-US', { month: 'short' })]);
  }

  const move = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const d = Math.max(0, Math.min(today, Math.round(((sx - pl) / (W - pl - pr)) * today)));
    setCursor(d);
    setRead(`${shortDate(season, d)}  ${first(m.name)} ${cum(mine, d)}${lead && lead.id !== m.id ? `  leader ${cum(leadEvs, d)}` : ''}`);
  };
  const F = { fontFamily: 'JetBrains Mono', fontSize: 11 };

  return (
    <>
      <div className="pf-chart">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart of ${m.name}'s cumulative points this season`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.07)" strokeDasharray="2 4" />
              <text x={pl - 8} y={Y(v) + 4} textAnchor="end" fill="#6b6754" {...F}>{v}</text>
            </g>
          ))}
          {months.map(([d, l]) => <text key={d} x={X(d)} y={H - 8} textAnchor="middle" fill="#6b6754" {...F}>{l}</text>)}
          {lead && lead.id !== m.id && <path d={stair(leadEvs)} fill="none" stroke="#6b6754" strokeWidth="1.6" strokeDasharray="4 4" />}
          <path d={stair(mine)} fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx={X(today)} cy={Y(m.points)} r="4" fill="var(--gold)" />
          {cursor != null && <line x1={X(cursor)} x2={X(cursor)} y1={pt} y2={H - pb} stroke="rgba(255,194,14,.6)" strokeDasharray="3 3" />}
          <rect x={pl} y="0" width={W - pl - pr} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => { setCursor(null); setRead(null); }} />
        </svg>
      </div>
      <div className="pf-read">{read ?? 'move across the chart to read any week'}</div>
      <div className="pf-key"><span><i />{m.name}</span>{lead && lead.id !== m.id && <span><i className="l" />leader, {lead.name}</span>}</div>
    </>
  );
}
