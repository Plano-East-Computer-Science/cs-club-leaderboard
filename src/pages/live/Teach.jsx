/**
 * Concept checks in a teach block (Wave 6, peer instruction; worker/hub/teach.js):
 * vote, see the split without the answer, talk to a neighbour for a minute,
 * vote again, reveal. No points for answers.
 *
 *   TeachConsole  officer laptop: pick a check, move it along, see everything
 *   TeachScreen   projector: the question and, once discussion starts, the split
 *   TeachPlay     member phone: a simple vote screen
 */
import { ArrowRight, Eye, X } from '@phosphor-icons/react';
import { Button, Card, Pill, cx } from '../../ui/index.js';
import { clock } from '../Duel.jsx';
import { useTick } from '../Session.jsx';
import './live.css';

const LETTERS = 'ABCDEF';
const PHASE_LABEL = { vote: 'Voting', discuss: 'Talk to your neighbour', revote: 'Vote again', reveal: 'Answer' };
const NEXT_LABEL = { vote: 'Show the split, start the 60 seconds', discuss: 'Vote again', revote: 'Reveal the answer' };

const pct = (n, all) => (all ? Math.round((n / all) * 100) : 0);
const sum = (xs) => (xs ?? []).reduce((a, b) => a + b, 0);

/** Options with one or two bars each. `answer` marks the right one when known. */
function Splits({ options, first, second, answer, big }) {
  const a1 = sum(first);
  const a2 = sum(second);
  return (
    <ul className={cx('lt-opts', big && 'lt-opts--big')}>
      {options.map((o, i) => (
        <li key={i} className={answer === i ? 'is-right' : ''}>
          <span className="lt-opt__k">{LETTERS[i]}</span>
          <span className="lt-opt__t">{o}</span>
          {first && (
            <span className="lt-opt__bars">
              <span className="lt-bar lt-bar--1" style={{ '--w': `${pct(first[i], a1)}%` }} aria-hidden="true" />
              <span className="lt-opt__n">{pct(first[i], a1)}%</span>
              {second && (
                <>
                  <span className="lt-bar lt-bar--2" style={{ '--w': `${pct(second[i], a2)}%` }} aria-hidden="true" />
                  <span className="lt-opt__n">{pct(second[i], a2)}%</span>
                </>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TeachScreen({ check, here }) {
  return (
    <div className="lt-screen">
      <p className="lp-k">{PHASE_LABEL[check.phase]}</p>
      <h1 className="lp-q lt-code">{check.text}</h1>
      <Splits options={check.options} first={check.first} second={check.second} answer={check.answer} big />
      {check.phase === 'vote' || check.phase === 'revote' ? (
        <p className="lp-meta">{check.voted} of {here} voted</p>
      ) : check.phase === 'discuss' ? (
        <p className="lp-meta">Find someone who picked differently. Convince them.</p>
      ) : (
        check.second && <p className="lp-meta">Top bar: first vote. Bottom bar: after talking.</p>
      )}
    </div>
  );
}

/** Officer laptop: the block's checks, and the one running. */
export function TeachConsole({ block, check, here, send, skew }) {
  useTick(1000);
  const checks = block.teach?.checks ?? [];
  if (!check) {
    return (
      <Card className="lt-console" aria-label="Concept checks">
        <p className="ui-label">Concept checks</p>
        {block.teach?.slides && (
          <p className="ui-small">
            Slides: <a href={block.teach.slides} target="_blank" rel="noreferrer noopener">{block.teach.slides.replace(/^https:\/\//, '').slice(0, 60)}</a>
          </p>
        )}
        {checks.length ? (
          <ol className="lt-list">
            {checks.map((c, i) => (
              <li key={i}>
                <span className="lt-list__t">{c.text}</span>
                <Button variant={i === 0 ? 'primary' : 'secondary'} onClick={() => send({ t: 'check_start', i })}>Run check {i + 1}</Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ui-small">No checks in this block. Add them in Edit blocks.</p>
        )}
      </Card>
    );
  }
  const left = check.discussEndsAt ? Math.max(0, check.discussEndsAt - (Date.now() + skew)) : 0;
  const firstRight = check.first ? pct(check.first[check.answer], sum(check.first)) : 0;
  return (
    <Card className="lt-console" aria-label="Concept check running">
      <div className="lt-console__h">
        <Pill tone={check.phase === 'reveal' ? 'live' : 'gold'}>{PHASE_LABEL[check.phase]}</Pill>
        {check.phase === 'discuss' && <span className="ui-mono lt-left">{clock(left)}</span>}
        <span className="ui-small">{check.voted} of {here} voted</span>
      </div>
      <p className="lt-console__q lt-code">{check.text}</p>
      <Splits options={check.options} first={check.first} second={check.second} answer={check.answer} />
      {check.phase === 'vote' && sum(check.first) > 0 && firstRight >= 70 && (
        <p className="ui-small">{firstRight}% got it first time. You can skip the discussion and reveal.</p>
      )}
      <div className="lt-console__acts">
        {check.phase !== 'reveal' && (
          <Button variant="primary" iconRight={ArrowRight} onClick={() => send({ t: 'check_next' })}>{NEXT_LABEL[check.phase]}</Button>
        )}
        {check.phase !== 'reveal' && check.phase !== 'revote' && (
          <Button icon={Eye} onClick={() => send({ t: 'check_reveal' })}>Reveal now</Button>
        )}
        <Button variant="ghost" icon={X} onClick={() => send({ t: 'check_close' })}>{check.phase === 'reveal' ? 'Done' : 'Stop this check'}</Button>
      </div>
    </Card>
  );
}

/** Member phone: tap an answer. Nothing is scored. */
export function TeachPlay({ check, block, send }) {
  if (!check) {
    return (
      <Card className="lt-play" aria-label={block.title}>
        <p className="ui-label">{block.title}</p>
        <p className="ui-body">Eyes on the screen. A question will show up here.</p>
      </Card>
    );
  }
  const voting = check.phase === 'vote' || check.phase === 'revote';
  const mine = check.phase === 'revote' ? check.mine2 : check.mine;
  return (
    <Card className="lt-play" aria-label="Concept check">
      <p className="ui-label">{PHASE_LABEL[check.phase]}</p>
      <p className="lt-play__q lt-code">{check.text}</p>
      <div className="lt-play__opts" role="group" aria-label="Your answer">
        {check.options.map((o, i) => (
          <button
            key={i}
            type="button"
            className={cx('lt-pick', mine === i && 'is-mine', check.answer === i && 'is-right')}
            aria-pressed={mine === i}
            disabled={!voting}
            onClick={() => send({ t: 'check_vote', choice: i })}
          >
            <span className="lt-opt__k">{LETTERS[i]}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      <p className="ui-small" role="status">
        {check.phase === 'discuss'
          ? 'Talk to the person next to you. You can change your answer in a minute.'
          : check.phase === 'reveal'
            ? check.answer === check.mine2 || (check.mine2 == null && check.answer === check.mine)
              ? 'You got it.'
              : 'Now you know. Nothing is scored.'
            : mine != null
              ? 'Locked in. You can change it until voting closes.'
              : 'Tap an answer. Nothing is scored.'}
      </p>
    </Card>
  );
}
