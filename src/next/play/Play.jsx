/**
 * /play: the game menu. Today's six games as big tiles with done or not,
 * the streak, the time until new puzzles, and the weekly club board for
 * signed-in members. The one loud page on the site.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fire, Check, Bug, Play as PlayIcon } from '@phosphor-icons/react';
import { Button, useSession, cx } from '../../ui/index.js';
import { api } from '../../lib/api.js';
import { chicagoDate, msToNextPuzzle } from '../../../shared/next/play/core.js';
import { streakFrom, sync, useResults } from './store.js';
import { playToday } from './today.js';
import './play.css';

const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

function useNow(every = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** The little picture on each tile. Decorative. */
function Motif({ slug }) {
  if (slug === 'keyword') {
    return (
      <span className="pl-motif pl-motif--kw" aria-hidden="true">
        {['b', 'y', 't', 'e', 's'].map((c, i) => <i key={i} className={i === 1 ? 'n' : i === 3 ? 'h' : ''}>{c}</i>)}
      </span>
    );
  }
  if (slug === 'buckets') return <span className="pl-motif pl-motif--bk" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} className={i < 4 ? 'on' : ''} />)}</span>;
  if (slug === 'squash') return <Bug className="pl-motif pl-motif--icon" size={44} weight="fill" aria-hidden="true" />;
  const text = { trace: '>_', 'order-up': 'O(n)', bits: '1011' }[slug];
  return <span className="pl-motif pl-motif--txt" aria-hidden="true">{text}</span>;
}

function WeekBoard({ user, results }) {
  const [board, setBoard] = useState(null);
  const finished = Object.keys(results).length; // refetch when a game is finished, not on every sync
  useEffect(() => {
    if (!user) return;
    let on = true;
    sync()
      .then(() => api.get('/play/board'))
      .then((b) => on && setBoard(b))
      .catch(() => on && setBoard({ rows: [], error: true }));
    return () => {
      on = false;
    };
  }, [user, finished]);

  if (!user) {
    return (
      <section className="pl-week" aria-labelledby="pl-week-h">
        <h2 id="pl-week-h" className="pl-week__h">This week in the club</h2>
        <p className="pl-week__p">Sign in to join the weekly board and keep your streak on every device. Games work without an account.</p>
        <Button to="/signin" variant="secondary">Sign in</Button>
      </section>
    );
  }
  return (
    <section className="pl-week" aria-labelledby="pl-week-h">
      <h2 id="pl-week-h" className="pl-week__h">This week in the club</h2>
      {!board ? (
        <p className="pl-week__p">Loading the board.</p>
      ) : board.error ? (
        <p className="pl-week__p">The board did not load. Your games still count.</p>
      ) : !board.rows.length ? (
        <p className="pl-week__p">Nobody has played this week yet. Finish a game to take the top spot.</p>
      ) : (
        <ol className="pl-week__list">
          {board.rows.map((r, i) => (
            <li key={i} className={cx(r.me && 'pl-week__me')}>
              <span className="pl-week__rank">{i + 1}</span>
              <span className="pl-week__name">{r.name}{r.me ? ' (you)' : ''}</span>
              <span className="pl-week__games">{r.games} {r.games === 1 ? 'game' : 'games'}</span>
              <span className="pl-week__pts">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="pl-small">Points from games here are just for fun. They never change club standings.</p>
    </section>
  );
}

export default function Play() {
  const { user } = useSession();
  const results = useResults();
  const now = useNow();
  const today = chicagoDate(now);
  const games = playToday(results, today);
  const done = games.filter((g) => g.done).length;
  const streak = streakFrom(results, today);
  const playedToday = done > 0;

  useEffect(() => {
    if (user) sync();
  }, [user]);

  return (
    <div className="ui-page pl-hub">
      <header className="pl-hero">
        <div className="pl-hero__main">
          <h1 className="pl-hero__t">Play</h1>
          <p className="pl-hero__s">
            {done === games.length ? 'All six done. ' : `${done} of ${games.length} done today. `}
            New puzzles in <time className="pl-hero__clock">{clock(msToNextPuzzle(now))}</time>
          </p>
        </div>
        <div className={cx('pl-streak', !playedToday && streak > 0 && 'pl-streak--risk')} role="img" aria-label={`${streak} day streak${!playedToday && streak > 0 ? ', play today to keep it' : ''}`}>
          <Fire size={30} weight="fill" aria-hidden="true" />
          <span className="pl-streak__n">{streak}</span>
          <span className="pl-streak__l">{streak === 1 ? 'day' : 'days'}</span>
        </div>
      </header>
      {!playedToday && streak > 0 && <p className="pl-hero__nudge">Finish any game today to keep your streak.</p>}

      <ul className="pl-cards">
        {games.map((g, i) => (
          <li key={g.slug} className={cx(i === 0 && 'pl-cards__first')}>
            <Link to={g.href} className="pl-card" data-tile={g.tile} data-done={g.done || undefined}>
              <Motif slug={g.slug} />
              <span className="pl-card__name">{g.name}</span>
              <span className="pl-card__blurb">{g.blurb}</span>
              <span className="pl-card__state">
                {g.done ? (
                  <><Check size={16} weight="bold" aria-hidden="true" /> Done, {g.score} pts</>
                ) : (
                  <><PlayIcon size={14} weight="fill" aria-hidden="true" /> Play</>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <WeekBoard user={user} results={results} />
    </div>
  );
}
