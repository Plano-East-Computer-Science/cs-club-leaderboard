/**
 * The projector (`/host/:code/screen`, Wave 6 redesign; v2-spec section 5).
 * Built for the back of a classroom at 1366x768 and 1920x1080:
 *
 *   - one clock at a time: the round, check, question or block clock, never two
 *   - names and results at 40px or more
 *   - the join code and check-in word always on screen, small, in the top bar
 *   - a between-blocks screen (a break, or a block whose time is up) with the
 *     join code and what is next
 *   - Zoom-safe speaker mode: when Zoom is on the projector, this page is only a
 *     thin "Ask at ..." strip, sized to sit under the Zoom window
 *
 * It connects as `screen`, so the room never sends it officer notes, the Zoom
 * link, names on questions, or a poll answer before the reveal.
 */
import { useEffect, useState } from 'react';
import { BLOCK_LABEL } from '../../../shared/session-templates.js';
import { askLine } from '../../../shared/live.js';
import { DuelBoard, clock } from '../Duel.jsx';
import { ContestScreen } from '../Contest.jsx';
import { LabCounts, blockOf, useTick } from '../Session.jsx';
import { TeachScreen } from './Teach.jsx';
import './live.css';

const LETTERS = 'ABCDEF';
const SWAP_MS = 7 * 60_000; // same as worker/hub/session.js
const BETWEEN_TYPES = ['hook', 'poll', 'show', 'teach'];

/**
 * The one clock this screen shows, or null. Duel rounds and the team contest
 * draw their own clock inside their board, so the bar shows none then.
 */
export function projectorClock(state) {
  const sess = state.session;
  const block = blockOf(state);
  if (state.duel && ['live', 'spotlight'].includes(state.duel.phase)) return null;
  if (block?.type === 'contest' && state.contest && state.contest.phase !== 'setup') return null;
  if (state.check?.phase === 'discuss') return { until: state.check.discussEndsAt, label: 'talk' };
  if (state.q?.open) return { until: state.q.openedAt + state.q.seconds * 1000, label: 'answer' };
  if (block && sess.endsAt) return { until: sess.endsAt, label: 'left' };
  return null;
}

function Clock({ until, label, skew }) {
  useTick(500);
  const left = Math.max(0, until - (Date.now() + skew));
  return (
    <div className={`lp-clock ${left < 60_000 ? 'is-hot' : ''}`} role="timer" aria-label={`${label}: ${clock(left)}`}>
      <span className="lp-clock__l">{left ? label : 'time'}</span>
      <b className="lp-clock__n">{clock(left)}</b>
    </div>
  );
}

/** Room code and check-in word, small, always there. */
function JoinChip({ code, tok }) {
  return (
    <div className="lp-join" aria-label="How to join">
      <span className="lp-join__site">{location.host}/room</span>
      <span>code <b>{code}</b></span>
      <span>word <b className="lp-gold">{tok?.token ?? '....'}</b></span>
    </div>
  );
}

/** The big join panel for the lobby and between blocks. */
function BigJoin({ code, tok }) {
  return (
    <div className="lp-bigjoin">
      <p className="lp-bigjoin__site">{location.host}/room</p>
      <div className="lp-bigjoin__row">
        <div>
          <span className="lp-k">Room code</span>
          <b>{code}</b>
        </div>
        <div>
          <span className="lp-k">Check-in word</span>
          <b className="lp-gold">{tok?.token ?? '....'}</b>
        </div>
      </div>
      <p className="lp-small">The word changes every five minutes.</p>
    </div>
  );
}

