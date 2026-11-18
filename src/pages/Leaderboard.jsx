/**
 * Standings (A4, A5, A6). Season points decide the prize; this page shows the
 * top five, your own place with two members either side, how many members sit
 * in each season tier, the raffle and the squads. Nobody sees a wall of names
 * with themselves at the bottom; the full ranked list is for officers.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { TIERS, tierIndex } from '../lib/tiers.js';
import { parseTs, dayOf, shortDate, seasonOf } from '../lib/season.js';
import { first, useReveal, reducedMotion } from '../lib/ui.js';
import { Crest } from '../components/Crest.jsx';
import { Panther } from '../components/Panther.jsx';
import { CountUp } from '../components/bits.jsx';
import { TIER_NAMES } from '../../shared/standings.js';

const COL = ['#ffc20e', '#f4f1e8', '#6b97ff', '#2dd4bf', '#ff6253'];
const TIER_COL = ['#c98a4b', '#c9c9c0', '#ffc20e', '#7fd6ff', '#b093ff'];
const rankOf = (id) => TIERS.find((t) => t.id === id) ?? TIERS[0];

export default function Leaderboard() {
  const [key, setKey] = useState(() => new URLSearchParams(location.search).get('season') || '');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useReveal();

  const load = () => {
    setError(null);
    api
      .get(`/standings${key ? `?season=${encodeURIComponent(key)}` : ''}`)
      .then(setD)
      .catch((e) => setError(e.message));
  };
  useEffect(load, [key]);

  const season = useMemo(() => {
    if (!d) return null;
    // Start the chart a week before the first award, not on an empty June 1.
    const since = d.race.length ? new Date(parseTs(d.race[0].created_at).getTime() - 7 * 86_400_000) : null;
    return seasonOf({}, new Date(), d.season, since);
  }, [d]);

  const race = useMemo(() => {
    if (!d || !season) return null;
    const bySid = new Map();
    for (const e of d.race) {
      const t = parseTs(e.created_at);
      if (!t) continue;
      const row = { p: e.delta, d: dayOf(season, t) };
      bySid.set(e.student_id, [...(bySid.get(e.student_id) ?? []), row]);
    }
    const cum = (sid, day) => (bySid.get(sid) ?? []).reduce((a, e) => (e.d <= day ? a + e.p : a), 0);
    return { cum };
  }, [d, season]);

  if (error && !d)
    return (
      <div className="state-note bad">
        {error}
        <br />
        <button className="btn btn-ghost" onClick={load}>Try again</button>
      </div>
    );
  if (!d) return <div className="state-note">loading standings...</div>;

  const prize = d.prize || 'Meta Ray-Ban Display Glasses';
  const current = d.season === d.seasons[0].key;
  const lead = d.top[0];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>
              <span className="p">&gt;</span>
              {current ? <>This season wins <em>{prize}</em>.</> : <>{d.label}</>}
              <span className="cursor" aria-hidden="true" />
            </h1>
            <p className="lead">
              One number: <b>points</b>. Season points reset each semester and decide the prize. Reach the first tier and you hold a raffle
              ticket for every point, so you do not have to finish first to win something. Your <b>rank</b> comes from all the points you
              have ever earned and never goes down.
            </p>
            <div className="chips st-seasons" role="group" aria-label="Season">
              {d.seasons.map((s) => (
                <button key={s.key} type="button" aria-pressed={d.season === s.key} onClick={() => setKey(s.key === d.seasons[0].key ? '' : s.key)}>
                  {s.key === d.seasons[0].key ? `${s.label} (now)` : s.label}
                </button>
              ))}
            </div>
            {current && <Countdown end={season.end} />}
            <div className="kv">
              <div><span>members</span><strong>{d.members}</strong></div>
              <div><span>points awarded</span><strong>{d.totalPoints}</strong></div>
              <div><span>raffle tickets</span><strong>{d.raffle.tickets}</strong></div>
            </div>
          </div>
          <Panther />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <You d={d} />
        </div>
      </section>

      {d.top.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <h2>Top five <small>top -n 5</small></h2>
            <p className="sub">The front of the race this season. Everyone else is counted by tier below.</p>
            <Top5 top={d.top} prize={current ? prize : null} />
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap two">
          <Tiers d={d} />
          <Squads d={d} />
        </div>
      </section>

      {d.top.length > 0 && season.today > 0 && (
        <section className="sec">
          <div className="wrap">
            <RankRace top={d.top} cum={race.cum} season={season} />
          </div>
        </section>
      )}

      {d.officer && (
        <section className="sec">
          <div className="wrap">
            <p className="sub">
              Officers: the full ranked list and the raffle draw are in the <Link className="g uline" to="/officer#raffle">meeting console</Link>.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

/* --------------------------------- you --------------------------------- */

