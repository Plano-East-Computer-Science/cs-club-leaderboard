/**
 * The officer's side of a meeting room.
 *
 *   /host/:code         console: run-of-show, the current block's controls, help queue, pace, agenda
 *   /host/:code/screen  projector: one block at a time, big type, no controls (open it on the
 *                       projector display; it follows the console)
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useRoomSocket } from '../lib/useRoomSocket.js';
import { Spinner } from '../components/bits.jsx';
import { Board, LETTERS, PULSES, useCountdown } from './Room.jsx';
import { DuelBoard, DuelSetup, Notice, PairPanel, clock } from './Duel.jsx';
import { ContestConsole, ContestSetup } from './Contest.jsx';
import { BLOCK_LABEL } from '../../shared/session-templates.js';
import { BlockEditor, HelpConsole, LabCounts, Projector, RunOfShow, ShowConsole, SpeakerConsole, blockOf, useCheckin, useLeft } from './Session.jsx';

const GOOD = '#2f8f5b';

const EXAMPLES = [
  {
    label: 'Python: list slice',
    text: 'What does [10, 20, 30, 40][1:3] evaluate to?',
    options: ['[10, 20]', '[20, 30]', '[20, 30, 40]', '[10, 20, 30]'],
    correct: 1,
  },
  {
    label: 'Big-O: binary search',
    text: 'What is the worst-case time of binary search on a sorted array of n items?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correct: 1,
  },
  {
    label: 'Binary: 1011',
    text: 'What is 1011 in binary as a decimal number?',
    options: ['9', '10', '11', '13'],
    correct: 2,
  },
];

export default function Host({ screen = false }) {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    api
      .get('/admin/session')
      .then((r) => setAuthed(Boolean(r?.authed)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <Spinner />;
  if (!authed) return <NeedOfficer />;
  return screen ? <Screen code={code} /> : <Console code={code} />;
}

function NeedOfficer() {
  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="display text-xl font-bold">Officers only</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
        Sign in as an officer to run this room.
      </p>
      <Link className="btn btn-primary mt-4" to="/officer" style={{ textDecoration: 'none' }}>
        Officer sign-in
      </Link>
    </div>
  );
}

function Refused({ code }) {
  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="display text-xl font-bold">Cannot open room {code}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
        The code may be wrong, or your officer session expired.
      </p>
      <Link className="btn btn-primary mt-4" to="/officer" style={{ textDecoration: 'none' }}>
        Officer sign-in
      </Link>
    </div>
  );
}

/** The projector page: a second socket as host that only renders. */
function Screen({ code }) {
  const { state, refused, skew } = useRoomSocket(code);
  const tok = useCheckin(code);
  if (refused) return <Refused code={code} />;
  if (!state) return <Spinner label="Connecting" />;
  return <Projector state={state} code={code} skew={skew} tok={tok} />;
}

/**
 * H1: this room's own gateway. Members who checked in find it on /gateway; the
 * host picks which presets are on (contest nights start with search off) and
 * can pause it. It ends when the room closes.
 */
