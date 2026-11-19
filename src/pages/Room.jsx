/**
 * The member's side of a meeting room.
 *
 *   /room          enter the room code and the check-in word from the projector (B4)
 *   /room/:code    the live room: whatever block is running (B1), plus the help queue,
 *                  pace buttons, links, and a card that says what attendance pays
 */
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUser } from '../lib/useUser.js';
import { useRoomSocket } from '../lib/useRoomSocket.js';
import { Spinner } from '../components/bits.jsx';
import { DuelPlay, Notice, PartnerCard } from './Duel.jsx';
import { ContestPlay } from './Contest.jsx';
import { BlockTimer, ExitCard, HelpQueue, LabPlay, NoteBox, ShowPlay, blockOf } from './Session.jsx';
import { SpeakerPlay } from './live/Speaker.jsx';
import { TeachPlay } from './live/Teach.jsx';

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

const cleanCode = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

function SignInFirst({ code }) {
  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="display text-xl font-bold">Sign in to join</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
        {code ? `Room ${code} needs` : 'Rooms need'} you signed in so your attendance and answers are saved.
      </p>
      <Link className="btn btn-primary mt-4" to="/signin" style={{ textDecoration: 'none' }}>
        Sign in
      </Link>
    </div>
  );
}

/** One big code-style input. */
function CodeInput({ label, value, onChange, autoFocus }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label className="eyebrow" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="field mono text-center"
        style={{ fontSize: '2.2rem', letterSpacing: '0.3em', padding: '0.6rem' }}
        value={value}
        onChange={(e) => onChange(cleanCode(e.target.value))}
        maxLength={4}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="ABCD"
      />
    </div>
  );
}

const RULE = 'The check-in word on the screen changes every five minutes, so you have to be in the room to join.';

function Enter() {
  const nav = useNavigate();
  const { user, loading } = useUser();
  const [code, setCode] = useState('');
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.get(`/rooms/${encodeURIComponent(code)}`);
      if (!r.open) throw new Error('That room has already closed.');
      if (!r.checkedIn) await api.post(`/rooms/${r.code}/checkin`, { token: word });
      nav(`/room/${r.code}`);
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
        <SignInFirst />
      ) : (
        <form onSubmit={go} className="card grid gap-4 p-6">
          <CodeInput label="Room code" value={code} onChange={setCode} autoFocus />
          <CodeInput label="Check-in word" value={word} onChange={setWord} />
          <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>{RULE}</p>
          {error && (
            <p role="alert" className="text-sm" style={{ color: BAD }}>
              {error}
            </p>
          )}
          <button className="btn btn-primary" style={{ padding: '0.9rem', justifyContent: 'center' }} disabled={busy || code.length < 4 || word.length < 4}>
            {busy ? 'Checking...' : 'Check in'}
          </button>
        </form>
      )}
    </div>
  );
}

/** Shown when someone opens /room/CODE without having checked in yet. */
function CheckIn({ code, onDone }) {
  const [params] = useSearchParams();
  const [word, setWord] = useState(cleanCode(params.get('t') ?? ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card mx-auto grid max-w-md gap-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api.post(`/rooms/${code}/checkin`, { token: word });
          onDone();
        } catch (err) {
          setError(err.message);
        }
        setBusy(false);
      }}
    >
      <h1 className="display text-2xl font-bold">Check in to room {code}</h1>
      <CodeInput label="Check-in word from the screen" value={word} onChange={setWord} autoFocus />
      <p className="mono text-xs" style={{ color: 'var(--ink-soft)' }}>{RULE}</p>
      {error && <p role="alert" className="text-sm" style={{ color: BAD }}>{error}</p>}
      <button className="btn btn-primary" style={{ padding: '0.9rem', justifyContent: 'center' }} disabled={busy || word.length < 4}>
        {busy ? 'Checking...' : 'Check in'}
      </button>
    </form>
  );
}

/* ----------------------------- live: /room/:code ----------------------------- */

function Live({ code }) {
  const { user, loading } = useUser();
  const [room, setRoom] = useState(null); // { open, checkedIn, kind } | { error }
  useEffect(() => {
    if (!user) return;
    api.get(`/rooms/${code}`).then(setRoom).catch((e) => setRoom({ error: e.status === 404 ? 'No room with that code.' : e.message }));
  }, [code, user]);

  if (loading) return <Spinner />;
  if (!user) return <SignInFirst code={code} />;
  if (!room) return <Spinner label="Finding the room" />;
  if (room.error || !room.open) {
    return (
      <div className="card mx-auto max-w-md p-6">
        <h1 className="display text-xl font-bold">Cannot join room {code}</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>{room.error ?? 'That room has closed.'}</p>
        <Link className="btn btn-ghost mt-4" to="/room" style={{ textDecoration: 'none' }}>Try another code</Link>
      </div>
    );
  }
  if (!room.checkedIn) return <CheckIn code={code} onDone={() => setRoom({ ...room, checkedIn: true })} />;
  return <InRoom code={code} />;
}

