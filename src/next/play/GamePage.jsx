/**
 * /play/:game: the frame around every game. Daily or practice, the how-to
 * dialog (shown the first time), saving the daily result, and what to do
 * next once a round ends.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Question, ArrowsClockwise, CaretRight, Check } from '@phosphor-icons/react';
import { Button, Dialog, EmptyState, SkeletonList, useSession } from '../../ui/index.js';
import { chicagoDate, gameBySlug } from '../../../shared/next/play/core.js';
import { getResult, hasState, readLocal, recordResult, sync, useResults, writeLocal } from './store.js';
import { playToday } from './today.js';
import { Grid, Result, shareLink } from './kit.jsx';
import './play.css';

const GAME = {
  keyword: lazy(() => import('./games/Keyword.jsx')),
  trace: lazy(() => import('./games/Trace.jsx')),
  buckets: lazy(() => import('./games/Buckets.jsx')),
  'order-up': lazy(() => import('./games/OrderUp.jsx')),
  squash: lazy(() => import('./games/Squash.jsx')),
  bits: lazy(() => import('./games/Bits.jsx')),
};

const HOW = {
  keyword: [
    'Guess the hidden CS or engineering term in six tries. Every answer is five letters.',
    'After each guess the tiles change color. Green: right letter, right spot. Yellow: in the word, wrong spot. Grey: not in the word.',
    'Type on your keyboard or tap the keys. When you finish you get the term\'s definition.',
  ],
  trace: [
    'Read a short Java snippet and pick exactly what it prints.',
    'There are five snippets, easiest first, and you have three lives. A wrong pick costs one and shows why.',
    'Keys 1 to 4 pick an answer.',
  ],
  buckets: [
    'Sixteen tiles hide four groups of four. Select four that belong together and press Submit.',
    'Groups go from easy to sneaky. Some tiles look like they fit two groups; only one answer works for the whole board.',
    'You can make four mistakes.',
  ],
  'order-up': [
    'You have sixty seconds. For each snippet, pick its worst-case time complexity in terms of n.',
    'A wrong pick costs two seconds and shows the right answer. Keys 1 to 6 work too.',
    'One daily run per day. Practice as often as you like.',
  ],
  squash: [
    'Each method has exactly one buggy line. Read what it should do, tap the buggy line, then pick the fix.',
    'Three bugs a day, three lives in total. A wrong line or wrong fix costs one.',
  ],
  bits: [
    'Flip the eight bits until they add up to the target. Each bit is worth twice the one to its right.',
    'Five targets; the last two are written in hexadecimal. Your time is the score. Keys 1 to 8 flip bits from the left.',
  ],
};

const seen = (slug) => readLocal(`next:play:seen:${slug}`, false);
const newSeed = () => Math.random().toString(36).slice(2, 10);
const longDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** A finished daily game opened on another device: the saved result, without replaying it. */
function SavedResult({ meta, result, footer }) {
  return (
    <Result
      headline={`Done for today: ${result.score} points`}
      sub="You finished this one on another device or in another tab."
      grid={result.detail}
      share={result.detail ? `${meta.name} ${result.date}\n${result.detail}\n${shareLink()}` : null}
      footer={footer}
    />
  );
}

export default function GamePage() {
  const { game } = useParams();
  const meta = gameBySlug(game);
  const { user } = useSession();
  const results = useResults();
  const [date] = useState(chicagoDate);
  const [mode, setMode] = useState('daily');
  const [seed, setSeed] = useState(newSeed);
  const [how, setHow] = useState(() => Boolean(meta) && !seen(game));

  useEffect(() => {
    if (user) sync();
  }, [user]);
  useEffect(() => {
    setMode('daily');
    setHow(Boolean(meta) && !seen(game));
  }, [game, meta]);

  const closeHow = (open) => {
    setHow(open);
    if (!open) writeLocal(`next:play:seen:${game}`, true);
  };

  const finish = useCallback(
    (r) => {
      if (mode === 'daily') recordResult({ game, date, ...r }, Boolean(user));
    },
    [mode, game, date, user]
  );

  if (!meta) {
    return (
      <div className="ui-page">
        <EmptyState action={<Button to="/play" variant="secondary">All games</Button>}>There is no game at this address.</EmptyState>
      </div>
    );
  }

  const Game = GAME[game];
  const daily = mode === 'daily';
  const saved = getResult(game, date);
  const next = playToday(results, date).find((g) => !g.done && g.slug !== game);
  const practice = () => {
    setSeed(newSeed());
    setMode('practice');
  };
  const footer = (
    <>
      {daily && next ? (
        <Button to={next.href} iconRight={CaretRight}>Next: {next.name}</Button>
      ) : daily ? (
        <Button to="/play" icon={Check}>All done today</Button>
      ) : null}
      <Button variant="ghost" icon={ArrowsClockwise} onClick={practice}>{daily ? 'Practice round' : 'New round'}</Button>
    </>
  );

  return (
    <div className="ui-page pl-page" data-tile={meta.tile}>
      <header className="pl-bar">
        <Link to="/play" className="pl-bar__back" aria-label="All games">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div className="pl-bar__t">
          <h1>{meta.name}</h1>
          <p>{daily ? longDate(date) : 'Practice round, not saved'}</p>
        </div>
        <button type="button" className="pl-bar__help" onClick={() => setHow(true)} aria-label={`How to play ${meta.name}`}>
          <Question size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="pl-modes" role="group" aria-label="Mode">
        <button type="button" aria-pressed={daily} onClick={() => setMode('daily')}>Today</button>
        <button type="button" aria-pressed={!daily} onClick={() => (daily ? practice() : null)}>Practice</button>
      </div>

      <Suspense fallback={<SkeletonList rows={3} label="Loading the game" />}>
        {daily && saved && !hasState(game, date) ? (
          <SavedResult meta={meta} result={saved} footer={footer} />
        ) : (
          <Game key={daily ? `d:${date}` : `p:${seed}`} daily={daily} date={date} seed={daily ? date : seed} finish={finish} footer={footer} />
        )}
      </Suspense>

      <Dialog open={how} onOpenChange={closeHow} title={`How to play ${meta.name}`} className="pl-how">
        {HOW[game].map((p) => <p key={p}>{p}</p>)}
        {game === 'keyword' && (
          <div className="pl-how__ex" aria-hidden="true">
            <Grid text={'🟩🟨⬛⬛⬛'} />
          </div>
        )}
        <Button variant="primary" onClick={() => closeHow(false)}>Play</Button>
      </Dialog>
    </div>
  );
}
