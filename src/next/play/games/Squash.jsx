/** Squash: three methods, one buggy line each. Tap the line, pick the fix. */
import { useMemo } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { Button, cx } from '../../../ui/index.js';
import { SQUARE, dailyPicks, pointsFor, practicePicks, shuffle } from '../../../../shared/next/play/core.js';
import { BUGS } from '../../../../shared/next/play/bugs.js';
import { useGameState } from '../store.js';
import { Hearts, Hl, Result, shareLink } from '../kit.jsx';

const COUNT = 3;
const LIVES = 3;

/* Per bug: { line: [wrong line picks], found, fix: [wrong fix picks], fixed, over } */
const blank = () => ({ lines: [], found: false, fixes: [], fixed: false, over: false });

export default function Squash({ daily, date, seed, finish, footer }) {
  const picks = useMemo(() => (daily ? dailyPicks('squash', date, BUGS.length, COUNT) : practicePicks(BUGS.length, COUNT, seed)), [daily, date, seed]);
  const [s, setS] = useGameState('squash', date, () => ({ i: 0, bugs: [blank()], done: false }), daily);

  const mistakes = s.bugs.reduce((n, b) => n + b.lines.length + b.fixes.length, 0);
  const lives = LIVES - mistakes;
  const bug = BUGS[picks[s.i]];
  const st = s.bugs[s.i];
  const lines = bug.code.split('\n');
  const fixOrder = useMemo(() => shuffle([0, 1, 2], `squash:${seed}:${s.i}`), [seed, s.i]);
  const fixedCount = s.bugs.filter((b) => b.fixed).length;
  const square = (b) => (!b ? SQUARE.miss : b.fixed ? (b.lines.length + b.fixes.length ? SQUARE.near : SQUARE.hit) : SQUARE.bad);
  const gridOf = (bugs) => picks.map((_, k) => square(bugs[k])).join('');

  const update = (patch) => {
    const bugs = s.bugs.map((b, k) => (k === s.i ? { ...b, ...patch } : b));
    const used = bugs.reduce((n, b) => n + b.lines.length + b.fixes.length, 0);
    if (used >= LIVES && !bugs[s.i].fixed) bugs[s.i] = { ...bugs[s.i], over: true };
    setS({ ...s, bugs });
  };

  const tapLine = (k) => {
    if (st.found || st.over) return;
    if (k === bug.bug) update({ found: true });
    else if (!st.lines.includes(k)) update({ lines: [...st.lines, k] });
  };
  const pickFix = (f) => {
    if (!st.found || st.fixed || st.over || st.fixes.includes(f)) return;
    if (f === 0) update({ fixed: true, over: true });
    else update({ fixes: [...st.fixes, f] });
  };
  const next = () => {
    const end = lives <= 0 || s.i + 1 === COUNT;
    if (end) {
      const fixed = s.bugs.filter((b) => b.fixed).length;
      finish({ score: pointsFor('squash', { fixed, mistakes }), guesses: mistakes, detail: gridOf(s.bugs) });
      setS({ ...s, done: true });
    } else setS({ ...s, i: s.i + 1, bugs: [...s.bugs, blank()] });
  };

  if (s.done) {
    const grid = gridOf(s.bugs);
    return (
      <Result
        headline={fixedCount === COUNT && mistakes === 0 ? 'Clean sweep.' : `${fixedCount} of ${COUNT} squashed`}
        sub={mistakes ? `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} along the way.` : null}
        grid={grid}
        share={`Squash ${daily ? date : 'practice'} ${fixedCount}/${COUNT}\n${grid}\n${shareLink()}`}
        footer={footer}
      />
    );
  }

  const fixText = (f) => (bug.fixes[f] === '' ? null : bug.fixes[f].trim());

  return (
    <div className="pl-sq">
      <div className="pl-status">
        <span>Bug {s.i + 1} of {COUNT}</span>
        <Hearts left={Math.max(0, lives)} />
      </div>
      <p className="pl-q">{bug.goal}</p>
      <p className="pl-small">{st.over ? (st.fixed ? 'Squashed.' : 'Here is the fix.') : st.found ? 'Found it. Now pick the fix.' : 'Tap the line with the bug.'}</p>

      <ol className="pl-lines" aria-label="Code, one button per line">
        {lines.map((l, k) => {
          const isBug = k === bug.bug;
          const state = st.lines.includes(k) ? 'wrong' : isBug && (st.found || st.over) ? (st.over ? 'fixed' : 'found') : null;
          return (
            <li key={k}>
              <button type="button" className={cx('pl-line', state && `pl-line--${state}`, st.lines.at(-1) === k && 'pl-shake')} onClick={() => tapLine(k)} disabled={st.found || st.over} aria-label={`Line ${k + 1}: ${l.trim() || 'blank'}`}>
                <span className="pl-line__n" aria-hidden="true">{k + 1}</span>
                <code className={cx(isBug && st.over && 'pl-line__old')}><Hl line={l} /></code>
              </button>
              {isBug && st.over && (
                <div className="pl-line pl-line--new">
                  <span className="pl-line__n" aria-hidden="true">+</span>
                  <code>{fixText(0) === null ? <em className="pl-none">(delete this line)</em> : <Hl line={bug.fixes[0]} />}</code>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {st.found && !st.over && (
        <div className="pl-opts" role="group" aria-label="Possible fixes">
          {fixOrder.map((f, k) => (
            <button key={f} type="button" className={cx('pl-opt', st.fixes.includes(f) && 'pl-opt--wrong')} onClick={() => pickFix(f)} disabled={st.fixes.includes(f)}>
              <span className="pl-opt__k" aria-hidden="true">{k + 1}</span>
              {fixText(f) === null ? <em className="pl-none">Delete this line</em> : <code><Hl line={fixText(f)} /></code>}
            </button>
          ))}
        </div>
      )}

      {st.over && (
        <div className={cx('pl-why', st.fixed ? 'pl-why--ok' : 'pl-why--bad')} role="status">
          <p><strong>{st.fixed ? 'Fixed.' : 'Out of lives.'}</strong> {bug.why}</p>
          <Button variant="primary" iconRight={CaretRight} onClick={next} autoFocus>
            {lives <= 0 || s.i + 1 === COUNT ? 'See result' : 'Next bug'}
          </Button>
        </div>
      )}
    </div>
  );
}