function Waiting({ title, children }) {
  return (
    <div className="card p-8 text-center">
      <p className="display text-2xl font-bold">{title}</p>
      {children && <p className="mono mt-2 text-sm whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>{children}</p>}
    </div>
  );
}

/** The current block, from the member's side. */
function BlockView({ state, send, skew }) {
  const sess = state.session;
  const block = blockOf(state);
  const q = state.q;
  const { left, frac } = useCountdown(q, skew);
  const question = q && <Question q={q} left={left} frac={frac} onAnswer={(choice) => send({ t: 'answer', choice })} />;

  if (sess.kind === 'dropin') return <NoteBox send={send} exit={state.exit} />;
  if (!block) return <Waiting title="You are checked in">The meeting starts soon. Keep this page open.</Waiting>;

  // A question asked outside the poll block still shows first.
  const extra = block.type !== 'poll' && q?.open ? question : null;
  let main;
  switch (block.type) {
    case 'poll':
      main = q ? question : <Waiting title={block.title}>The question will show up here.</Waiting>;
      break;
    case 'lab':
      main = state.lab ? <LabPlay lab={state.lab} block={block} partner={state.pairs} session={sess} send={send} skew={skew} /> : null;
      break;
    case 'duel':
      main = state.duel ? <DuelPlay duel={state.duel} send={send} skew={skew} /> : <Waiting title={block.title}>The duel opens in a moment.</Waiting>;
      break;
    case 'contest':
      main = state.contest ? <ContestPlay c={state.contest} send={send} skew={skew} /> : <Waiting title={block.title}>The contest opens in a moment.</Waiting>;
      break;
    case 'show':
      main = <ShowPlay show={state.show} earned={state.earned} send={send} />;
      break;
    case 'speaker':
      main = <SpeakerPlay speaker={state.speaker} block={block} send={send} />;
      break;
    case 'teach':
      main = <TeachPlay check={state.check} block={block} send={send} />;
      break;
    case 'close':
      main = (
        <>
          <Waiting title={block.title}>{block.screen}</Waiting>
          <NoteBox send={send} exit={state.exit} />
        </>
      );
      break;
    default:
      main = <Waiting title={block.type === 'break' ? 'Break' : 'Eyes on the screen'}>{block.type === 'break' ? block.screen : `${block.title}${block.screen ? `\n${block.screen}` : ''}`}</Waiting>;
  }
  return (
    <>
      {extra}
      {main}
    </>
  );
}

function InRoom({ code }) {
  const { state, status, refused, skew, notice, send } = useRoomSocket(code);
  const [myPulse, setMyPulse] = useState(null);

  if (refused) {
    return (
      <div className="card mx-auto max-w-md p-6">
        <h1 className="display text-xl font-bold">Cannot join room {code}</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>The room may have closed.</p>
        <Link className="btn btn-ghost mt-4" to="/room" style={{ textDecoration: 'none' }}>Try another code</Link>
      </div>
    );
  }

  const block = state && blockOf(state);
  // A lab or a live duel needs room for the statement beside the editor.
  const wide = (block?.type === 'lab' && state.lab?.tier != null) || (state?.duel?.phase === 'live' && state.duel.match) || (block?.type === 'contest' && state?.contest?.team && state.contest.phase !== 'setup');

  return (
    <div className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>
      <Notice notice={notice} />
      <header className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            room {code}
            {state?.session.kind === 'dropin' ? ', drop-in' : block ? `, ${state.session.cur + 1} of ${state.session.blocks.length}` : ''}
          </p>
          <h1 className="display truncate text-3xl font-extrabold">{state?.session.kind === 'dropin' ? 'Panther Pause' : block?.title ?? 'Starting soon'}</h1>
          <p className="mono text-xs" role="status" style={{ color: 'var(--ink-soft)' }}>
            {status === 'open' ? `${state?.here ?? 0} here` : status === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </p>
        </div>
        {state && !(block?.type === 'contest' && state.contest) && <BlockTimer session={state.session} skew={skew} />}
      </header>

      {!state ? (
        <Spinner label="Joining" />
      ) : state.ended ? (
        <div className="card p-6">
          <h2 className="display text-2xl font-bold">Room closed</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {state.exit ? 'Your attendance and the bonus are paid. Thanks for coming.' : 'Your attendance is paid. Thanks for coming.'}
          </p>
          <Link className="btn btn-ghost mt-5" to="/" style={{ textDecoration: 'none' }}>Back to the club</Link>
        </div>
      ) : (
        <div className="grid gap-5">
          <ExitCard exit={state.exit} dropin={state.session.kind === 'dropin'} />
          {block?.type !== 'lab' && <PartnerCard partner={state.pairs} />}
          <BlockView state={state} send={send} skew={skew} />
          <HelpQueue help={state.help} send={send} />

          {state.stage?.length > 0 && (
            <section className="card p-4" aria-label="Links">
              <p className="eyebrow mb-2">links</p>
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

          {state.session.kind !== 'dropin' && (
            <section aria-label="How is the pace?">
              <p className="eyebrow mb-2">how is the pace?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PULSES.map(([v, label]) => (
                  <button
                    key={v}
                    className="btn btn-ghost"
                    aria-pressed={myPulse === v}
                    style={{
                      padding: '0.7rem 0.5rem',
                      justifyContent: 'center',
                      ...(myPulse === v && { background: 'var(--flag-soft)', color: 'var(--flag)', borderColor: 'var(--flag)' }),
                    }}
                    onClick={() => {
                      setMyPulse(v);
                      send({ t: 'pulse', v });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {block?.type === 'poll' && state.board?.length > 0 && (
            <section className="card p-4">
              <p className="eyebrow mb-2">quiz scores</p>
              <Board board={state.board} />
            </section>
          )}
        </div>
      )}
    </div>
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
