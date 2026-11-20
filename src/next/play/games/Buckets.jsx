/** Buckets: sixteen tiles, four hidden groups of four, four mistakes allowed. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle } from '@phosphor-icons/react';
import { Button, cx } from '../../../ui/index.js';
import { SQUARE, dailyPicks, pointsFor, practicePicks, shuffle } from '../../../../shared/next/play/core.js';
import { BOARDS } from '../../../../shared/next/play/buckets.js';
import { useGameState } from '../store.js';
import { Result, shareLink } from '../kit.jsx';

const MISTAKES = 4;
const LEVEL_SQUARE = [SQUARE.near, SQUARE.hit, SQUARE.blue, SQUARE.purple];
const LEVEL_NAME = ['easiest', 'medium', 'hard', 'hardest'];

export default function Buckets({ daily, date, seed, finish, footer }) {
  const board = useMemo(() => BOARDS[daily ? dailyPicks('buckets', date, BOARDS.length)[0] : practicePicks(BOARDS.length, 1, seed)[0]], [daily, date, seed]);
  const levelOf = useMemo(() => Object.fromEntries(board.groups.flatMap((g) => g.terms.map((t) => [t, g.level]))), [board]);
  const [s, setS] = useGameState(
    'buckets',
    date,
    () => ({ order: shuffle(board.groups.flatMap((g) => g.terms), `buckets:${seed}`), solved: [], tries: [], done: false }),
    daily
  );
  const [sel, setSel] = useState([]);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState('');
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (t) => {
    setMsg(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2000);
  };

  const mistakes = s.tries.filter((t) => new Set(t.map((x) => levelOf[x])).size > 1).length;
  const left = s.order.filter((t) => !s.solved.includes(levelOf[t]));
  const grid = s.tries.map((t) => t.map((x) => LEVEL_SQUARE[levelOf[x]]).join('')).join('\n');
  const won = s.solved.length === 4 && mistakes < MISTAKES;

  const toggle = (t) => {
    if (s.done) return;
    setSel((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 4 ? [...cur, t] : cur));
  };

  const submit = () => {
    if (sel.length !== 4 || s.done) return;
    const key = [...sel].sort().join('|');
    if (s.tries.some((t) => [...t].sort().join('|') === key)) return say('You already tried that group.');
    const tries = [...s.tries, sel];
    const levels = sel.map((x) => levelOf[x]);
    const counts = levels.reduce((m, l) => ((m[l] = (m[l] || 0) + 1), m), {});
    let solved = s.solved;
    if (Object.keys(counts).length === 1) {
      solved = [...solved, levels[0]];
      setSel([]);
    } else {
      setShake((n) => n + 1);
      if (Object.values(counts).includes(3)) say('One away.');
    }
    const miss = tries.filter((t) => new Set(t.map((x) => levelOf[x])).size > 1).length;
    const done = solved.length === 4 || miss >= MISTAKES;
    if (done && miss >= MISTAKES) {
      const found = solved.length;
      solved = [...solved, ...[0, 1, 2, 3].filter((l) => !solved.includes(l))]; // reveal the rest
      setSel([]);
      finish({ score: pointsFor('buckets', { won: false, found }), guesses: tries.length, detail: tries.map((t) => t.map((x) => LEVEL_SQUARE[levelOf[x]]).join('')).join('\n') });
    } else if (done) {
      finish({ score: pointsFor('buckets', { won: true, mistakes: miss }), guesses: tries.length, detail: tries.map((t) => t.map((x) => LEVEL_SQUARE[levelOf[x]]).join('')).join('\n') });
    }
    setS({ ...s, tries, solved, done });
  };

  return (
    <div className="pl-bk">
      <div className="pl-bk__solved">
        {s.solved.map((l) => {
          const g = board.groups[l];
          return (
            <div key={l} className={`pl-bk__group pl-lv-${l}`}>
              <p className="pl-bk__label">{g.label}</p>
              <p className="pl-bk__terms">{g.terms.join(', ')}</p>
            </div>
          );
        })}
      </div>

      {left.length > 0 && (
        <div className="pl-bk__tiles" role="group" aria-label="Tiles">
          {left.map((t) => (
            <button
              key={sel.includes(t) ? `${t}-${shake}` : t}
              type="button"
              aria-pressed={sel.includes(t)}
              className={cx('pl-bk__tile', sel.includes(t) && 'pl-bk__tile--on', sel.includes(t) && shake > 0 && 'pl-shake', t.length > 9 && 'pl-bk__tile--long')}
              onClick={() => toggle(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <p className="pl-msg" role="status" aria-live="polite">{msg}</p>

      {s.done ? (
        <Result
          headline={won ? (mistakes === 0 ? 'Perfect board.' : `Solved with ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`) : 'Out of mistakes'}
          sub={won ? null : 'Here is how the board breaks down.'}
          grid={grid}
          share={`Buckets ${daily ? date : 'practice'}\n${grid}\n${shareLink()}`}
          footer={footer}
        >
          <p className="pl-small">Colors run from {LEVEL_NAME[0]} (yellow) to {LEVEL_NAME[3]} (purple).</p>
        </Result>
      ) : (
        <>
          <div className="pl-bk__left">
            <span>Mistakes left</span>
            <span className="pl-dots" role="img" aria-label={`${MISTAKES - mistakes} of ${MISTAKES} mistakes left`}>
              {Array.from({ length: MISTAKES }, (_, i) => <i key={i} className={i < MISTAKES - mistakes ? 'on' : ''} />)}
            </span>
          </div>
          <div className="pl-bk__ctl">
            <Button variant="ghost" icon={Shuffle} onClick={() => setS({ ...s, order: shuffle(s.order, Math.random()) })}>Shuffle</Button>
            <Button variant="secondary" onClick={() => setSel([])} disabled={!sel.length}>Deselect all</Button>
            <Button variant="primary" onClick={submit} disabled={sel.length !== 4}>Submit</Button>
          </div>
        </>
      )}
    </div>
  );
}
