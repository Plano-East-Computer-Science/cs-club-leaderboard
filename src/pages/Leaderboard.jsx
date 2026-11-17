import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TIERS, tierIndex, tierProgress } from '../lib/tiers.js';
import { useData } from '../lib/data.jsx';
import { parseTs, dayOf, shortDate } from '../lib/season.js';
import { first, useMedia, useReveal, reducedMotion } from '../lib/ui.js';
import { Crest } from '../components/Crest.jsx';
import { Panther } from '../components/Panther.jsx';
import { CountUp } from '../components/bits.jsx';

const DAY = 86_400_000;
const COL = ['#ffc20e', '#f4f1e8', '#6b97ff', '#2dd4bf', '#ff6253'];
const initials = (n) => n.split(' ').map((w) => w[0]).join('');

const bar = (points) => {
  const i = tierIndex(points);
  if (!TIERS[i + 1]) return `[${'#'.repeat(20)}]`;
  const f = Math.round(tierProgress(points) * 20);
  return `[${'#'.repeat(f)}${'-'.repeat(20 - f)}]`;
};
const barText = (points) => {
  const nx = TIERS[tierIndex(points) + 1];
  return nx ? `${bar(points)} ${nx.min - points} to ${nx.name.toLowerCase()}` : `${bar(points)} max`;
};

