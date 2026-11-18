import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { LINES, QUESTS } from '../../shared/quests.js';
import { RANKS } from '../../shared/ranks.js';
import { POINT_RULES } from '../../shared/points.js';

const meter = (n, of, w = 12) => {
  const k = Math.round((n / (of || 1)) * w);
  return `[${'#'.repeat(k)}${'-'.repeat(w - k)}]`;
};

/** Thin gold bar: how far through the current rank, by lifetime points. */
export function RankBar({ points, rank, next }) {
  const floor = RANKS.find((r) => r.id === rank)?.min ?? 0;
  const pct = next ? Math.min(100, ((points - floor) / (next.min - floor)) * 100) : 100;
  return (
    <div className="rankbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Progress to next rank">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One quest. `points` is what it paid (0 once the season cap is hit), null if not yet paid. */
export function QuestRow({ q, bonus = POINT_RULES.quest.points }) {
  return (
    <Link to={q.to} className={q.done ? 'done' : undefined}>
      <span className="bx" aria-hidden="true">{q.done ? '[x]' : '[ ]'}</span>
      <span className="qt">{q.title}{q.done && <span className="sr-only"> (done)</span>}</span>
      <span className="qx">{q.done && q.points != null ? `+${q.points} pts` : `+${bonus} pts`}</span>
      <span className="qd">{q.desc}</span>
      {!q.done && q.need > 1 && <span className="qp">{meter(q.have, q.need)} {q.have}/{q.need}</span>}
    </Link>
  );
}

export default function Quests() {
  const [d, setD] = useState(null);
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState('');
  useReveal();

  useEffect(() => {
    api.get('/me/quests').then(setD).catch((e) => (e.status === 401 ? setGuest(true) : setError(e.message)));
  }, []);

  if (error) return <div className="state-note bad">{error}</div>;
  if (!d && !guest) return <div className="state-note">loading quests...</div>;

  // Signed out: show the whole list, nothing ticked, so people can see what there is to earn.
  const quests = d?.quests ?? QUESTS.map(({ have, ...q }) => ({ ...q, have: 0, done: false, points: null }));
  const done = quests.filter((q) => q.done).length;
  const bonus = d?.bonus ?? POINT_RULES.quest.points;
  const cap = d?.seasonCap ?? POINT_RULES.quest.seasonPoints;

  return (
    <>
      <PageHead
        eyebrow="quests --all"
        title={<>Do things. <em>Earn a bonus.</em></>}
        lead={
          guest
            ? 'Quests track what you do here: lessons, meetings, projects. Sign in and anything you have already done counts.'
            : `Quests tick themselves off as you use the site. Each one pays ${bonus} points once, up to ${cap} a season, so they help but never decide the prize.`
        }
        kv={
          d ? (
            <div className="kv">
              <div><span>rank</span><strong>{d.rankName}</strong></div>
              <div><span>season pts</span><strong>{d.points}</strong></div>
              <div><span>quests</span><strong>{done}/{quests.length}</strong></div>
            </div>
          ) : (
            <Link className="btn" to="/signin" style={{ justifySelf: 'start' }}>Sign in to start</Link>
          )
        }
      />

      <section className="sec">
        <div className="wrap">
          {d && (
            <div style={{ marginBottom: 22, maxWidth: 640 }}>
              <p className="d" style={{ fontSize: 13 }}>
                {d.next ? (
                  <><b className="g">{d.rankName}</b> to <b style={{ color: 'var(--text)' }}>{d.next.name}</b>: {d.next.min - d.peak} lifetime points to go</>
                ) : (
                  <>You are <b className="g">{d.rankName}</b>. There is nothing above this.</>
                )}
              </p>
              <RankBar points={d.peak} rank={d.rank} next={d.next} />
            </div>
          )}

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
            {LINES.map((line) => {
              const list = quests.filter((q) => q.line === line.id);
              return (
                <Pane key={line.id} file={line.name.toLowerCase().replace(/ /g, '-')} meta={`${list.filter((q) => q.done).length}/${list.length} · ${line.blurb}`}>
                  <div className="ql">{list.map((q) => <QuestRow key={q.id} q={q} bonus={bonus} />)}</div>
                </Pane>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Ranks <small>cat /etc/ranks</small></h2>
          <p className="sub">
            One number, points. Season points reset each semester and decide the prize. Your rank comes from all the points you have
            ever earned, and it never goes down.
          </p>
          <div className="kv" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginTop: 0 }}>
            {RANKS.map((r) => (
              <div key={r.id} style={d?.rank === r.id ? { background: 'var(--panel2)', boxShadow: 'inset 0 -2px 0 var(--gold)' } : undefined}>
                <span>{r.min} pts</span>
                <strong style={{ fontSize: 20, color: d && d.peak >= r.min ? r.color : 'var(--mute)' }}>{r.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
