/** Order Up: sixty seconds to classify as many snippets by Big-O as you can. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lightning, Trophy } from '@phosphor-icons/react';
import { Button, cx } from '../../../ui/index.js';
import { SQUARE, pointsFor, shuffle } from '../../../../shared/next/play/core.js';
import { BIGO, CLASSES } from '../../../../shared/next/play/bigo.js';
import { readLocal, useGameState, writeLocal } from '../store.js';
import { Code, Result, shareLink, useKeys } from '../kit.jsx';

const RUN_MS = 60_000;
const PENALTY_MS = 2000;
const SHOW_WRONG_MS = 1100;
const label = (id) => CLASSES.find((c) => c.id === id).label;

export default function OrderUp({ daily, date, seed, finish, footer }) {
  const order = useMemo(() => shuffle(BIGO.map((_, i) => i), `order-up:${seed}`), [seed]);
  const [s, setS] = useGameState('order-up', date, () => ({ started: 0, log: [], penalty: 0, done: false }), daily);
  const [now, setNow] = useState(Date.now);
  const [flash, setFlash] = useState(null); // { ok, ans } while feedback shows
  const [best, setBest] = useState(() => readLocal(`next:play:best:order-up:${daily ? 'daily' : 'practice'}`, 0));
  const flashT = useRef(0);
  useEffect(() => () => clearTimeout(flashT.current), []);

  const left = s.started ? Math.max(0, RUN_MS - (now - s.started) - s.penalty) : RUN_MS;
  const correct = s.log.filter((l) => l.ok).length;
  const item = BIGO[order[s.log.length % order.length]];
  const grid = s.log.map((l) => (l.ok ? SQUARE.hit : SQUARE.bad)).join('').match(/.{1,20}/gu)?.join('\n') ?? '';

  useEffect(() => {
    if (!s.started || s.done) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [s.started, s.done]);

  useEffect(() => {
    if (!s.started || s.done || left > 0) return;
    const score = pointsFor('order-up', { correct });
    setS({ ...s, done: true });
    setFlash(null);
    finish({ score, guesses: s.log.length, ms: RUN_MS, detail: s.log.map((l) => (l.ok ? SQUARE.hit : SQUARE.bad)).join('').match(/.{1,20}/gu)?.join('\n') ?? '' });
    if (correct > best) {
      writeLocal(`next:play:best:order-up:${daily ? 'daily' : 'practice'}`, correct);
      setBest(correct);
    }
  }, [left, s, correct, best, daily, finish, setS]);

  const answer = (id) => {
    if (!s.started || s.done || flash) return;
    const ok = id === item.ans;
    setS({ ...s, log: [...s.log, { i: order[s.log.length % order.length], pick: id, ok }], penalty: s.penalty + (ok ? 0 : PENALTY_MS) });
    setFlash({ ok, ans: item.ans, pick: id });
    flashT.current = setTimeout(() => setFlash(null), ok ? 160 : SHOW_WRONG_MS);
  };

  useKeys((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= CLASSES.length) answer(CLASSES[n - 1].id);
  }, Boolean(s.started) && !s.done);

  if (s.done) {
    const missed = s.log.filter((l) => !l.ok).slice(0, 6);
    return (
      <Result
        headline={`${correct} correct`}
        sub={correct >= best && correct > 0 ? 'A new personal best.' : `Your best ${daily ? 'daily' : 'practice'} run is ${best}.`}
        grid={grid}
        share={`Order Up ${daily ? date : 'practice'} ${correct} in 60s\n${grid}\n${shareLink()}`}
        footer={footer}
      >
        {missed.length > 0 && (
          <ol className="pl-recap">
            {missed.map((l, k) => (
              <li key={k}>
                <Code code={BIGO[l.i].code} />
                <p>You said {label(l.pick)}. It is <strong>{label(BIGO[l.i].ans)}</strong>: {BIGO[l.i].why}</p>
              </li>
            ))}
          </ol>
        )}
      </Result>
    );
  }

  if (!s.started) {
    return (
      <div className="pl-start">
        <Lightning size={40} weight="fill" aria-hidden="true" className="pl-start__i" />
        <p className="pl-start__t">Sixty seconds. As many as you can.</p>
        <p className="pl-small">{daily ? 'Your daily run starts as soon as you press Start, and only counts once.' : 'Practice runs are not saved.'}</p>
        {best > 0 && <p className="pl-small"><Trophy size={16} aria-hidden="true" /> Best: {best}</p>}
        <Button variant="primary" size="lg" onClick={() => { setNow(Date.now()); setS({ ...s, started: Date.now() }); }}>Start</Button>
      </div>
    );
  }

  return (
    <div className="pl-ou">
      <div className="pl-status">
        <span className="pl-ou__score" aria-live="off">{correct} correct</span>
        <span className={cx('pl-ou__time', left < 10_000 && 'pl-ou__time--low')} role="timer">{Math.ceil(left / 1000)}s</span>
      </div>
      <div className="pl-ou__bar" aria-hidden="true"><span style={{ transform: `scaleX(${left / RUN_MS})` }} /></div>
      <Code code={flash ? BIGO[s.log[s.log.length - 1].i].code : item.code} className={cx(flash && (flash.ok ? 'pl-code--ok' : 'pl-code--bad pl-shake'))} />
      <p className="pl-msg" role="status" aria-live="polite">{flash && !flash.ok ? `It was ${label(flash.ans)}. ${BIGO[s.log[s.log.length - 1].i].why}` : ''}</p>
      <div className="pl-ou__btns" role="group" aria-label="Time complexity">
        {CLASSES.map((c, k) => (
          <button
            key={c.id}
            type="button"
            className={cx('pl-ou__btn', flash && c.id === flash.ans && 'pl-ou__btn--right', flash && !flash.ok && c.id === flash.pick && 'pl-ou__btn--wrong')}
            onClick={() => answer(c.id)}
          >
            <span className="pl-opt__k" aria-hidden="true">{k + 1}</span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
