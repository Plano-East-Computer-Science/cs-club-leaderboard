/** Bit Flip: flip eight bits to hit five targets, as fast as you can. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx } from '../../../ui/index.js';
import { SQUARE, bitTargets, pointsFor } from '../../../../shared/next/play/core.js';
import { useGameState } from '../store.js';
import { Result, fmtTime, shareLink, useKeys } from '../kit.jsx';

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
const hex = (n) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

export default function Bits({ daily, date, seed, finish, footer }) {
  const targets = useMemo(() => bitTargets(seed), [seed]);
  const [s, setS] = useGameState('bits', date, () => ({ started: 0, round: 0, value: 0, ms: 0, done: false }), daily);
  const [now, setNow] = useState(Date.now);
  const [hit, setHit] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  useEffect(() => {
    if (!s.started || s.done) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [s.started, s.done]);

  const target = targets[s.round];
  const flip = (w) => {
    if (!s.started || s.done || hit) return;
    setS((cur) => ({ ...cur, value: cur.value ^ w })); // functional: fast taps must not drop a flip
  };

  // Target hit: a short beat to see it land, then the next one (or the finish).
  useEffect(() => {
    if (!s.started || s.done || hit || s.value !== target.value) return;
    setHit(true);
    t.current = setTimeout(() => {
      setHit(false);
      if (s.round + 1 < targets.length) return setS((cur) => ({ ...cur, round: cur.round + 1, value: 0 }));
      const ms = Date.now() - s.started;
      finish({ score: pointsFor('bits', { ms }), ms, detail: SQUARE.hit.repeat(targets.length) });
      setS((cur) => ({ ...cur, ms, done: true }));
    }, 450);
  }, [s, hit, target, targets.length, finish, setS]);

  useKeys((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 8) flip(WEIGHTS[n - 1]);
  }, Boolean(s.started) && !s.done);

  if (s.done) {
    const grid = SQUARE.hit.repeat(targets.length);
    return (
      <Result
        headline={`Five targets in ${fmtTime(s.ms)}`}
        sub={`${pointsFor('bits', { ms: s.ms })} points. Thirty seconds or less is a perfect run.`}
        grid={grid}
        share={`Bit Flip ${daily ? date : 'practice'} ${fmtTime(s.ms)}\n${grid}\n${shareLink()}`}
        footer={footer}
      >
        <ul className="pl-bits__recap">
          {targets.map((x, k) => (
            <li key={k}><span>{x.hex ? hex(x.value) : x.value}</span> <code>{x.value.toString(2).padStart(8, '0')}</code></li>
          ))}
        </ul>
      </Result>
    );
  }

  if (!s.started) {
    return (
      <div className="pl-start">
        <p className="pl-start__t pl-mono">0000 0000</p>
        <p className="pl-start__t">Five numbers. Eight bits. The clock starts when you do.</p>
        <Button variant="primary" size="lg" onClick={() => { setNow(Date.now()); setS({ ...s, started: Date.now() }); }}>Start</Button>
      </div>
    );
  }

  return (
    <div className="pl-bits">
      <div className="pl-status">
        <span>Target {s.round + 1} of {targets.length}</span>
        <span role="timer">{fmtTime(now - s.started)}</span>
      </div>
      <p className={cx('pl-bits__target', hit && 'pl-pop')} aria-live="polite">
        <span className="pl-small">Make</span>
        {target.hex ? hex(target.value) : target.value}
      </p>
      <div className="pl-bits__row" role="group" aria-label="Bits">
        {WEIGHTS.map((w, k) => {
          const on = Boolean(s.value & w);
          return (
            <button key={w} type="button" aria-pressed={on} aria-label={`Bit worth ${w}`} className={cx('pl-bit', on && 'pl-bit--on', hit && 'pl-bit--hit')} onClick={() => flip(w)}>
              <span className="pl-bit__v">{on ? 1 : 0}</span>
              <span className="pl-bit__w">{w}</span>
              <span className="pl-bit__k" aria-hidden="true">{k + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="pl-bits__now">
        Now <strong>{s.value}</strong> <span className="pl-mono">{hex(s.value)}</span>
      </p>
    </div>
  );
}