function GatewayPanel({ code }) {
  const [gw, setGw] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(`/admin/hub/rooms/${code}/gateway`).then(setGw).catch((e) => setError(e.message));
  }, [code]);
  const put = async (body) => {
    setBusy(true);
    setError('');
    try {
      setGw(await api.put(`/admin/hub/rooms/${code}/gateway`, body));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!gw && !error) return null;
  const chosen = gw ? gw.presets.filter((p) => p.on && !p.fixed).map((p) => p.id) : [];
  return (
    <section className="card grid gap-3 p-5" aria-label="Gateway for this room">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">gateway (checked-in members only)</p>
        {gw && <span className="mono text-xs" style={{ color: gw.active ? 'var(--up)' : 'var(--ink-faint)' }}>{gw.active ? 'on' : 'paused'}</span>}
      </div>
      {error && <p className="mono text-xs" role="alert" style={{ color: 'var(--down)' }}>{error}</p>}
      {gw && (
        <>
          <fieldset className="grid gap-1.5" disabled={busy}>
            <legend className="sr-only">Presets on for this meeting</legend>
            {gw.presets.map((p) => (
              <label key={p.id} className="flex items-baseline gap-2 text-sm" style={{ opacity: p.hosts.length || p.fixed ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={p.on}
                  disabled={p.fixed || (!p.hosts.length && !p.on)}
                  onChange={(e) => put({ presets: e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id) })}
                />
                <span>{p.name}</span>
                <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {p.fixed ? 'always' : p.hosts.length ? `${p.hosts.length} site${p.hosts.length === 1 ? '' : 's'}` : 'none approved yet'}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => put({ on: !gw.active })}>
              {gw.active ? 'Pause gateway' : 'Turn gateway on'}
            </button>
            <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>code {gw.code}</span>
          </div>
        </>
      )}
    </section>
  );
}

/** Today's links, pinned for everyone in the room: the lesson, the problems, the gateway. */
function Agenda({ stage, onChange }) {
  const [courses, setCourses] = useState([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => {
    api.get('/learn').then((d) => setCourses(d.courses)).catch(() => {});
  }, []);

  const add = (item) => onChange([...stage, item]);
  const okUrl = /^(https:\/\/\S+|\/[^/]\S*)$/.test(url.trim());

  return (
    <section className="card grid gap-3 p-5" aria-label="Links for the room">
      <p className="eyebrow">links (everyone in the room sees these)</p>
      {stage.length > 0 && (
        <ol className="grid gap-1">
          {stage.map((it, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="mono" style={{ color: 'var(--ink-faint)' }}>{i + 1}</span>
              <span className="flex-1 truncate">{it.label}</span>
              <button className="mono text-xs underline" style={{ color: 'var(--ink-soft)' }} onClick={() => onChange(stage.filter((_, j) => j !== i))}>
                remove
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          className="field"
          style={{ flex: '1 1 14rem', width: 'auto' }}
          value=""
          aria-label="Add a lesson"
          onChange={(e) => {
            const c = courses.find((x) => x.slug === e.target.value);
            if (c) add({ label: c.title, url: `/learn/${c.slug}` });
          }}
        >
          <option value="">+ lesson from the site</option>
          {courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
        </select>
        <button type="button" className="btn btn-ghost" onClick={() => add({ label: 'GitHub at school (gateway)', url: '/gateway' })}>+ gateway</button>
        <button type="button" className="btn btn-ghost" onClick={() => add({ label: 'Ideas board: vote for next week', url: '/ideas' })}>+ ideas vote</button>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add({ label: label.trim(), url: url.trim() });
          setLabel('');
          setUrl('');
        }}
      >
        <input className="field" style={{ flex: '1 1 9rem', width: 'auto' }} maxLength={60} placeholder="Label, e.g. CSES Sum of Two" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" />
        <input className="field" style={{ flex: '2 1 12rem', width: 'auto' }} maxLength={300} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address" />
        <button className="btn btn-ghost" disabled={!label.trim() || !okUrl || stage.length >= 8}>Add link</button>
      </form>
    </section>
  );
}

/** The live question: counts as they come in, close and reveal. */
function QuestionCard({ state, send, skew }) {
  const q = state.q;
  const { left } = useCountdown(q, skew);
  return (
    <section className="card p-5" aria-label="Current question">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">{q.open ? 'Open' : q.revealed ? 'Revealed' : 'Closed'}</p>
        {q.open && <p className="display mono text-4xl font-extrabold">{left}s</p>}
      </div>
      <h2 className="display mt-2 text-2xl leading-tight font-bold whitespace-pre-wrap">{q.text}</h2>
      <p className="mono mt-2" style={{ color: 'var(--ink-soft)' }}>
        {state.answered} / {state.here} answered
      </p>
      <div className="mt-3 grid gap-2">
        {q.options.map((o, i) => {
          const n = q.counts?.[i] ?? 0;
          const sum = (q.counts ?? []).reduce((a, b) => a + b, 0) || 1;
          const ok = q.correct === i;
          return (
            <div key={i} className="relative overflow-hidden rounded-md border px-4 py-2 text-lg" style={{ borderColor: ok ? GOOD : undefined, borderWidth: ok ? 2 : 1 }}>
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 transition-[width] duration-300"
                style={{ width: `${(n / sum) * 100}%`, background: `color-mix(in srgb, ${ok ? GOOD : 'var(--flag)'} 22%, transparent)` }}
              />
              <span className="relative flex items-baseline gap-3">
                <span className="mono font-bold" style={{ color: 'var(--ink-faint)' }}>{LETTERS[i]}</span>
                <span className="flex-1">{o}</span>
                <span className="mono font-bold">{n}</span>
                {ok && <span className="mono text-xs font-bold" style={{ color: GOOD }}>CORRECT</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={!q.open} onClick={() => send({ t: 'close' })}>Close</button>
        <button className="btn btn-primary" disabled={q.revealed} onClick={() => send({ t: 'reveal' })}>Reveal</button>
      </div>
    </section>
  );
}

function AskForm({ send, disabled }) {
  const [draft, setDraft] = useState({ text: '', options: ['', '', '', ''], correct: null, seconds: 20 });
  const opts = draft.options.map((o) => o.trim());
  const canAsk = draft.text.trim() && opts.filter(Boolean).length >= 2 && !disabled;
  const setOpt = (i, v) => setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) }));

  function ask(e) {
    e.preventDefault();
    // Drop blank options but keep the ticked answer pointing at the same text.
    const keep = opts.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
    send({
      t: 'ask',
      text: draft.text.trim(),
      options: keep.map((i) => opts[i]),
      correct: draft.correct == null ? null : keep.indexOf(draft.correct) >= 0 ? keep.indexOf(draft.correct) : null,
      seconds: Number(draft.seconds) || 20,
    });
  }

  return (
    <form onSubmit={ask} className="card grid gap-3 p-5" aria-label="New question">
      <p className="eyebrow">ask a question</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex.label}
            className="btn btn-ghost"
            onClick={() => setDraft((d) => ({ ...d, text: ex.text, options: [...ex.options, '', '', '', ''].slice(0, Math.max(4, ex.options.length)), correct: ex.correct }))}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <textarea className="field" rows={2} maxLength={300} placeholder="Question" value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} aria-label="Question text" />
      {draft.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct"
            checked={draft.correct === i}
            onChange={() => setDraft((d) => ({ ...d, correct: i }))}
            aria-label={`Option ${LETTERS[i]} is correct`}
            style={{ width: 20, height: 20 }}
          />
          <span className="mono w-5 font-bold" style={{ color: 'var(--ink-faint)' }}>{LETTERS[i]}</span>
          <input className="field" maxLength={120} value={o} placeholder={`Option ${LETTERS[i]}`} aria-label={`Option ${LETTERS[i]}`} onChange={(e) => setOpt(i, e.target.value)} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {draft.options.length < 6 && (
          <button type="button" className="btn btn-ghost" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ''] }))}>+ option</button>
        )}
        {draft.options.length > 2 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setDraft((d) => {
                const options = d.options.slice(0, -1);
                return { ...d, options, correct: d.correct >= options.length ? null : d.correct };
              })
            }
          >
            - option
          </button>
        )}
        <label className="mono ml-auto flex items-center gap-2 text-sm">
          Seconds
          <input className="field" style={{ width: '5rem' }} type="number" min={5} max={120} value={draft.seconds} onChange={(e) => setDraft((d) => ({ ...d, seconds: e.target.value }))} />
        </label>
      </div>
      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
        Tick the correct option to score it, or leave none ticked for a poll. Answering counts as a member's exit artifact.
      </p>
      <button className="btn btn-primary" style={{ padding: '0.8rem', justifyContent: 'center' }} disabled={!canAsk}>Ask</button>
    </form>
  );
}

function Pace({ state, send }) {
  const total = Math.max(1, state.here ?? 0);
  const pulseMax = Math.max(1, ...PULSES.map(([v]) => state.pulse?.[v] ?? 0));
  return (
    <section className="card p-5" aria-label="Pace">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">pace</p>
        <button className="btn btn-ghost" onClick={() => send({ t: 'clear_pulse' })}>Clear</button>
      </div>
      <div className="grid gap-2">
        {PULSES.map(([v, label]) => {
          const n = state.pulse?.[v] ?? 0;
          return (
            <div key={v} className="flex items-center gap-3">
              <span className="w-24 text-sm">{label}</span>
              <div className="h-4 flex-1 overflow-hidden" style={{ background: 'var(--paper-2)' }}>
                <div className="h-full transition-[width] duration-300" style={{ width: `${(n / pulseMax) * 100}%`, background: v === 'great' ? GOOD : v === 'lost' ? '#c42e2e' : '#b8720e' }} />
              </div>
              <span className="mono w-8 text-right">{n}</span>
            </div>
          );
        })}
      </div>
      <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>Out of {total} here.</p>
    </section>
  );
}

/** The controls for whatever block is running. */
function CurrentBlock({ state, send, skew }) {
  const block = blockOf(state);
  const duelLive = state.duel && state.duel.phase !== 'done';

  if (!block) {
    return (
      <section className="card p-5">
        <p className="eyebrow">join screen</p>
        <p className="mt-2">
          The projector shows the room code and a check-in word that changes every five minutes. Members type both, so a code
          shared in a group chat stops working. Press Start when the room is ready.
        </p>
      </section>
    );
  }

  const head = (
    <div className="ses-now">
      <p className="eyebrow">now: {BLOCK_LABEL[block.type]}</p>
      <h2 className="display">{block.title}</h2>
      {block.screen && <p className="d text-sm">On screen: {block.screen}</p>}
      {block.notes && <p className="text-sm">Your notes: {block.notes}</p>}
    </div>
  );

  let body = null;
  if (block.type === 'poll') {
    body = (
      <>
        {state.q && <QuestionCard state={state} send={send} skew={skew} />}
        <AskForm send={send} disabled={state.ended} />
        <section className="card p-5">
          <p className="eyebrow mb-2">quiz scores</p>
          <Board board={state.board} />
        </section>
      </>
    );
  } else if (block.type === 'lab') {
    body = (
      <>
        <section className="card p-5" aria-label="Lab progress">
          <p className="eyebrow mb-3">progress (the projector shows this, never names)</p>
          <LabCounts lab={state.lab} />
        </section>
        {state.lab?.pairs && <PairPanel pairs={state.pairs} send={send} />}
      </>
    );
  } else if (block.type === 'duel') {
    body = duelLive || state.duel?.phase === 'done' ? (
      <>
        <DuelBoard duel={state.duel} send={send} skew={skew} />
        {state.duel.phase === 'done' && <DuelSetup send={send} disabled={state.ended} />}
      </>
    ) : (
      <DuelSetup send={send} disabled={state.ended} />
    );
  } else if (block.type === 'contest') {
    body = state.contest ? <ContestConsole c={state.contest} send={send} skew={skew} /> : <ContestSetup send={send} disabled={state.ended} block={block} />;
  } else if (block.type === 'show') {
    body = (
      <section className="card p-5" aria-label="Show">
        <p className="eyebrow mb-3">shared ({state.show.items.length}). Put up to three on the screen.</p>
        <ShowConsole show={state.show} send={send} />
      </section>
    );
  } else if (block.type === 'speaker') {
    body = (
      <section className="card p-5" aria-label="Speaker">
        <p className="eyebrow mb-3">audience questions, most votes first</p>
        <SpeakerConsole speaker={state.speaker} send={send} />
      </section>
    );
  } else if (block.type === 'close') {
    body = (
      <section className="card p-5">
        <p>Members write one line about what they did. Anyone who has not done anything yet needs it for attendance.</p>
        <p className="mono g mt-2">{state.exits} of {state.here} here have done one thing.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {head}
      {/* A question or a duel round left running from another block stays reachable. */}
      {block.type !== 'poll' && state.q?.open && <QuestionCard state={state} send={send} skew={skew} />}
      {block.type !== 'duel' && state.duel?.phase === 'live' && <DuelBoard duel={state.duel} send={send} skew={skew} />}
      {body}
    </div>
  );
}

function TokenChip({ code }) {
  const tok = useCheckin(code);
  const left = useLeft(tok?.rotatesAt, 0);
  return (
    <div className="ses-chip" aria-label="Check-in word">
      <span className="eyebrow">check-in word</span>
      <b className="mono g">{tok?.token ?? '....'}</b>
      <span className="mono m text-xs">{tok ? `new in ${clock(left)}` : ''}</span>
    </div>
  );
}

function Console({ code }) {
  const { state, status, refused, skew, notice, send } = useRoomSocket(code);
  const [editing, setEditing] = useState(false);
  const [closed, setClosed] = useState('');
  if (refused) return <Refused code={code} />;
  if (!state) return <Spinner label="Connecting" />;
  const dropin = state.session.kind === 'dropin';

  return (
    <div className="ses-console grid gap-5">
      <Notice notice={notice} />
      <header className="ses-console-head">
        <div>
          <p className="eyebrow">{dropin ? 'panther pause drop-in' : 'room'} {status !== 'open' && `(${status})`}</p>
          <h1 className="display mono ses-code">{code}</h1>
        </div>
        <TokenChip code={code} />
        <div className="ses-chip">
          <span className="eyebrow">here</span>
          <b className="mono">{state.here}</b>
          <span className="mono m text-xs">{state.exits} counted</span>
        </div>
        <div className="ses-head-btns">
          <a className="btn btn-primary" href={`/host/${code}/screen`} target="_blank" rel="noreferrer">Open projector</a>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (!window.confirm('End this room and count attendance?')) return;
              send({ t: 'end' });
              // Closing is what pays attendance; doing it here saves a trip to the officer page.
              try {
                const d = await api.post(`/admin/hub/rooms/${code}/close`);
                setClosed(`Closed. ${d.awarded} counted${d.noExit ? `, ${d.noExit} did nothing that counts` : ''}.`);
              } catch (err) {
                setClosed(err.message);
              }
            }}
            disabled={state.ended}
          >
            {state.ended ? 'Room ended' : 'End room'}
          </button>
        </div>
      </header>

      {closed && <p role="status" className="mono g text-sm">{closed}</p>}

      <div className="ses-cols">
        <div className="grid content-start gap-5">
          {dropin ? (
            <section className="card p-5">
              <p className="eyebrow">drop-in</p>
              <p className="mt-2">
                No agenda. Members check in, post what they are stuck on and help each other. Attendance counts when they also
                write one line about what they did or help someone. It pays a smaller drop-in amount, at most twice a week.
              </p>
              <p className="mono g mt-2">{state.exits} of {state.here} here have done one thing.</p>
            </section>
          ) : editing ? (
            <BlockEditor blocks={state.session.blocks} send={send} onDone={() => setEditing(false)} />
          ) : (
            <RunOfShow state={state} send={send} skew={skew} onEdit={() => setEditing(true)} />
          )}
          {!dropin && <CurrentBlock state={state} send={send} skew={skew} />}
        </div>
        <div className="grid content-start gap-5">
          <HelpConsole help={state.help} helped={state.helped} send={send} />
          {!dropin && <Pace state={state} send={send} />}
          {!dropin && blockOf(state)?.type !== 'lab' && <PairPanel pairs={state.pairs} send={send} />}
          <Agenda stage={state.stage ?? []} onChange={(items) => send({ t: 'stage', items })} />
          <GatewayPanel code={code} />
        </div>
      </div>
    </div>
  );
}