export default function Leaderboard() {
  const { students, events, season, settings, errors, reload, board, totalPoints } = useData();
  const wide = useMedia('(min-width:960px)');
  const [sel, setSel] = useState(0);
  const [exp, setExp] = useState(null);
  const rosterRef = useRef(null);
  const rowsRef = useRef(null);
  useReveal();

  const today = season.today;

  /* per-member event lists, rank change over 7 days, weekly gain */
  const info = useMemo(() => {
    const evs = events
      .map((e) => {
        const t = parseTs(e.created_at);
        return t ? { sid: e.student_id, p: e.delta, l: e.reason, t, d: dayOf(season, t) } : null;
      })
      .filter(Boolean);
    const bySid = new Map();
    evs.forEach((e) => bySid.set(e.sid, [...(bySid.get(e.sid) ?? []), e]));
    const cum = (sid, d) => (bySid.get(sid) ?? []).reduce((a, e) => (e.d <= d ? a + e.p : a), 0);
    const prior = students
      .map((s, i) => ({ s, i, v: cum(s.id, today - 7) }))
      .sort((a, b) => b.v - a.v || a.i - b.i);
    const prev = new Map(prior.map((x, k) => [x.s.id, k + 1]));
    const per = new Map(
      students.map((s, i) => [s.id, { delta: prev.get(s.id) - (i + 1), wk: cum(s.id, today) - cum(s.id, today - 7) }])
    );
    return { evs, bySid, cum, per };
  }, [students, events, season, today]);

  /* keep the selection valid, and honour the `rank` command */
  useEffect(() => {
    const f = (e) => selectMember(e.detail, true);
    window.addEventListener('select-member', f);
    return () => window.removeEventListener('select-member', f);
  });
  useEffect(() => {
    const onKey = (e) => {
      if (!wide || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectMember(Math.min(students.length - 1, sel + 1), true);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectMember(Math.max(0, sel - 1), true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function selectMember(i, scroll) {
    if (!students[i]) return;
    setSel(i);
    if (scroll && wide) rowsRef.current?.querySelector(`tr.r[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  if (errors.board && !board)
    return (
      <div className="state-note bad">
        {errors.board}
        <br />
        <button className="btn btn-ghost" onClick={reload}>
          Try again
        </button>
      </div>
    );
  if (!board) return <div className="state-note">loading standings...</div>;

  const lead = students[0];
  const prize = settings.prize_title || 'Meta Ray-Ban Display Glasses';

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>
              <span className="p">&gt;</span>First place wins <em>{prize}</em>.<span className="cursor" aria-hidden="true" />
            </h1>
            <p className="lead">
              {settings.club_name || 'Plano East CS Club'} runs on points. <b>Show up, ship something, enter a contest</b>,
              and every award is logged with a reason. {students.length} member{students.length === 1 ? ' is' : 's are'} on the
              board. The season ends with {prize}.
            </p>
            <Countdown end={season.end} />
            <div className="kv">
              <div>
                <span>season day</span>
                <strong>{season.day}</strong>
              </div>
              <div>
                <span>points awarded</span>
                <strong>{totalPoints}</strong>
              </div>
              <div>
                <span>leader</span>
                <strong>{lead?.name ?? '--'}</strong>
              </div>
            </div>
          </div>
          <Panther />
        </div>
      </section>

      {students.length === 0 ? (
        <section className="sec">
          <div className="wrap">
            <p className="sub">No members yet. Add your first club members from the admin panel and they will appear here.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="sec">
            <div className="wrap">
              <h2>
                Top three <small>top -n 3</small>
              </h2>
              <p className="sub">Click a card to open that member in the roster.</p>
              <Top3
                students={students}
                per={info.per}
                prize={prize}
                sel={sel}
                onGo={(i) => {
                  selectMember(i, true);
                  if (wide) rosterRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
                }}
              />
            </div>
          </section>

          <section className="sec" id="roster" ref={rosterRef}>
            <div className="wrap">
              <h2>
                Roster <small>ls -la --sort=points</small>
              </h2>
              <p className="sub">
                Hover a row or use <span className="g">j / k</span> and the arrow keys to inspect a member. On a phone, tap to expand.
              </p>
              <div className="split">
                <div>
                  <div className="pane-h">
                    <span>
                      <b>roster.db</b> {students.length} entries
                    </span>
                    <span className="hide-xs">&Delta; is rank change over the last 7 days</span>
                  </div>
                  <table className="rt">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>&Delta;</th>
                        <th>member</th>
                        <th className="hide-xs hide-s">gr</th>
                        <th>tier</th>
                        <th className="hide-s">to next</th>
                        <th style={{ textAlign: 'right' }}>pts</th>
                      </tr>
                    </thead>
                    <tbody ref={rowsRef}>
                      {students.map((m, i) => {
                        const ti = tierIndex(m.points);
                        const t = TIERS[ti];
                        const d = info.per.get(m.id).delta;
                        const open = exp === i && !wide;
                        const tog = () => {
                          if (wide) return selectMember(i);
                          setExp(open ? null : i);
                          setSel(i);
                        };
                        return (
                          <Fragment key={m.id}>
                            <tr
                              className={`r ${sel === i ? 'sel' : ''}`}
                              data-i={i}
                              tabIndex={0}
                              role="button"
                              aria-label={`${m.name}, rank ${m.rank}, ${m.points} points`}
                              onMouseEnter={() => wide && setSel(i)}
                              onFocus={() => wide && setSel(i)}
                              onClick={tog}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  tog();
                                }
                              }}
                            >
                              <td className="n">{String(m.rank).padStart(2, '0')}</td>
                              <td className="dl">
                                {d > 0 ? <span className="up">&#9650;{d}</span> : d < 0 ? <span className="dn">&#9660;{-d}</span> : <span className="m">--</span>}
                              </td>
                              <td className="nm">{m.name}</td>
                              <td className="hide-xs hide-s d">{m.grade ?? '-'}</td>
                              <td>
                                <span className="tc" style={{ color: t.color }}>
                                  <Crest i={ti} cls="cs" />
                                  <span className="hide-xs">{t.name}</span>
                                </span>
                              </td>
                              <td className="hide-s bar">{bar(m.points)}</td>
                              <td className="pts">{m.points}</td>
                            </tr>
                            {open && (
                              <tr className="exp">
                                <td colSpan={7}>
                                  <div className="xin">
                                    <Detail m={m} i={i} students={students} evs={info.bySid.get(m.id)} season={season} />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <aside className="detail" aria-live="polite">
                  <div className="pane-h">
                    <span>
                      <b>member --id {first(students[sel]?.name ?? '').toLowerCase()}</b>
                    </span>
                    <span>pane 2</span>
                  </div>
                  <div className="in">
                    {students[sel] && (
                      <Detail m={students[sel]} i={sel} students={students} evs={info.bySid.get(students[sel].id)} season={season} />
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </section>

          <section className="sec">
            <div className="wrap two">
              <RankRace students={students} info={info} season={season} />
              <Feed students={students} info={info} />
            </div>
          </section>

          <TierLadder students={students} lead={lead} />
        </>
      )}
    </>
  );
}

/* ------------------------------- hero bits ------------------------------- */

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

function Top3({ students, per, prize, sel, onGo }) {
  const top = students.slice(0, 3);
  return (
    <div className="top3 rv">
      {top.map((m, i) => {
        const ti = tierIndex(m.points);
        const t = TIERS[ti];
        const wk = per.get(m.id).wk;
        const go = () => onGo(i);
        return (
          <article
            key={m.id}
            className={`sp ${sel === i ? 'sel' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`${m.name}, rank ${m.rank}`}
            onClick={go}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          >
            <div className="tr1">
              <div className="rk">{m.rank}</div>
              <Crest i={ti} cls="cr" />
            </div>
            <h3>{m.name}</h3>
            <div className="pt">
              <b>
                <CountUp value={m.points} duration={1300} />
              </b>{' '}
              pts <span style={{ color: t.color }}>{t.name.toLowerCase()}</span>
            </div>
            <div className="xp" style={{ '--c': t.color, display: 'block' }}>
              <i className="fillbar" style={{ '--p': tierProgress(m.points) }} />
            </div>
            <div className="meta">
              {i ? `${top[i - 1].points - m.points} pts behind #${top[i - 1].rank}` : top[1] ? `${m.points - top[1].points} pts clear of #2` : 'only member so far'}
              {'  ·  '}+{wk} this week
            </div>
            {i === 0 && <div className="prize">wins {prize}</div>}
          </article>
        );
      })}
    </div>
  );
}

function Detail({ m, i, students, evs = [], season }) {
  const ti = tierIndex(m.points);
  const t = TIERS[ti];
  const sorted = [...evs].sort((a, b) => b.t - a.t);
  return (
    <>
      <div className="dh">
        <Crest i={ti} cls="cr" />
        <h3>{m.name}</h3>
      </div>
      <div className="dline"><span>rank</span><span>#{m.rank} of {students.length}</span></div>
      <div className="dline"><span>points</span><span className="g">{m.points}</span></div>
      <div className="dline"><span>tier</span><span style={{ color: t.color }}>{t.name.toUpperCase()}</span></div>
      <div className="dline"><span>grade</span><span>{m.grade ?? '-'}</span></div>
      <div className="dline">
        <span>gap</span>
        <span>
          {i ? `${students[i - 1].points - m.points} behind #${students[i - 1].rank}` : students[1] ? `${m.points - students[1].points} ahead of #2` : 'no one else yet'}
        </span>
      </div>
      <div className="prog"><span className="g">{barText(m.points)}</span></div>
      <div className="tags">
        {m.badges.length ? m.badges.map((b) => <span key={b.id} className="tag gd">{b.name}</span>) : <span className="tag">no badges yet</span>}
      </div>
      <Link className="go" style={{ display: 'inline-block', marginTop: 12, padding: '3px 12px', fontSize: 12, background: 'var(--gold)', color: '#000', fontWeight: 800 }} to={`/student/${m.id}`}>
        view profile &rarr;
      </Link>
      <div className="m" style={{ fontSize: 12, marginTop: 12 }}>git log --points</div>
      <div className="log">
        {sorted.map((e, k) => (
          <div key={k}>
            <span className={`p ${e.p < 0 ? 'neg' : ''}`}>{e.p > 0 ? '+' : ''}{e.p}</span>
            <span>
              {e.l || 'No reason recorded'}
              <small className="m"> {shortDate(season, e.d)}</small>
            </span>
          </div>
        ))}
        {!sorted.length && <div className="m">No awards yet.</div>}
      </div>
    </>
  );
}

/* ------------------------------- rank race ------------------------------- */

function RankRace({ students, info, season }) {
  const today = season.today;
  const W = 760, H = 300, pl = 34, pr = 96, pt = 14, pb = 28;
  const top5 = students.slice(0, 5);
  const maxPts = Math.max(10, ...top5.map((m) => m.points));
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => maxPts / s <= 4.4) ?? 500;
  const ymax = step * Math.ceil((maxPts * 1.05) / step);
  const X = (d) => pl + (Math.min(d, today) / today) * (W - pl - pr);
  const Y = (v) => H - pb - (v / ymax) * (H - pt - pb);
  const days = [];
  for (let d = 0; d < today; d += 7) days.push(d);
  days.push(today);

  const ticks = [];
  for (let v = 0; v <= ymax; v += step) ticks.push(v);

  const months = [];
  for (let k = 0; k < 14; k++) {
    const d0 = new Date(season.start.getFullYear(), season.start.getMonth() + 1 + k, 1);
    const d = dayOf(season, d0);
    if (d > today - 2) break;
    months.push([d, d0.toLocaleDateString('en-US', { month: 'short' })]);
  }

  const [hl, setHl] = useState(null);
  const [read, setRead] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [drawn, setDrawn] = useState(reducedMotion() || /static/.test(location.search));
  const svgRef = useRef(null);

  useEffect(() => {
    if (drawn) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(svgRef.current);
    return () => io.disconnect();
  }, [drawn]);

  const move = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const d = Math.max(0, Math.min(today, Math.round(((sx - pl) / (W - pl - pr)) * today)));
    setCursor(d);
    setRead(`${shortDate(season, d)}  ${top5.map((m) => `${first(m.name)} ${info.cum(m.id, d)}`).join('  ')}`);
  };

  return (
    <div className="sp panel rv">
      <div className="pane-h">
        <span>
          <b>rank_race.plot</b> top 5, {shortDate(season, 0)} to {shortDate(season, today)}
        </span>
        <span className="hide-xs">cumulative points</span>
      </div>
      <div className="chart">
        <svg ref={svgRef} id="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of cumulative points for the top five members this season">
          {ticks.map((v) => (
            <Fragment key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.07)" strokeDasharray="2 4" />
              <text x={pl - 8} y={Y(v) + 4} textAnchor="end" fill="#6b6754" fontSize="11" fontFamily="JetBrains Mono">{v}</text>
            </Fragment>
          ))}
          {months.map(([d, l]) => (
            <text key={d} x={X(d)} y={H - 8} fill="#6b6754" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{l}</text>
          ))}
          {top5.map((m, i) => {
            const pts = days.map((d) => [X(d), Y(info.cum(m.id, d))]);
            const dd = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
            const end = pts[pts.length - 1];
            return (
              <g key={m.id} onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)}>
                <path
                  className={`ln ${hl != null && hl !== i ? 'd' : ''} ${hl === i ? 'h' : ''}`}
                  d={dd}
                  stroke={COL[i]}
                  pathLength="1"
                  strokeDasharray="1"
                  style={{
                    strokeDashoffset: drawn ? 0 : 1,
                    transition: `stroke-dashoffset 1.6s cubic-bezier(.65,0,.35,1) ${i * 120}ms,opacity .25s,stroke-width .25s`,
                  }}
                />
                <circle cx={end[0]} cy={end[1]} r="4" fill={COL[i]} />
                <text x={end[0] + 10} y={end[1] + 4} fill={COL[i]} fontSize="12" fontFamily="JetBrains Mono" fontWeight="700">
                  {first(m.name)} {m.points}
                </text>
              </g>
            );
          })}
          <line y1={pt} y2={H - pb} x1={cursor == null ? 0 : X(cursor)} x2={cursor == null ? 0 : X(cursor)} stroke="rgba(255,194,14,.6)" strokeDasharray="3 3" opacity={cursor == null ? 0 : 1} />
          <rect x={pl} y="0" width={W - pl - pr} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => { setCursor(null); setRead(null); }} />
        </svg>
      </div>
      <div className="read" aria-live="off">{read ?? 'move across the chart to read any week'}</div>
      <div className="legend">
        {top5.map((m, i) => (
          <button
            key={m.id}
            style={{ '--c': COL[i] }}
            className={hl === i ? 'h' : ''}
            onMouseEnter={() => setHl(i)}
            onFocus={() => setHl(i)}
            onMouseLeave={() => setHl(null)}
            onBlur={() => setHl(null)}
          >
            <i />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Feed({ students, info }) {
  const byId = new Map(students.map((s) => [s.id, s]));
  let list = info.evs.filter((e) => e.p >= 10 && byId.has(e.sid));
  if (list.length < 5) list = info.evs.filter((e) => e.p > 0 && byId.has(e.sid));
  list = [...list].sort((a, b) => b.t - a.t || b.p - a.p).slice(0, 9);
  const when = (t) => {
    const n = Math.floor((Date.now() - t) / DAY);
    return n <= 0 ? 'today' : `${n}d ago`;
  };
  return (
    <div className="sp panel rv" style={{ '--d': 1 }}>
      <div className="pane-h">
        <span><b>git log --points</b> recent awards</span>
        <span className="live2"><i />live</span>
      </div>
      <ul className="feed">
        {list.map((e, i) => (
          <li key={i} className="rv" style={{ '--d': i }}>
            <span className="h">{((e.d * 7919) % 65535 + 65535).toString(16).slice(-4)}{((e.p * 131) % 4096).toString(16).padStart(3, '0')}</span>
            <span className="who"><b>{byId.get(e.sid).name}</b> {e.l}</span>
            <span className="ago">{when(e.t)}</span>
            <span className="pp">+{e.p}</span>
          </li>
        ))}
        {!list.length && <li><span className="who">No awards yet.</span></li>}
      </ul>
    </div>
  );
}

/* ------------------------------- tier ladder ------------------------------- */

function TierLadder({ students, lead }) {
  const lanes = {};
  return (
    <section className="sec">
      <div className="wrap">
        <h2>Tier ladder <small>cat tiers.conf</small></h2>
        <p className="sub">
          Seven ranks. Close together at the bottom so you move fast in your first month, far apart at the top so Legend stays rare.
          Every member sits on the track at their tier.
        </p>
        <div className="track-wrap rv">
          <div className="track">
            {TIERS.map((t, i) => (
              <div key={t.name} className="seg" style={{ '--c': t.color }}>
                <div className="tn"><Crest i={i} cls="cs" />{t.name}</div>
                <div className="tm">{t.min}{TIERS[i + 1] ? ` to ${TIERS[i + 1].min}` : '+'}</div>
              </div>
            ))}
            <div className="rail" />
            {[...students].reverse().map((m) => {
              const t = tierIndex(m.points);
              const x = (t + tierProgress(m.points)) / TIERS.length;
              const l = (lanes[t] = (lanes[t] ?? -1) + 1) % 5;
              return (
                <div key={m.id} className={`tok ${m === lead ? 'first' : ''}`} tabIndex={0} style={{ '--c': TIERS[t].color, '--x': x, '--lane': l }}>
                  <i>{initials(m.name)}</i>
                  <span>{m.name}, {m.points} pts</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="trackhint">Hover or focus a token to see who it is.</p>
        <div className="stairs">
          {TIERS.map((t, i) => {
            const w = students.filter((m) => tierIndex(m.points) === i);
            return (
              <div key={t.name} className={`step sp rv ${i === 5 ? 'gd' : ''}`} style={{ '--c': t.color, '--d': i }}>
                <Crest i={i} cls="cr" />
                <h3>{t.name}</h3>
                <span className="mn">{t.min}+ pts</span>
                <p>{t.blurb}</p>
                <span className="who">{w.length ? w.map((m) => first(m.name)).join(', ') : 'nobody yet'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
