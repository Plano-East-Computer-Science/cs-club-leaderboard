import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useRoomSocket } from '../lib/useRoomSocket.js';
import { Spinner } from '../components/bits.jsx';
import { Board, LETTERS, PULSES, useCountdown } from './Room.jsx';

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

export default function Host() {
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
  return <Console code={code} />;
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
    <section className="card grid gap-3 p-5" aria-label="Agenda">
      <p className="eyebrow">Today (everyone in the room sees these)</p>
      {stage.length > 0 && (
        <ol className="grid gap-1">
          {stage.map((it, i) => (
            <li key={i} className="flex items-baseline gap-3 text-xl">
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

function Console({ code }) {
  const { state, status, refused, skew, send } = useRoomSocket(code);
  const [draft, setDraft] = useState({ text: '', options: ['', '', '', ''], correct: null, seconds: 20 });
  const q = state?.q;
  const { left } = useCountdown(q, skew);

  if (refused) {
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

  const opts = draft.options.map((o) => o.trim());
  const filled = opts.filter(Boolean);
  const canAsk = draft.text.trim() && filled.length >= 2 && status === 'open';

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

  const setOpt = (i, v) => setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) }));
  const total = Math.max(1, state?.here ?? 0);
  const pulseMax = Math.max(1, ...PULSES.map(([v]) => state?.pulse?.[v] ?? 0));

  return (
    <div className="grid gap-6" style={{ fontSize: '1.05rem' }}>
      <header className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="eyebrow">Join at {location.origin}/room</p>
          <h1 className="display mono text-[clamp(4rem,16vw,9rem)] leading-none font-extrabold tracking-[0.12em]">{code}</h1>
        </div>
        <div className="sm:text-right">
          <p className="display mono text-5xl font-extrabold">{state?.here ?? 0}</p>
          <p className="eyebrow">here {status !== 'open' && `(${status})`}</p>
          <button
            className="btn btn-danger mt-3"
            onClick={() => window.confirm('End this room for everyone?') && send({ t: 'end' })}
            disabled={state?.ended}
          >
            {state?.ended ? 'Room ended' : 'End room'}
          </button>
        </div>
      </header>

      {!state ? (
        <Spinner label="Connecting" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-6">
            {q && (
              <section className="card p-5" aria-label="Current question">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="eyebrow">{q.open ? 'Open' : q.revealed ? 'Revealed' : 'Closed'}</p>
                  {q.open && <p className="display mono text-5xl font-extrabold">{left}s</p>}
                </div>
                <h2 className="display mt-2 text-3xl leading-tight font-bold whitespace-pre-wrap">{q.text}</h2>
                <p className="mono mt-3 text-xl" style={{ color: 'var(--ink-soft)' }}>
                  {state.answered} / {state.here} answered
                </p>
                <div className="mt-4 grid gap-3">
                  {q.options.map((o, i) => {
                    const n = q.counts?.[i] ?? 0;
                    const sum = (q.counts ?? []).reduce((a, b) => a + b, 0) || 1;
                    const ok = q.correct === i;
                    return (
                      <div key={i} className="relative overflow-hidden rounded-md border px-4 py-3 text-2xl" style={{ borderColor: ok ? GOOD : undefined, borderWidth: ok ? 2 : 1 }}>
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 transition-[width] duration-300"
                          style={{ width: `${(n / sum) * 100}%`, background: `color-mix(in srgb, ${ok ? GOOD : 'var(--flag)'} 22%, transparent)` }}
                        />
                        <span className="relative flex items-baseline gap-3">
                          <span className="mono font-bold" style={{ color: 'var(--ink-faint)' }}>{LETTERS[i]}</span>
                          <span className="flex-1">{o}</span>
                          <span className="mono font-bold">{n}</span>
                          {ok && <span className="mono text-sm font-bold" style={{ color: GOOD }}>CORRECT</span>}
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
            )}

            <Agenda stage={state.stage ?? []} onChange={(items) => send({ t: 'stage', items })} />

            {state.asks?.length > 0 && (
              <section className="card p-5" aria-label="Questions from the room">
                <p className="eyebrow mb-3">Questions ({state.asks.length})</p>
                <ul className="grid gap-3">
                  {state.asks.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xl leading-snug">{a.text}</p>
                        <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>{a.name}</p>
                      </div>
                      <button className="btn btn-ghost" onClick={() => send({ t: 'ask_done', id: a.id })}>Answered</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card p-5" aria-label="Pace">
              <div className="mb-3 flex items-center justify-between">
                <p className="eyebrow">Pace</p>
                <button className="btn btn-ghost" onClick={() => send({ t: 'clear_pulse' })}>Clear pulse</button>
              </div>
              <div className="grid gap-3">
                {PULSES.map(([v, label]) => {
                  const n = state.pulse?.[v] ?? 0;
                  return (
                    <div key={v} className="flex items-center gap-3">
                      <span className="w-28 text-xl font-semibold">{label}</span>
                      <div className="h-7 flex-1 overflow-hidden rounded" style={{ background: 'var(--paper-2)' }}>
                        <div
                          className="h-full transition-[width] duration-300"
                          style={{ width: `${(n / pulseMax) * 100}%`, background: v === 'great' ? GOOD : v === 'fast' || v === 'slow' ? '#b8720e' : '#c42e2e' }}
                        />
                      </div>
                      <span className="mono w-10 text-right text-xl font-bold">{n}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>Out of {total} here.</p>
            </section>
          </div>

          <div className="grid content-start gap-6">
            <form onSubmit={ask} className="card grid gap-3 p-5" aria-label="New question">
              <p className="eyebrow">Ask a question</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex.label}
                    className="btn btn-ghost"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        text: ex.text,
                        options: [...ex.options, '', '', '', ''].slice(0, Math.max(4, ex.options.length)),
                        correct: ex.correct,
                      }))
                    }
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <textarea
                className="field"
                rows={2}
                maxLength={300}
                placeholder="Question"
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                aria-label="Question text"
              />
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
                  <input className="field" maxLength={120} value={o} placeholder={`Option ${LETTERS[i]}`} onChange={(e) => setOpt(i, e.target.value)} />
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                {draft.options.length < 6 && (
                  <button type="button" className="btn btn-ghost" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ''] }))}>
                    + option
                  </button>
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
                  <input
                    className="field"
                    style={{ width: '5rem' }}
                    type="number"
                    min={5}
                    max={120}
                    value={draft.seconds}
                    onChange={(e) => setDraft((d) => ({ ...d, seconds: e.target.value }))}
                  />
                </label>
              </div>
              <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                Tick the correct option to score it, or leave none ticked for a poll.
              </p>
              <button className="btn btn-primary" style={{ padding: '0.8rem' }} disabled={!canAsk || state.ended}>
                Ask
              </button>
            </form>

            <section className="card p-5">
              <p className="eyebrow mb-2">Leaderboard</p>
              <Board board={state.board} big />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
