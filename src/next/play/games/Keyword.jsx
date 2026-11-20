/** Keyword: guess the hidden five-letter CS term in six tries. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Backspace } from '@phosphor-icons/react';
import { reducedMotion } from '../../../lib/ui.js';
import { cx } from '../../../ui/index.js';
import { SQUARE, dailyPicks, pointsFor, practicePicks, scoreGuess } from '../../../../shared/next/play/core.js';
import { ANSWERS } from '../../../../shared/next/play/words.js';
import { ALLOWED } from '../../../../shared/next/play/dict.js';
import { useGameState } from '../store.js';
import { Result, shareLink, useKeys } from '../kit.jsx';

const ROWS = 6;
const LEN = 5;
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const RANK = { miss: 1, near: 2, hit: 3 };
const FLIP_MS = 250; // per tile; keep in step with play.css

export default function Keyword({ daily, date, seed, finish, footer }) {
  const answer = useMemo(
    () => ANSWERS[daily ? dailyPicks('keyword', date, ANSWERS.length)[0] : practicePicks(ANSWERS.length, 1, seed)[0]],
    [daily, date, seed]
  );
  const [s, setS] = useGameState('keyword', date, () => ({ guesses: [], done: false, won: false }), daily);
  const [current, setCurrent] = useState('');
  const [fresh, setFresh] = useState(-1); // row that is flipping right now
  const [shown, setShown] = useState(s.guesses.length); // rows whose colours the keyboard may show
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState('');
  const [over, setOver] = useState(s.done);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (f, ms) => timers.current.push(setTimeout(f, ms));

  const marks = useMemo(() => s.guesses.map((g) => scoreGuess(g, answer.word)), [s.guesses, answer]);
  const keyState = useMemo(() => {
    const k = {};
    s.guesses.slice(0, shown).forEach((g, r) => [...g].forEach((ch, i) => {
      if ((RANK[marks[r][i]] || 0) > (RANK[k[ch]] || 0)) k[ch] = marks[r][i];
    }));
    return k;
  }, [s.guesses, marks, shown]);

  const say = (text) => {
    setMsg(text);
    later(() => setMsg(''), 1800);
  };

  const submit = () => {
    if (s.done) return;
    if (current.length < LEN) {
      setShake((n) => n + 1);
      return say('Not enough letters');
    }
    if (!ALLOWED.has(current)) {
      setShake((n) => n + 1);
      return say('Not in the word list');
    }
    const guesses = [...s.guesses, current];
    const won = current === answer.word;
    const done = won || guesses.length === ROWS;
    setS({ guesses, done, won });
    setCurrent('');
    setFresh(guesses.length - 1);
    const wait = reducedMotion() ? 0 : FLIP_MS * LEN + 300;
    later(() => setShown(guesses.length), wait);
    if (done) {
      const grid = guesses.map((g) => scoreGuess(g, answer.word).map((m) => SQUARE[m]).join('')).join('\n');
      finish({ score: pointsFor('keyword', { won, guesses: guesses.length }), guesses: guesses.length, detail: grid });
      later(() => setOver(true), wait + (won && !reducedMotion() ? 700 : 200));
    }
  };

  const press = (k) => {
    if (s.done) return;
    if (k === 'enter') return submit();
    if (k === 'back') return setCurrent((c) => c.slice(0, -1));
    if (/^[a-z]$/.test(k)) setCurrent((c) => (c.length < LEN ? c + k : c));
  };

  useKeys((e) => {
    const k = e.key === 'Enter' ? 'enter' : e.key === 'Backspace' ? 'back' : e.key.toLowerCase();
    if (k === 'enter' || k === 'back' || /^[a-z]$/.test(k)) {
      e.preventDefault();
      press(k);
    }
  }, !s.done);

  const rows = Array.from({ length: ROWS }, (_, r) => {
    if (r < s.guesses.length) return { letters: s.guesses[r], marks: marks[r] };
    if (r === s.guesses.length && !s.done) return { letters: current, marks: null, current: true };
    return { letters: '', marks: null };
  });

  const grid = s.guesses.map((g) => scoreGuess(g, answer.word).map((m) => SQUARE[m]).join('')).join('\n');
  const label = daily ? date : 'practice';

  return (
    <div className="pl-kw">
      <div className="pl-kw__board" role="grid" aria-label="Guesses">
        {rows.map((row, r) => (
          <div
            key={row.current ? `now-${shake}` : r}
            role="row"
            className={cx('pl-kw__row', row.current && shake > 0 && 'pl-shake', r === fresh && s.won && r === s.guesses.length - 1 && 'pl-kw__row--win')}
          >
            {Array.from({ length: LEN }, (_, i) => {
              const ch = row.letters[i] || '';
              const m = row.marks?.[i];
              return (
                <span
                  key={i}
                  role="gridcell"
                  aria-label={ch ? `${ch.toUpperCase()}${m ? `, ${m === 'hit' ? 'correct' : m === 'near' ? 'in the word, wrong spot' : 'not in the word'}` : ''}` : 'empty'}
                  className={cx('pl-kw__t', ch && 'pl-kw__t--full', m && `pl-kw__t--${m}`, m && r === fresh && 'pl-flip')}
                  style={{ '--i': i }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p className="pl-msg" role="status" aria-live="polite">{msg}</p>

      {over ? (
        <Result
          headline={s.won ? (s.guesses.length === 1 ? 'First try.' : `Solved in ${s.guesses.length}`) : `The word was ${answer.word.toUpperCase()}`}
          grid={grid}
          share={`Keyword ${label} ${s.won ? s.guesses.length : 'X'}/6\n${grid}\n${shareLink()}`}
          footer={footer}
        >
          <div className="pl-def">
            <p className="pl-def__w">{answer.word}</p>
            <p className="pl-def__d">{answer.def}</p>
          </div>
        </Result>
      ) : (
        // blur after each tap so a later physical Enter submits instead of re-pressing the last key
        <div className="pl-kb" role="group" aria-label="Keyboard" onClick={(e) => e.target.closest('button')?.blur()}>
          {KEYS.map((row, r) => (
            <div key={r} className="pl-kb__r">
              {r === 2 && (
                <button type="button" className="pl-kb__k pl-kb__k--wide" onClick={() => press('enter')}>Enter</button>
              )}
              {[...row].map((k) => (
                <button key={k} type="button" className={cx('pl-kb__k', keyState[k] && `pl-kb__k--${keyState[k]}`)} onClick={() => press(k)} aria-label={`${k.toUpperCase()}${keyState[k] ? `, ${keyState[k] === 'hit' ? 'correct' : keyState[k] === 'near' ? 'in the word' : 'not in the word'}` : ''}`}>
                  {k}
                </button>
              ))}
              {r === 2 && (
                <button type="button" className="pl-kb__k pl-kb__k--wide" onClick={() => press('back')} aria-label="Delete letter">
                  <Backspace size={20} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