function Poll({ q, here, answered }) {
  const sum = (q.counts ?? []).reduce((a, b) => a + b, 0) || 1;
  const bars = !q.open;
  return (
    <div className="lp-poll">
      <h1 className="lp-q">{q.text}</h1>
      <p className="lp-meta">{q.open ? `${answered} of ${here} answered` : q.revealed ? 'Answer' : 'Closed'}</p>
      <ul className="lp-opts">
        {q.options.map((o, i) => (
          <li key={i} className={q.revealed && q.correct === i ? 'is-right' : ''}>
            {bars && <span className="lp-bar" style={{ '--w': `${((q.counts?.[i] ?? 0) / sum) * 100}%` }} aria-hidden="true" />}
            <span className="lp-opt__k">{LETTERS[i]}</span>
            <span className="lp-opt__t">{o}</span>
            {bars && <b className="lp-opt__n">{q.counts?.[i] ?? 0}</b>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Speaker({ state, block }) {
  const qs = state.speaker.qs.filter((q) => !q.answered).slice(0, 3);
  const sp = block.speaker;
  return (
    <div className="lp-speaker">
      <div className="lp-head">
        <h1 className="lp-title">{sp?.name || block.title}</h1>
        {sp?.title && <p className="lp-sub">{sp.title}</p>}
      </div>
      {qs.length ? (
        <ol className="lp-qs">
          {qs.map((q, i) => (
            <li key={q.id} className={i === 0 ? 'is-top' : ''}>
              <b className="lp-qs__v">{q.votes}</b>
              <span>{q.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lp-sub">Send questions from your phone. Upvote the ones you want answered.</p>
      )}
    </div>
  );
}

function Between({ state, code, tok }) {
  const sess = state.session;
  const block = blockOf(state);
  const next = sess.blocks[sess.cur + 1];
  return (
    <div className="lp-between">
      <div>
        <p className="lp-k">{block?.type === 'break' ? 'Break' : 'Up next'}</p>
        <h1 className="lp-title">{block?.type === 'break' ? block.screen || 'Back in a few minutes' : next?.title ?? 'That is the meeting'}</h1>
        {block?.type === 'break' && next && <p className="lp-sub">Then: {next.title}</p>}
        <p className="lp-sub">{state.here} here</p>
      </div>
      <BigJoin code={code} tok={tok} />
    </div>
  );
}

/** Zoom on the projector: only this strip, sized to sit under the Zoom window. */
function ZoomStrip({ code, tok, here }) {
  return (
    <div className="lp-strip" role="status">
      <span className="lp-strip__ask">{askLine(location.host, code)}</span>
      <span>word <b className="lp-gold">{tok?.token ?? '....'}</b></span>
      <span className="lp-strip__n">{here} here</span>
    </div>
  );
}

export default function Projector({ state, code, skew, tok }) {
  const sess = state.session;
  const block = blockOf(state);
  const dropin = sess.kind === 'dropin';
  const [, force] = useState(0);
  // Re-render when the block's time runs out, so the between-blocks screen appears on its own.
  useEffect(() => {
    if (!sess.endsAt) return undefined;
    const ms = sess.endsAt - (Date.now() + skew);
    if (ms <= 0) return undefined;
    const id = setTimeout(() => force((n) => n + 1), ms + 50);
    return () => clearTimeout(id);
  }, [sess.endsAt, skew]);

  if (block?.type === 'speaker' && state.speaker.mode === 'zoom' && !state.ended) return <ZoomStrip code={code} tok={tok} here={state.here} />;

  const timeUp = Boolean(block && sess.endsAt && Date.now() + skew >= sess.endsAt);
  const busy = state.q?.open || (state.check && state.check.phase !== 'reveal');
  const between = block && (block.type === 'break' || (timeUp && BETWEEN_TYPES.includes(block.type) && !busy));

  let body;
  if (state.ended) {
    body = (
      <div className="lp-center">
        <h1 className="lp-title">Thanks for coming</h1>
        <p className="lp-sub">The recap is at {location.host}/recap/{code}</p>
      </div>
    );
  } else if (dropin) {
    body = (
      <div className="lp-center">
        <h1 className="lp-title">Drop in. Ask. Help.</h1>
        <p className="lp-sub">Check in, then post what you are stuck on, or help someone who is.</p>
        <BigJoin code={code} tok={tok} />
      </div>
    );
  } else if (!block) {
    body = (
      <div className="lp-lobby">
        <BigJoin code={code} tok={tok} />
        <section aria-label="Today">
          <p className="lp-k">Today</p>
          <ol className="lp-plan">
            {sess.blocks.map((b) => (
              <li key={b.id}>
                <span>{b.title}</span>
                <span className="lp-plan__m">{b.minutes ? `${b.minutes} min` : ''}</span>
              </li>
            ))}
          </ol>
          <p className="lp-sub">{state.here} here</p>
        </section>
      </div>
    );
  } else if (between) {
    body = <Between state={state} code={code} tok={tok} />;
  } else if (block.type === 'poll' && state.q) {
    body = <Poll q={state.q} here={state.here} answered={state.answered} />;
  } else if (block.type === 'teach' && state.check) {
    body = <TeachScreen check={state.check} here={state.here} />;
  } else if (block.type === 'lab') {
    const swapLeft = state.lab?.pairs ? SWAP_MS - ((Date.now() + skew - sess.startedAt) % SWAP_MS) : 0;
    body = (
      <div className="lp-lab">
        <div className="lp-head">
          <h1 className="lp-title">{block.title}</h1>
          {state.lab?.pairs && <p className="lp-sub">Driver and navigator swap in {clock(swapLeft)}</p>}
        </div>
        <LabCounts lab={state.lab} big />
      </div>
    );
  } else if (block.type === 'duel' && state.duel) {
    body = <DuelBoard duel={state.duel} send={() => {}} skew={skew} readOnly />;
  } else if (block.type === 'contest' && state.contest) {
    body = <ContestScreen c={state.contest} skew={skew} />;
  } else if (block.type === 'show' && state.show.picked.length) {
    const picked = state.show.picked.map((id) => state.show.items.find((x) => x.id === id)).filter(Boolean);
    body = (
      <div className="lp-gallery">
        {picked.map((x) => (
          <article key={x.id}>
            <b className="lp-name">{x.name}</b>
            <p>{x.line}</p>
            <p className="lp-small">{x.url ? x.url.replace(/^https:\/\//, '') : x.result}</p>
          </article>
        ))}
      </div>
    );
  } else if (block.type === 'speaker') {
    body = <Speaker state={state} block={block} />;
  } else {
    body = (
      <div className="lp-center">
        <p className="lp-k">{BLOCK_LABEL[block.type]}</p>
        <h1 className="lp-title">{block.title}</h1>
        {block.screen && <p className="lp-sub">{block.screen}</p>}
        {block.type === 'show' && <p className="lp-sub">Share a link or today's result from your laptop. {state.show.items.length} shared so far.</p>}
        {block.type === 'close' && <p className="lp-sub lp-gold">Before you go: write one line about what you did today.</p>}
        {block.type === 'teach' && block.teach?.slides && <p className="lp-small">Slides are on the officer laptop.</p>}
      </div>
    );
  }

  const c = !state.ended && projectorClock(state);
  return (
    <div className="lp-proj">
      <header className="lp-top">
        <p className="lp-top__where">
          {dropin ? 'Drop-in' : block ? <>{BLOCK_LABEL[block.type]} <span className="lp-dim">{sess.cur + 1} of {sess.blocks.length}</span></> : 'Starting soon'}
        </p>
        {(block || dropin) && <JoinChip code={code} tok={tok} />}
        {c && <Clock until={c.until} label={c.label} skew={skew} />}
      </header>
      <main className="lp-main">{body}</main>
    </div>
  );
}