function You({ d }) {
  const me = d.me;
  if (!me)
    return (
      <div className="sp panel rv st-you">
        <div className="pane-h"><span><b>whoami</b> your place</span></div>
        <div className="pn-b">
          <p>
            Sign in to see your own place, the two members either side of you, and how far you are from the next tier.{' '}
            <Link className="g uline" to="/signin">sign in</Link>
          </p>
        </div>
      </div>
    );
  const r = rankOf(me.rank);
  const next = me.nextTier;
  const tierName = me.tier >= 0 ? TIER_NAMES[me.tier] : 'no tier yet';
  return (
    <div className="sp panel rv st-you">
      <div className="pane-h">
        <span><b>whoami</b> {first(me.name).toLowerCase()}, {d.label.toLowerCase()}</span>
        <span className="hide-xs">you and two either side</span>
      </div>
      <div className="st-you-g">
        <div className="st-me">
          <div className="st-big"><b>#{me.place}</b><span>of {d.members}</span></div>
          <div className="dline"><span>season points</span><span className="g">{me.points}</span></div>
          <div className="dline"><span>tier</span><span style={{ color: me.tier >= 0 ? TIER_COL[me.tier] : 'var(--dim)' }}>{tierName}</span></div>
          <div className="dline"><span>raffle tickets</span><span>{me.tickets || `none yet, ${d.tiers[0]} pts to enter`}</span></div>
          <div className="dline"><span>rank</span><span style={{ color: r.color }}>{r.name}</span></div>
          <p className="st-next">
            {next ? (
              <><b className="g">{next.gap}</b> points to {TIER_NAMES[next.index]} ({next.min}). One meeting is 10.</>
            ) : (
              <>Top tier reached. Every point is another raffle ticket.</>
            )}
          </p>
        </div>
        <table className="rt" aria-label="Your place and your neighbours">
          <thead>
            <tr><th>#</th><th>member</th><th className="hide-xs">rank</th><th style={{ textAlign: 'right' }}>pts</th></tr>
          </thead>
          <tbody>
            {me.window.map((m) => (
              <tr key={m.id} className={m.you ? 'r sel' : 'r'} aria-current={m.you ? 'true' : undefined}>
                <td className="n">{String(m.place).padStart(2, '0')}</td>
                <td className="nm"><Link to={`/student/${m.id}`}>{m.you ? `${m.name} (you)` : m.name}</Link></td>
                <td className="hide-xs" style={{ color: rankOf(m.rank).color }}>{rankOf(m.rank).name}</td>
                <td className="pts">{m.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- top five --------------------------------- */

function Top5({ top, prize }) {
  return (
    <div className="top3 top5 rv">
      {top.map((m, i) => {
        const ti = tierIndex(rankOf(m.rank).min);
        const t = TIERS[ti];
        return (
          <article key={m.id}>
            <Link to={`/student/${m.id}`} className="st-cover" aria-label={`${m.name}, place ${m.place}, ${m.points} points`} />
            <div className="tr1">
              <div className="rk">{m.place}</div>
              <Crest i={ti} cls="cr" />
            </div>
            <h3>{m.name}</h3>
            <div className="pt">
              <b><CountUp value={m.points} duration={1100} /></b> pts <span style={{ color: t.color }}>{t.name.toLowerCase()}</span>
            </div>
            <div className="meta">{i ? `${top[i - 1].points - m.points} behind #${top[i - 1].place}` : top[1] ? `${m.points - top[1].points} clear of #2` : 'only member so far'}</div>
            {i === 0 && prize && <div className="prize">on track for {prize}</div>}
          </article>
        );
      })}
    </div>
  );
}

/* --------------------------------- tiers --------------------------------- */

function Tiers({ d }) {
  const most = Math.max(1, d.counts.below, ...d.counts.tiers.map((t) => t.n));
  const rows = [...d.counts.tiers.map((t, i) => ({ ...t, c: TIER_COL[i], label: `${t.min}+ pts` }))].reverse();
  return (
    <div className="sp panel rv">
      <div className="pane-h">
        <span><b>tiers.conf</b> {d.label.toLowerCase()}</span>
        <span className="hide-xs">members per tier</span>
      </div>
      <ul className="st-tiers">
        {rows.map((t) => (
          <li key={t.name} style={{ '--c': t.c }}>
            <span className="tn">{t.name}</span>
            <span className="tm">{t.label}</span>
            <span className="tb" aria-hidden="true"><i style={{ width: `${(t.n / most) * 100}%` }} /></span>
            <span className="tc2">{t.n}</span>
          </li>
        ))}
        <li style={{ '--c': 'var(--line2)' }}>
          <span className="tn">Warming up</span>
          <span className="tm">under {d.tiers[0]}</span>
          <span className="tb" aria-hidden="true"><i style={{ width: `${(d.counts.below / most) * 100}%` }} /></span>
          <span className="tc2">{d.counts.below}</span>
        </li>
      </ul>
      <p className="st-raffle">
        Raffle: <b>{d.raffle.entrants}</b> member{d.raffle.entrants === 1 ? '' : 's'} at {TIER_NAMES[0]} or above hold <b>{d.raffle.tickets}</b>{' '}
        tickets, one per season point.{d.raffle.winner ? <> Drawn: <b className="g">{d.raffle.winner}</b>.</> : ' Drawn by an officer at the end of the season.'}
      </p>
    </div>
  );
}

/* --------------------------------- squads --------------------------------- */

function Squads({ d }) {
  return (
    <div className="sp panel rv" style={{ '--d': 1 }}>
      <div className="pane-h">
        <span><b>squads</b> {d.squads.length}</span>
        <span className="hide-xs">score = median member</span>
      </div>
      {d.squads.length ? (
        <table className="rt" aria-label="Squad standings">
          <thead>
            <tr><th>#</th><th>squad</th><th style={{ textAlign: 'right' }}>size</th><th style={{ textAlign: 'right' }}>score</th></tr>
          </thead>
          <tbody>
            {d.squads.map((s) => (
              <tr key={s.id} className={s.mine ? 'r sel' : 'r'}>
                <td className="n">{s.place}</td>
                <td className="nm"><i className="st-dot" style={{ background: s.color }} aria-hidden="true" />{s.name}{s.mine ? ' (yours)' : ''}</td>
                <td style={{ textAlign: 'right' }}>{s.size}</td>
                <td className="pts">{s.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="pn-b"><p className="d">{d.season === 'all' ? 'Squads change every season. Pick a season to see them.' : 'No squads yet this season. Officers set them up.'}</p></div>
      )}
      <p className="st-raffle">A squad scores its middle member&apos;s season points, so helping your newest member is the winning move.</p>
    </div>
  );
}

/* --------------------------------- countdown --------------------------------- */

function Countdown({ end }) {
  const calc = () => {
    const s = Math.max(0, Math.floor((end - Date.now()) / 1e3));
    return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  };
  const [v, setV] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setV(calc()), 1000);
    return () => clearInterval(t);
  }, [end]);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div className="count sp" role="timer" aria-label="Time left in the season">
      <span className="cl">season.close --in</span>
      <div className="cd">
        <div><b>{v[0]}</b><small>days</small></div>
        <div><b>{pad(v[1])}</b><small>hrs</small></div>
        <div><b>{pad(v[2])}</b><small>min</small></div>
        <div><b>{pad(v[3])}</b><small>sec</small></div>
      </div>
    </div>
  );
}

/* --------------------------------- rank race --------------------------------- */

function RankRace({ top, cum, season }) {
  const today = season.today;
  const W = 760, H = 300, pl = 34, pr = 96, pt = 14, pb = 28;
  const maxPts = Math.max(10, ...top.map((m) => m.points));
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => maxPts / s <= 4.4) ?? 500;
  const ymax = step * Math.ceil((maxPts * 1.05) / step);
  const X = (dd) => pl + (Math.min(dd, today) / today) * (W - pl - pr);
  const Y = (v) => H - pb - (v / ymax) * (H - pt - pb);
  const days = [];
  for (let k = 0; k < today; k += 7) days.push(k);
  days.push(today);
  const ticks = [];
  for (let v = 0; v <= ymax; v += step) ticks.push(v);
  // End labels: keep at least 15px apart so close finishers stay readable.
  const labelY = top.map((m) => Y(cum(m.id, today)));
  [...labelY.keys()].sort((a, b) => labelY[a] - labelY[b]).forEach((i, k, order) => {
    if (k && labelY[i] - labelY[order[k - 1]] < 15) labelY[i] = labelY[order[k - 1]] + 15;
  });
  const months = [];
  for (let k = 0; k < 40; k++) {
    const d0 = new Date(season.start.getFullYear(), season.start.getMonth() + 1 + k, 1);
    const dd = dayOf(season, d0);
    if (dd > today - 2) break;
    months.push([dd, d0.toLocaleDateString('en-US', { month: 'short' })]);
  }

  const [hl, setHl] = useState(null);
  const [read, setRead] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [drawn, setDrawn] = useState(reducedMotion() || /static/.test(location.search));
  const svgRef = useRef(null);

  useEffect(() => {
    if (drawn) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) {
        setDrawn(true);
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(svgRef.current);
    return () => io.disconnect();
  }, [drawn]);

  const move = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const dd = Math.max(0, Math.min(today, Math.round(((sx - pl) / (W - pl - pr)) * today)));
    setCursor(dd);
    setRead(`${shortDate(season, dd)}  ${top.map((m) => `${first(m.name)} ${cum(m.id, dd)}`).join('  ')}`);
  };

  return (
    <div className="sp panel rv">
      <div className="pane-h">
        <span><b>rank_race.plot</b> top 5, {shortDate(season, 0)} to {shortDate(season, today)}</span>
        <span className="hide-xs">cumulative points</span>
      </div>
      <div className="chart">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of cumulative points for the top five members">
          {ticks.map((v) => (
            <Fragment key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.07)" strokeDasharray="2 4" />
              <text x={pl - 8} y={Y(v) + 4} textAnchor="end" fill="#6b6754" fontSize="11" fontFamily="JetBrains Mono">{v}</text>
            </Fragment>
          ))}
          {months.map(([dd, l]) => (
            <text key={dd} x={X(dd)} y={H - 8} fill="#6b6754" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{l}</text>
          ))}
          {top.map((m, i) => {
            const pts = days.map((dd) => [X(dd), Y(cum(m.id, dd))]);
            const path = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
            const end = pts[pts.length - 1];
            return (
              <g key={m.id} onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)}>
                <path
                  className={`ln ${hl != null && hl !== i ? 'd' : ''} ${hl === i ? 'h' : ''}`}
                  d={path}
                  stroke={COL[i]}
                  pathLength="1"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset 1.6s cubic-bezier(.65,0,.35,1) ${i * 120}ms,opacity .25s,stroke-width .25s` }}
                />
                <circle cx={end[0]} cy={end[1]} r="4" fill={COL[i]} />
                <text x={end[0] + 10} y={labelY[i] + 4} fill={COL[i]} fontSize="12" fontFamily="JetBrains Mono" fontWeight="700">{first(m.name)} {m.points}</text>
              </g>
            );
          })}
          <line y1={pt} y2={H - pb} x1={cursor == null ? 0 : X(cursor)} x2={cursor == null ? 0 : X(cursor)} stroke="rgba(255,194,14,.6)" strokeDasharray="3 3" opacity={cursor == null ? 0 : 1} />
          <rect x={pl} y="0" width={W - pl - pr} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => { setCursor(null); setRead(null); }} />
        </svg>
      </div>
      <div className="read" aria-live="off">{read ?? 'move across the chart to read any week'}</div>
      <div className="legend">
        {top.map((m, i) => (
          <button key={m.id} style={{ '--c': COL[i] }} className={hl === i ? 'h' : ''} onMouseEnter={() => setHl(i)} onFocus={() => setHl(i)} onMouseLeave={() => setHl(null)} onBlur={() => setHl(null)}>
            <i />{m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

