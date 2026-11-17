import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { useRoomSocket } from '../lib/useRoomSocket.js';
import { Spinner } from '../components/bits.jsx';

const GOOD = '#2f8f5b';
const BAD = '#c42e2e';
export const LETTERS = 'ABCDEF';
export const PULSES = [
  ['fast', 'Too fast'],
  ['slow', 'Too slow'],
  ['lost', 'Lost'],
  ['great', 'Great'],
];

/** Seconds left on the open question, corrected for client clock skew. */
export function useCountdown(q, skew) {
  const [, tick] = useState(0);
  const open = Boolean(q?.open);
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [open, q?.id]);
  if (!q) return { left: 0, frac: 0 };
  const left = Math.max(0, q.openedAt + q.seconds * 1000 - (Date.now() + skew));
  return { left: Math.ceil(left / 1000), frac: Math.min(1, left / (q.seconds * 1000)) };
}

export function Board({ board, big = false, limit = 10 }) {
  if (!board?.length) return <p className="mono text-sm" style={{ color: 'var(--ink-faint)' }}>No scores yet.</p>;
  return (
    <ol className="sheet-grain">
      {board.slice(0, limit).map((r, i) => (
        <li
          key={i}
          className={`flex items-baseline gap-3 ${big ? 'h-[44px] text-xl' : 'h-[44px] text-base'}`}
          style={{
            background: r.you ? 'var(--flag-soft)' : undefined,
            fontWeight: r.you ? 700 : 500,
            paddingInline: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span className="mono w-6 text-right" style={{ color: 'var(--ink-faint)' }}>
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {r.name}
            {r.you && <span className="mono ml-2 text-[0.65rem]" style={{ color: 'var(--flag)' }}>YOU</span>}
          </span>
          <span className="mono">{r.pts}</span>
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------- entry: /room ----------------------------- */

export default function Room() {
  const { code } = useParams();
  return code ? <Live code={code.toUpperCase()} /> : <Enter />;
}

function Enter() {
  const nav = useNavigate();
  const { user, loading } = useUser();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.get(`/rooms/${encodeURIComponent(code)}`);
      if (!r.open) setError('That room has already closed.');
      else nav(`/room/${r.code}`);
    } catch (err) {
      setError(err.status === 404 ? 'No room with that code. Check the screen.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="mb-8">
        <p className="eyebrow">Live meeting</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">Join the room</h1>
      </header>
      {loading ? (
        <Spinner />
      ) : !user ? (
        <div className="card p-6">
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Sign in first so your answers count toward the leaderboard and your attendance is recorded.
          </p>
          <Link className="btn btn-primary mt-4" to="/signin" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={go} className="card grid gap-4 p-6">
          <label className="grid gap-2">
            <span className="eyebrow">Room code from the projector</span>
            <input
              className="field mono text-center"
              style={{ fontSize: '2.5rem', letterSpacing: '0.3em', padding: '0.75rem' }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              maxLength={4}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD"
              aria-label="Room code"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm" style={{ color: BAD }}>
              {error}
            </p>
          )}
          <button className="btn btn-primary" style={{ padding: '0.9rem' }} disabled={busy || code.length < 4}>
            {busy ? 'Checking...' : 'Join'}
          </button>
        </form>
      )}
    </div>
  );
}

/* ----------------------------- live: /room/:code ----------------------------- */

function Live({ code }) {
  const { user, loading } = useUser();
  const { state, status, refused, skew, send } = useRoomSocket(user ? code : null);
  const [myPulse, setMyPulse] = useState(null);
  const q = state?.q;
  const { left, frac } = useCountdown(q, skew);

  if (loading) return <Spinner />;
  if (!user) {
    return (
      <div className="card mx-auto max-w-md p-6">
        <h1 className="display text-xl font-bold">Sign in to join</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Room {code} needs you signed in so your score is saved.
        </p>
        <Link className="btn btn-primary mt-4" to="/signin" style={{ textDecoration: 'none' }}>
          Sign in
        </Link>
      </div>
    );
  }
  if (refused) {
    return (
      <div className="card mx-auto max-w-md p-6">
        <h1 className="display text-xl font-bold">Cannot join room {code}</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          The room may be closed, or the code is wrong.
        </p>
        <Link className="btn btn-ghost mt-4" to="/room" style={{ textDecoration: 'none' }}>
          Try another code
        </Link>
      </div>
    );
  }

  const pulse = (v) => {
    setMyPulse(v);
    send({ t: 'pulse', v });
  };

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Room</p>
          <h1 className="display mono text-4xl font-extrabold tracking-[0.15em]">{code}</h1>
        </div>
        <div className="mono text-right text-xs" style={{ color: 'var(--ink-soft)' }}>
          <p role="status">
            {status === 'open' ? `${state?.here ?? 0} here` : status === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </p>
        </div>
      </header>

      {!state ? (
        <Spinner label="Joining" />
      ) : state.ended ? (
        <div className="card p-6">
          <h2 className="display text-2xl font-bold">Room closed</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Final standings
          </p>
          <div className="mt-4">
            <Board board={state.board} />
          </div>
          <Link className="btn btn-ghost mt-5" to="/" style={{ textDecoration: 'none' }}>
            Back to the club
          </Link>
        </div>
      ) : (
        <div className="grid gap-5">
          {!q ? (
            <div className="card p-8 text-center">
              <p className="display text-xl font-bold">Waiting for the first question</p>
              <p className="mono mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                {state.here} here. Keep this page open.
              </p>
            </div>
          ) : (
            <Question q={q} left={left} frac={frac} onAnswer={(choice) => send({ t: 'answer', choice })} />
          )}

          {state.stage?.length > 0 && (
            <section className="card p-4" aria-label="Today">
              <p className="eyebrow mb-2">Today</p>
              <ol className="grid gap-1">
                {state.stage.map((it, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="mono" style={{ color: 'var(--ink-faint)' }}>{i + 1}</span>
                    {/* New tab, so this page keeps its place in the room. */}
                    <a href={it.url} target="_blank" rel="noreferrer noopener" className="underline" style={{ color: 'var(--flag)' }}>
                      {it.label}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-label="How is the pace?">
            <p className="eyebrow mb-2">How is the pace?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PULSES.map(([v, label]) => (
                <button
                  key={v}
                  className="btn btn-ghost"
                  aria-pressed={myPulse === v}
                  style={{
                    padding: '0.85rem 0.5rem',
                    ...(myPulse === v && { background: 'var(--flag-soft)', color: 'var(--flag)', borderColor: 'var(--flag)' }),
                  }}
                  onClick={() => pulse(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <AskBox sent={state.myAsks ?? 0} onSend={(text) => send({ t: 'question', text })} />

          <section className="card p-4">
            <p className="eyebrow mb-2">Leaderboard</p>
            <Board board={state.board} />
          </section>
        </div>
      )}
    </div>
  );
}

/** A question for the officers. Only they see it, without your name on the projector. */
function AskBox({ sent, onSend }) {
  const [text, setText] = useState('');
  const full = sent >= 3;
  return (
    <form
      className="card grid gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length < 3) return;
        onSend(text.trim());
        setText('');
      }}
    >
      <label className="eyebrow" htmlFor="ask-box">Ask the officers</label>
      <div className="flex gap-2">
        <input
          id="ask-box"
          className="field"
          maxLength={200}
          value={text}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          placeholder={full ? 'Wait for one to be answered' : 'Stuck? Curious? Type it here'}
        />
        <button className="btn btn-ghost" disabled={full || text.trim().length < 3}>Send</button>
      </div>
      {sent > 0 && (
        <p className="mono text-xs" role="status" style={{ color: 'var(--ink-soft)' }}>
          {sent} waiting for an answer. Only officers can see it.
        </p>
      )}
    </form>
  );
}

function Question({ q, left, frac, onAnswer }) {
  const answered = q.mine != null;
  const showResult = !q.open;
  const total = (q.counts ?? []).reduce((a, b) => a + b, 0);
  const right = q.revealed && q.correct != null ? q.mine === q.correct : null;

  return (
    <div className="card p-5">
      {q.open && (
        <div className="mb-4">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--paper-2)' }} aria-hidden="true">
            <div
              className="h-full"
              style={{ width: `${frac * 100}%`, background: left <= 5 ? BAD : 'var(--flag)', transition: 'width 0.25s linear' }}
            />
          </div>
          <p className="mono mt-1 text-right text-xs" style={{ color: 'var(--ink-soft)' }}>
            {left}s
          </p>
        </div>
      )}
      <h2 className="display text-xl leading-snug font-bold whitespace-pre-wrap">{q.text}</h2>

      <div className="mt-4 grid gap-2.5">
        {q.options.map((opt, i) => {
          const isMine = q.mine === i;
          const isCorrect = q.revealed && q.correct === i;
          const n = q.counts?.[i] ?? 0;
          return (
            <button
              key={i}
              disabled={!q.open || answered}
              onClick={() => onAnswer(i)}
              className="relative flex min-h-[3.5rem] items-center gap-3 overflow-hidden rounded-md border px-4 py-3 text-left text-base"
              style={{
                background: 'var(--card)',
                borderWidth: isMine || isCorrect ? 2 : 1,
                borderColor: isCorrect ? GOOD : isMine ? 'var(--flag)' : 'var(--rule)',
                opacity: !q.open && !isMine && !isCorrect ? 0.8 : 1,
                cursor: q.open && !answered ? 'pointer' : 'default',
              }}
            >
              {showResult && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: total ? `${(n / total) * 100}%` : 0,
                    background: `color-mix(in srgb, ${isCorrect ? GOOD : 'var(--flag)'} 16%, transparent)`,
                  }}
                />
              )}
              <span className="mono relative font-bold" style={{ color: 'var(--ink-faint)' }}>
                {LETTERS[i]}
              </span>
              <span className="relative flex-1">{opt}</span>
              {showResult && <span className="mono relative text-sm">{n}</span>}
              {isCorrect && <span className="mono relative text-xs font-bold" style={{ color: GOOD }}>CORRECT</span>}
            </button>
          );
        })}
      </div>

      <p className="mono mt-4 text-sm" role="status" style={{ color: 'var(--ink-soft)' }}>
        {q.open
          ? answered
            ? 'Locked in. Waiting for the timer.'
            : 'Tap an answer.'
          : right === true
            ? 'Correct.'
            : right === false
              ? 'Not this time.'
              : q.mine == null
                ? 'You did not answer. Waiting for the reveal.'
                : 'Locked in. Waiting for the reveal.'}
      </p>
    </div>
  );
}
