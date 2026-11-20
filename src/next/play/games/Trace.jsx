/** Trace: five Java snippets, pick the exact output, three lives. */
import { useMemo } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { Button, cx } from '../../../ui/index.js';
import { SQUARE, dailyPicks, pointsFor, practicePicks, shuffle } from '../../../../shared/next/play/core.js';
import { SNIPPETS } from '../../../../shared/next/play/trace.js';
import { useGameState } from '../store.js';
import { Code, Hearts, Result, shareLink, useKeys } from '../kit.jsx';

const COUNT = 5;
const LIVES = 3;

const Output = ({ text }) => (text === '' ? <em className="pl-none">(nothing printed)</em> : <pre>{text}</pre>);

export default function Trace({ daily, date, seed, finish, footer }) {
  const picks = useMemo(() => {
    const idx = daily ? dailyPicks('trace', date, SNIPPETS.length, COUNT) : practicePicks(SNIPPETS.length, COUNT, seed);
    return idx.sort((a, b) => SNIPPETS[a].level - SNIPPETS[b].level || a - b);
  }, [daily, date, seed]);
  const [s, setS] = useGameState('trace', date, () => ({ i: 0, picked: [], done: false }), daily);

  const lives = LIVES - s.picked.filter((p, k) => p !== SNIPPETS[picks[k]].out).length;
  const snip = SNIPPETS[picks[s.i]];
  const options = useMemo(() => (snip ? shuffle([snip.out, ...snip.wrong], `trace:${seed}:${s.i}`) : []), [snip, seed, s.i]);
  const answered = s.picked.length > s.i;
  const correct = s.picked.filter((p, k) => p === SNIPPETS[picks[k]].out).length;
  const grid = picks.map((p, k) => (k >= s.picked.length ? SQUARE.miss : s.picked[k] === SNIPPETS[p].out ? SQUARE.hit : SQUARE.bad)).join('');

  const pick = (o) => {
    if (answered || s.done) return;
    const picked = [...s.picked, o];
    const left = LIVES - picked.filter((p, k) => p !== SNIPPETS[picks[k]].out).length;
    setS({ ...s, picked });
    if (left === 0 || picked.length === COUNT) {
      const right = picked.filter((p, k) => p === SNIPPETS[picks[k]].out).length;
      const g = picks.map((p, k) => (k >= picked.length ? SQUARE.miss : picked[k] === SNIPPETS[p].out ? SQUARE.hit : SQUARE.bad)).join('');
      finish({ score: pointsFor('trace', { correct: right }), guesses: picked.length, detail: g });
    }
  };
  const next = () => setS({ ...s, i: s.i + 1, done: lives === 0 || s.i + 1 === COUNT });

  useKeys((e) => {
    const n = Number(e.key);
    if (!answered && n >= 1 && n <= 4) pick(options[n - 1]);
    else if (answered && e.key === 'Enter') next();
  }, !s.done);

  if (s.done) {
    return (
      <Result
        headline={correct === COUNT ? 'Five for five.' : `${correct} of ${COUNT} right`}
        sub={lives === 0 ? 'Out of lives. The ones you missed are explained below.' : null}
        grid={grid}
        share={`Trace ${daily ? date : 'practice'} ${correct}/${COUNT}\n${grid}\n${shareLink()}`}
        footer={footer}
      >
        <ol className="pl-recap">
          {s.picked.map((p, k) => {
            const sn = SNIPPETS[picks[k]];
            return p === sn.out ? null : (
              <li key={k}>
                <p className="pl-recap__t">{sn.topic}</p>
                <Code code={(sn.helpers ? `${sn.helpers}\n\n` : '') + sn.code} />
                <p>Prints <Output text={sn.out} />. {sn.why}</p>
              </li>
            );
          })}
        </ol>
      </Result>
    );
  }

  return (
    <div className="pl-tr">
      <div className="pl-status">
        <span>Snippet {s.i + 1} of {COUNT}</span>
        <Hearts left={lives} />
      </div>
      <p className="pl-q">What does this print?</p>
      <Code code={(snip.helpers ? `${snip.helpers}\n\n` : '') + snip.code} />
      <div className="pl-opts" role="group" aria-label="Possible outputs">
        {options.map((o, k) => {
          const state = !answered ? null : o === snip.out ? 'right' : o === s.picked[s.i] ? 'wrong' : 'dim';
          return (
            <button key={o} type="button" className={cx('pl-opt', state && `pl-opt--${state}`)} onClick={() => pick(o)} disabled={answered} aria-label={`${k + 1}: ${o === '' ? 'nothing printed' : o}`}>
              <span className="pl-opt__k" aria-hidden="true">{k + 1}</span>
              <Output text={o} />
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={cx('pl-why', s.picked[s.i] === snip.out ? 'pl-why--ok' : 'pl-why--bad')} role="status">
          <p><strong>{s.picked[s.i] === snip.out ? 'Right.' : 'Not quite.'}</strong> {snip.why}</p>
          <Button variant="primary" iconRight={CaretRight} onClick={next} autoFocus>
            {lives === 0 || s.i + 1 === COUNT ? 'See result' : 'Next snippet'}
          </Button>
        </div>
      )}
    </div>
  );
}
