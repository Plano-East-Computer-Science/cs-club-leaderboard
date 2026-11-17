import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { LINES, QUESTS, RANKS, XP } from '../../shared/quests.js';

const meter = (n, of, w = 12) => {
  const k = Math.round((n / (of || 1)) * w);
  return `[${'#'.repeat(k)}${'-'.repeat(w - k)}]`;
};

/** Thin gold bar: how far through the current rank. */
export function RankBar({ xp, rank, next }) {
  const floor = RANKS.find((r) => r.id === rank)?.min ?? 0;
  const pct = next ? Math.min(100, ((xp - floor) / (next.min - floor)) * 100) : 100;
  return (
    <div className="rankbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Progress to next rank">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function QuestRow({ q }) {
  return (
    <Link to={q.to} className={q.done ? 'done' : undefined}>
      <span className="bx" aria-hidden="true">{q.done ? '[x]' : '[ ]'}</span>
      <span className="qt">{q.title}{q.done && <span className="sr-only"> (done)</span>}</span>
      <span className="qx">+{q.xp} xp</span>
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
  const quests = d?.quests ?? QUESTS.map(({ have, ...q }) => ({ ...q, have: 0, done: false }));
  const done = quests.filter((q) => q.done).length;

  return (
    <>
      <PageHead
        eyebrow="quests --all"
        title={<>Do things. <em>Rank up.</em></>}
        lead={
          guest
            ? 'Quests track what you do here: lessons, meetings, projects. Sign in and anything you have already done counts.'
            : 'Quests tick themselves off as you use the site. XP gives you a rank on your portfolio. It is separate from leaderboard points, which officers award.'
        }
        kv={
          d ? (
            <div className="kv">
              <div><span>rank</span><strong>{d.rank}</strong></div>
              <div><span>xp</span><strong>{d.xp}</strong></div>
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
                  <><b className="g">{d.rank}</b> to <b style={{ color: 'var(--text)' }}>{d.next.id}</b>: {d.next.min - d.xp} xp to go</>
                ) : (
                  <>You are <b className="g">root</b>. There is nothing above this.</>
                )}
              </p>
              <RankBar xp={d.xp} rank={d.rank} next={d.next} />
            </div>
          )}

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
            {LINES.map((line) => {
              const list = quests.filter((q) => q.line === line.id);
              return (
                <Pane key={line.id} file={line.name.toLowerCase().replace(/ /g, '-')} meta={`${list.filter((q) => q.done).length}/${list.length} · ${line.blurb}`}>
                  <div className="ql">{list.map((q) => <QuestRow key={q.id} q={q} />)}</div>
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
            Every passed step is {XP.step} xp, a meeting is {XP.meeting}, a posted project is {XP.project}. Quests add a bonus on top.
          </p>
          <div className="kv" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginTop: 0 }}>
            {RANKS.map((r) => (
              <div key={r.id} style={d?.rank === r.id ? { background: 'var(--panel2)', boxShadow: 'inset 0 -2px 0 var(--gold)' } : undefined}>
                <span>{r.min} xp</span>
                <strong style={{ fontSize: 22, color: d && d.xp >= r.min ? 'var(--gold)' : 'var(--mute)' }}>{r.id}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
