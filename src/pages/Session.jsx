/**
 * The meeting as a system (B1, B3, B4, B6, B7, B8, B10): screens for the
 * run-of-show. The room's Durable Object (worker/hub/room-do.js + session.js)
 * holds the state; these render it.
 *
 *   officer console  RunOfShow, BlockEditor, LabCounts, ShowConsole, SpeakerConsole, HelpConsole
 *   projector        Projector (one block at a time, big type, never names on lab progress)
 *   student laptop   ExitCard, LabPlay, ShowPlay, SpeakerPlay, HelpQueue, NoteBox
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import CodeRunner from '../components/CodeRunner.jsx';
import { Spinner } from '../components/bits.jsx';
import { Body } from './Course.jsx';
import { BLOCK_LABEL, BLOCK_TYPES, DEFAULT_TIERS } from '../../shared/session-templates.js';
import { DuelBoard, clock } from './Duel.jsx';
import { ContestScreen } from './Contest.jsx';

const LETTERS = 'ABCDEF';
const SWAP_MS = 7 * 60_000; // same as worker/hub/session.js

/** ms left until a server timestamp, ticking once a second. 0 when there is no timer. */
export function useLeft(until, skew) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, until - (Date.now() + skew)) : 0;
}

/** Re-renders every ms, for clocks computed in render. */
export function useTick(ms = 1000) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export const blockOf = (state) => state?.session?.blocks?.[state.session.cur] ?? null;

/** The current block's timer. Hidden when the block has none. */
export function BlockTimer({ session, skew, big = false }) {
  const left = useLeft(session?.endsAt, skew);
  if (!session?.endsAt) return null;
  return (
    <div className={`duel-timer ${big ? 'big' : ''} ${left < 60_000 ? 'hot' : ''}`} role="timer" aria-label="Time left in this block">
      <span>{left ? 'left' : 'time'}</span>
      <b>{clock(left)}</b>
    </div>
  );
}

/** B4: the projector's check-in word, refetched as it rotates. Officers only. */
export function useCheckin(code) {
  const [tok, setTok] = useState(null);
  useEffect(() => {
    let stop = false;
    let timer = 0;
    const load = () =>
      api
        .get(`/admin/hub/rooms/${code}/checkin`)
        .then((d) => {
          if (stop) return;
          setTok(d);
          timer = setTimeout(load, Math.max(2000, d.rotatesAt - Date.now() + 500));
        })
        .catch(() => !stop && (timer = setTimeout(load, 10_000)));
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code]);
  return tok;
}

/* ================================ officer console ================================ */

/** The run-of-show: every block with a jump button, and next / back / more time. */
export function RunOfShow({ state, send, skew, onEdit }) {
  const sess = state.session;
  const cur = sess.cur;
  return (
    <section className="ses-ros card p-5" aria-label="Run of show">
      <div className="ses-ros-head">
        <p className="eyebrow">run of show</p>
        <BlockTimer session={sess} skew={skew} />
      </div>
      <ol className="ses-blocks">
        <li>
          <button type="button" aria-current={cur === -1 ? 'step' : undefined} onClick={() => send({ t: 'block_go', i: -1 })}>
            <span className="mono">00</span>
            <span>Join screen</span>
            <span className="m">check-in</span>
          </button>
        </li>
        {sess.blocks.map((b, i) => (
          <li key={b.id}>
            <button type="button" aria-current={cur === i ? 'step' : undefined} onClick={() => send({ t: 'block_go', i })}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span>{b.title}</span>
              <span className="m">{BLOCK_LABEL[b.type]}{b.minutes ? `, ${b.minutes} min` : ''}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="ses-ctl">
        <button type="button" className="btn btn-ghost" disabled={cur < 0} onClick={() => send({ t: 'block_prev' })}>Back</button>
        <button type="button" className="btn btn-primary" disabled={cur >= sess.blocks.length - 1} onClick={() => send({ t: 'block_next' })}>
          {cur < 0 ? 'Start the meeting' : `Next: ${sess.blocks[cur + 1]?.title ?? 'end'}`}
        </button>
        {sess.endsAt > 0 && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'block_time', minutes: 1 })}>+1 min</button>
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'block_time', minutes: 5 })}>+5 min</button>
          </>
        )}
        <button type="button" className="btn btn-ghost ses-edit" onClick={onEdit}>Edit blocks</button>
      </div>
    </section>
  );
}

/** Edit the run-of-show, before or during the meeting. Saving keeps the current block running. */
export function BlockEditor({ blocks, send, onDone }) {
  const [draft, setDraft] = useState(() => blocks.map((b) => ({ ...b, lab: b.lab && { ...b.lab, tiers: b.lab.tiers.map((t) => ({ ...t })) } })));
  const [courses, setCourses] = useState([]);
  const [addType, setAddType] = useState('hook');
  useEffect(() => {
    api.get('/learn').then((d) => setCourses(d.courses)).catch(() => {});
  }, []);

  const set = (i, patch) => setDraft((d) => d.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i, by) =>
    setDraft((d) => {
      const n = [...d];
      const j = i + by;
      if (j < 0 || j >= n.length) return d;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const setTier = (i, k, patch) => set(i, { lab: { ...draft[i].lab, tiers: draft[i].lab.tiers.map((t, j) => (j === k ? { ...t, ...patch } : t)) } });
  const total = draft.reduce((n, b) => n + (Number(b.minutes) || 0), 0);

  return (
    <section className="card grid gap-3 p-5" aria-label="Edit blocks">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">edit blocks ({total} min)</p>
        <p className="m text-xs">The block running now keeps its timer.</p>
      </div>
      <ol className="ses-edit-list">
        {draft.map((b, i) => (
          <li key={b.id ?? `new${i}`} className="ses-edit-row">
            <div className="ses-edit-main">
              <span className="mono m">{String(i + 1).padStart(2, '0')}</span>
              <select className="field" value={b.type} aria-label={`Block ${i + 1} type`} onChange={(e) => set(i, { type: e.target.value, lab: e.target.value === 'lab' ? b.lab ?? { pairs: true, tiers: DEFAULT_TIERS.map((t) => ({ ...t })) } : undefined })}>
                {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}
              </select>
              <input className="field" maxLength={60} value={b.title} aria-label={`Block ${i + 1} title`} onChange={(e) => set(i, { title: e.target.value })} />
              <input className="field ses-min" type="number" min={0} max={90} value={b.minutes} aria-label={`Block ${i + 1} minutes`} onChange={(e) => set(i, { minutes: e.target.value })} />
              <span className="ses-edit-btns">
                <button type="button" className="btn btn-ghost" aria-label={`Move block ${i + 1} up`} disabled={!i} onClick={() => move(i, -1)}>up</button>
                <button type="button" className="btn btn-ghost" aria-label={`Move block ${i + 1} down`} disabled={i === draft.length - 1} onClick={() => move(i, 1)}>down</button>
                <button type="button" className="btn btn-ghost" aria-label={`Remove block ${i + 1}`} disabled={draft.length < 2} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>remove</button>
              </span>
            </div>
            <input className="field" maxLength={500} value={b.notes ?? ''} placeholder="Notes for the projector (optional)" aria-label={`Block ${i + 1} notes`} onChange={(e) => set(i, { notes: e.target.value })} />
            {b.type === 'lab' && b.lab && (
              <div className="ses-tiers">
                <label className="mono flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={b.lab.pairs} onChange={(e) => set(i, { lab: { ...b.lab, pairs: e.target.checked } })} />
                  Pairs, driver and navigator swap every 7 minutes
                </label>
                {b.lab.tiers.map((t, k) => (
                  <div key={k} className="ses-tier-row">
                    <input className="field" maxLength={24} value={t.name} aria-label={`Tier ${k + 1} name`} onChange={(e) => setTier(i, k, { name: e.target.value })} />
                    <select className="field" value={t.source.startsWith('course:') ? t.source : 'problems'} aria-label={`Tier ${k + 1} content`} onChange={(e) => setTier(i, k, { source: e.target.value === 'problems' ? 'problems:' : e.target.value })}>
                      {courses.map((c) => <option key={c.slug} value={`course:${c.slug}`}>{c.title}</option>)}
                      <option value="problems">Problems from the bank...</option>
                    </select>
                    {!t.source.startsWith('course:') && (
                      <input className="field" value={t.source.slice('problems:'.length)} placeholder="slug-one,slug-two" aria-label={`Tier ${k + 1} problem slugs`} onChange={(e) => setTier(i, k, { source: `problems:${e.target.value.replace(/\s+/g, '')}` })} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field" style={{ width: 'auto' }} value={addType} aria-label="New block type" onChange={(e) => setAddType(e.target.value)}>
          {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={draft.length >= 12}
          onClick={() => setDraft((d) => [...d, { type: addType, title: BLOCK_LABEL[addType], minutes: 5, notes: '', ...(addType === 'lab' && { lab: { pairs: true, tiers: DEFAULT_TIERS.map((t) => ({ ...t })) } }) }])}
        >
          Add block
        </button>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            send({ t: 'blocks_set', blocks: draft.map((b) => ({ ...b, minutes: Number(b.minutes) || 0 })) });
            onDone();
          }}
        >
          Save blocks
        </button>
      </div>
    </section>
  );
}

/** B3: anonymous progress per tier. Used on the console and the projector. */
export function LabCounts({ lab, big = false }) {
  if (!lab) return null;
  return (
    <div className={`ses-lab ${big ? 'big' : ''}`}>
      {lab.counts.map((t, i) => (
        <div key={i} className="ses-lab-tier">
          <h3>{t.name}</h3>
          <p className="ses-lab-n"><b>{t.people}</b> {t.people === 1 ? 'person' : 'people'}</p>
          <ol>
            {t.past.map((n, k) => (
              <li key={k}>
                <span className="ses-bar" style={{ '--w': t.people ? `${(n / t.people) * 100}%` : '0%' }} aria-hidden="true" />
                <b>{n}</b> past checkpoint {k + 1}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** B6: every submitted artifact; the host puts up to three on the projector. */
export function ShowConsole({ show, send }) {
  if (!show.items.length) return <p className="m text-sm">Nothing submitted yet. Members share from their laptops.</p>;
  return (
    <ul className="ses-show-list">
      {show.items.map((x) => {
        const on = show.picked.includes(x.id);
        return (
          <li key={x.id}>
            <div className="min-w-0">
              <b>{x.name}</b> <span className="m mono text-xs">{x.kudos} kudos</span>
              <p className="text-sm">{x.line}</p>
              <p className="m mono truncate text-xs">{x.url || x.result}</p>
            </div>
            <button type="button" className={`btn ${on ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={on} aria-label={`${on ? 'Take off the screen' : 'Put on the screen'}: ${x.name}`} onClick={() => send({ t: 'show_pick', id: x.id })}>
              {on ? 'On screen' : 'Show'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** B8: questions by votes, answered toggle, and the takeaways pad saved with the room. */
export function SpeakerConsole({ speaker, send }) {
  const [pad, setPad] = useState(speaker.takeaways);
  const [saved, setSaved] = useState(true);
  return (
    <div className="grid gap-4">
      {speaker.qs.length === 0 ? (
        <p className="m text-sm">No questions yet.</p>
      ) : (
        <ul className="ses-qs">
          {speaker.qs.map((q) => (
            <li key={q.id} className={q.answered ? 'done' : ''}>
              <span className="ses-votes"><b>{q.votes}</b></span>
              <span className="flex-1">{q.text}</span>
              <button type="button" className="btn btn-ghost" aria-pressed={q.answered} aria-label={`${q.answered ? 'Answered' : 'Mark answered'}: ${q.text.slice(0, 40)}`} onClick={() => send({ t: 'sq_answered', id: q.id })}>
                {q.answered ? 'Answered' : 'Mark answered'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="grid gap-1">
        <span className="eyebrow">takeaways (saved with the room)</span>
        <textarea
          className="field"
          rows={5}
          maxLength={4000}
          value={pad}
          onChange={(e) => {
            setPad(e.target.value);
            setSaved(false);
          }}
          onBlur={() => {
            send({ t: 'takeaways', text: pad });
            setSaved(true);
          }}
        />
        <span className="m mono text-xs" role="status">{saved ? 'Saved.' : 'Saves when you click away.'}</span>
      </label>
    </div>
  );
}

/** B7 for officers: names and topics. The projector shows only the count. */
export function HelpConsole({ help, helped, send }) {
  return (
    <section className="card p-5" aria-label="Help queue">
      <p className="eyebrow mb-3">help queue ({help.length}){helped ? `, ${helped} solved by members` : ''}</p>
      {!help.length ? (
        <p className="m text-sm">Nobody waiting.</p>
      ) : (
        <ul className="grid gap-3">
          {help.map((h) => (
            <li key={h.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-base leading-snug">{h.topic}</p>
                <p className="mono text-xs m">
                  {h.name}
                  {h.helpers.length > 0 && <span className="g"> / {h.helpers.join(', ')} on it</span>}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'help_clear', id: h.id })}>Handled</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* =================================== projector =================================== */

function JoinPanel({ code, tok, big }) {
  const left = useLeft(tok?.rotatesAt, 0);
  return (
    <div className={`ses-join ${big ? 'big' : ''}`}>
      <div>
        <span className="eyebrow">room</span>
        <b className="mono">{code}</b>
      </div>
      <div>
        <span className="eyebrow">check-in word{tok ? `, new one in ${clock(left)}` : ''}</span>
        <b className="mono g">{tok?.token ?? '....'}</b>
      </div>
      {big && <p className="ses-join-url mono">{location.host}/room</p>}
    </div>
  );
}

function ProjectorPoll({ q, here, answered }) {
  if (!q) return null;
  const sum = (q.counts ?? []).reduce((a, b) => a + b, 0) || 1;
  const showBars = !q.open;
  return (
    <div className="ses-poll">
      <h2>{q.text}</h2>
      <p className="mono m">{q.open ? `${answered} of ${here} answered` : q.revealed ? 'answer' : 'closed'}</p>
      <ul>
        {q.options.map((o, i) => (
          <li key={i} className={q.revealed && q.correct === i ? 'ok' : ''}>
            {showBars && <span className="ses-bar" style={{ '--w': `${((q.counts?.[i] ?? 0) / sum) * 100}%` }} aria-hidden="true" />}
            <span className="mono m">{LETTERS[i]}</span>
            <span className="flex-1">{o}</span>
            {showBars && <b className="mono">{q.counts?.[i] ?? 0}</b>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The projector: one block at a time, big type. No controls, no names on progress. */
export function Projector({ state, code, skew, tok }) {
  const sess = state.session;
  const block = blockOf(state);
  const dropin = sess.kind === 'dropin';
  useTick();

  let body;
  if (dropin) {
    body = (
      <div className="ses-big">
        <p className="eyebrow">panther pause</p>
        <h1>Drop in. Ask. Help.</h1>
        <p className="ses-sub">Check in, then post what you are stuck on, or help someone who is.</p>
      </div>
    );
  } else if (!block) {
    body = (
      <div className="ses-big">
        <p className="eyebrow">today</p>
        <ol className="ses-plan">
          {sess.blocks.map((b) => (
            <li key={b.id}>
              <span>{b.title}</span>
              <span className="mono m">{b.minutes ? `${b.minutes} min` : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  } else if (block.type === 'poll' && state.q) {
    body = <ProjectorPoll q={state.q} here={state.here} answered={state.answered} />;
  } else if (block.type === 'lab') {
    const swapLeft = block && state.lab?.pairs ? SWAP_MS - ((Date.now() + skew - sess.startedAt) % SWAP_MS) : 0;
    body = (
      <div className="grid gap-6">
        <div className="ses-head-line">
          <h1 className="ses-title">{block.title}</h1>
          {state.lab?.pairs && <p className="mono d">driver and navigator swap in {clock(swapLeft)}</p>}
        </div>
        <LabCounts lab={state.lab} big />
      </div>
    );
  } else if (block.type === 'duel' && state.duel) {
    body = <DuelBoard duel={state.duel} send={() => {}} skew={skew} readOnly />;
  } else if (block.type === 'contest' && state.contest) {
    body = <ContestScreen c={state.contest} skew={skew} />;
  } else if (block.type === 'show') {
    const picked = state.show.picked.map((id) => state.show.items.find((x) => x.id === id)).filter(Boolean);
    body = picked.length ? (
      <div className="ses-gallery">
        {picked.map((x) => (
          <article key={x.id}>
            <b>{x.name}</b>
            <p>{x.line}</p>
            <p className="mono g">{x.url ? x.url.replace(/^https:\/\//, '') : x.result}</p>
            <span className="mono m">{x.kudos} kudos</span>
          </article>
        ))}
      </div>
    ) : (
      <div className="ses-big">
        <h1>{block.title}</h1>
        <p className="ses-sub">Share a link or today's result from your laptop. {state.show.items.length} shared so far.</p>
      </div>
    );
  } else if (block.type === 'speaker') {
    const top = state.speaker.qs.filter((q) => !q.answered).slice(0, 3);
    body = (
      <div className="grid gap-6">
        <h1 className="ses-title">{block.title}</h1>
        {top.length ? (
          <ol className="ses-pq">
            {top.map((q) => (
              <li key={q.id}>
                <b className="mono g">{q.votes}</b>
                <span>{q.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ses-sub">Send questions from your laptop. Upvote the ones you want answered.</p>
        )}
      </div>
    );
  } else {
    body = (
      <div className="ses-big">
        <p className="eyebrow">{BLOCK_LABEL[block.type]}</p>
        <h1>{block.title}</h1>
        {block.notes && <p className="ses-sub">{block.notes}</p>}
        {block.type === 'close' && <p className="ses-sub g">Before you go: write one line about what you did today. That is what makes your attendance count.</p>}
      </div>
    );
  }

  return (
    <div className="ses-proj">
      <header className="ses-proj-top">
        {block ? <JoinPanel code={code} tok={tok} /> : <span className="eyebrow">{dropin ? 'drop-in' : 'starting soon'}</span>}
        <div className="ses-proj-right">
          {block && <span className="mono m">{sess.cur + 1} / {sess.blocks.length}</span>}
          {/* The contest has its own clock; two timers on one screen would disagree. */}
          {!(block?.type === 'contest' && state.contest) && <BlockTimer session={sess} skew={skew} big />}
        </div>
      </header>
      {!block && <JoinPanel code={code} tok={tok} big />}
      <main className="ses-proj-main">{body}</main>
      <footer className="ses-proj-foot mono">
        <span><b>{state.here}</b> here</span>
        <span><b>{state.helpOpen}</b> waiting for help</span>
        {state.ended && <span className="dn">room ended</span>}
      </footer>
    </div>
  );
}

/* ================================= student laptop ================================= */

const EXIT_LABEL = {
  poll: 'answered a poll',
  lab: 'passed a lab checkpoint',
  duel: 'tried a duel problem',
  contest: 'submitted in the team contest',
  show: 'shared something in show',
  help: 'helped someone',
  note: 'wrote what you did',
};

/** B4: the attendance rule, stated plainly, with where this member stands. */
export function ExitCard({ exit, dropin }) {
  return (
    <section className={`ses-exit ${exit ? 'ok' : ''}`} aria-label="Attendance" role="status">
      {exit ? (
        <p><b>Attendance: counts.</b> You checked in and {EXIT_LABEL[exit] ?? 'did something'}. It is paid when the room closes.</p>
      ) : (
        <p>
          <b>Attendance: checked in, one thing to go.</b>{' '}
          {dropin
            ? 'It counts once you write one line about what you did, or help someone.'
            : 'It counts once you do one thing here: answer a poll, pass a lab checkpoint, try a duel or contest problem, share in show, help someone, or write one line at the close.'}
        </p>
      )}
    </section>
  );
}

/** B4: the one-line exit artifact, on the close block and any time in a drop-in. */
export function NoteBox({ send, exit }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <form
      className="card grid gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        send({ t: 'note', text: text.trim() });
        setSent(true);
      }}
    >
      <label className="eyebrow" htmlFor="note-box">One line: what did you do today?</label>
      <div className="flex gap-2">
        <input id="note-box" className="field" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="Got the ASCII box working with my partner" />
        <button className="btn btn-primary" disabled={text.trim().length < 3}>Save</button>
      </div>
      {sent && exit && <p className="mono text-xs up" role="status">Saved.</p>}
    </form>
  );
}

/** Loads a lab tier's checkpoints: code steps of a course, or problems from the bank. */
function useTier(source, ids) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const key = `${source}|${ids.join(',')}`;
  useEffect(() => {
    let stop = false;
    setItems(null);
    setErr('');
    const [kind, rest] = source.split(':');
    const load =
      kind === 'course'
        ? api.get(`/learn/${rest}`).then((c) =>
            ids.map((id) => {
              const s = c.steps.find((x) => x.id === id);
              return { id, title: s?.title ?? id, body: s?.body ?? '', starter: c.progress?.[id]?.code || s?.starter || '', cases: s?.cases ?? [], course: rest };
            })
          )
        : Promise.all(ids.map((slug) => api.get(`/problems/${slug}`).then((p) => ({ id: slug, title: p.title, body: p.body, starter: p.starter ?? '', cases: p.cases }))));
    load.then((x) => !stop && setItems(x)).catch((e) => !stop && setErr(e.message));
    return () => {
      stop = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { items, err };
}

function PairRole({ partner, seat, startedAt, skew }) {
  useTick();
  const now = Date.now() + skew;
  const turn = Math.floor(Math.max(0, now - startedAt) / SWAP_MS);
  const driving = (turn + seat) % 2 === 0;
  const next = startedAt + (turn + 1) * SWAP_MS - now;
  return (
    <div className="ses-pair" role="status">
      <span className="eyebrow">{partner?.length ? `with ${partner.join(' and ')}` : 'pairs'}</span>
      <b>{driving ? 'You drive: you type' : 'You navigate: read and think out loud'}</b>
      <span className="mono m">swap in {clock(next)}</span>
    </div>
  );
}

function Checkpoint({ item, passed, onPass, onNext }) {
  const [code, setCode] = useState(item.starter);
  return (
    <div className="ses-cp">
      <article className="duel-statement">
        <h3 className="display mb-2 text-xl">{item.title}</h3>
        <Body text={item.body} />
      </article>
      <div className="min-w-0">
        {passed && (
          <div className="ses-passed mb-3" role="status">
            <span className="mono up text-sm">Checkpoint passed.</span>
            {onNext && <button type="button" className="btn btn-primary" onClick={onNext}>Next checkpoint</button>}
          </div>
        )}
        <CodeRunner id={`lab-${item.id}`} cases={item.cases} value={code} onChange={setCode} playground={false} onResults={(_, ok) => ok && onPass(code)} />
      </div>
    </div>
  );
}

/** B3: a member picks a tier and works checkpoint by checkpoint. */
export function LabPlay({ lab, block, partner, session, send, skew }) {
  const tier = lab.tier;
  const t = tier == null ? null : lab.tiers[tier];
  const { items, err } = useTier(t?.source ?? 'problems:', tier == null ? [] : lab.checkpoints);
  const [at, setAt] = useState(null);
  const passed = useMemo(() => new Set(lab.passed), [lab.passed]);
  const firstOpen = items?.findIndex((x) => !passed.has(x.id));
  const idx = at ?? (firstOpen >= 0 ? firstOpen : 0);

  if (tier == null) {
    return (
      <section className="card p-5" aria-label="Pick a tier">
        <p className="eyebrow">{block.title}: pick a tier</p>
        {block.notes && <p className="d mt-1 text-sm">{block.notes}</p>}
        <div className="duel-divs mt-4">
          {lab.tiers.map((x, i) => (
            <button key={i} type="button" onClick={() => send({ t: 'lab_tier', tier: i })}>
              <b>{x.name}</b>
              <span>{x.checkpoints} checkpoints</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const pass = (item, code) => {
    if (passed.has(item.id)) return;
    setAt(idx); // stay on it so the result shows; the member moves on with Next

    send({ t: 'lab_pass', step: item.id });
    // Course steps also count toward the member's course progress and portfolio.
    if (item.course) api.post(`/learn/${item.course}/check`, { step: item.id, passed: true, code }).catch(() => {});
  };

  return (
    <section className="grid gap-4" aria-label="Lab">
      <div className="duel-bar">
        <div>
          <p className="eyebrow">{block.title}, tier {t.name}</p>
          <h2 className="display duel-title">{lab.passed.length} of {lab.checkpoints.length} checkpoints</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => { setAt(null); send({ t: 'lab_tier', tier: (tier + 1) % lab.tiers.length }); }}>
          Switch tier
        </button>
      </div>
      {lab.pairs && <PairRole partner={partner} seat={lab.seat} startedAt={session.startedAt} skew={skew} />}
      <ol className="ses-cps" aria-label="Checkpoints">
        {(items ?? lab.checkpoints.map((id) => ({ id, title: id }))).map((x, i) => (
          <li key={x.id}>
            <button type="button" aria-current={i === idx ? 'step' : undefined} className={passed.has(x.id) ? 'done' : ''} onClick={() => setAt(i)}>
              <span className="mono">{passed.has(x.id) ? 'ok' : i + 1}</span> {x.title}
            </button>
          </li>
        ))}
      </ol>
      {err && <p className="dn text-sm">{err}</p>}
      {!items ? !err && <Spinner label="Loading the lab" /> : items[idx] && <Checkpoint key={items[idx].id} item={items[idx]} passed={passed.has(items[idx].id)} onPass={(code) => pass(items[idx], code)} onNext={idx < items.length - 1 ? () => setAt(idx + 1) : null} />}
    </section>
  );
}

/** B6: share an artifact, then give kudos in the gallery. */
export function ShowPlay({ show, earned, send }) {
  const mine = show.items.find((x) => x.mine);
  const [kind, setKind] = useState('link');
  const [url, setUrl] = useState('');
  const [line, setLine] = useState('');
  const [editing, setEditing] = useState(!mine);
  const can = line.trim().length >= 3 && (kind !== 'link' || /^https:\/\/\S+$/.test(url.trim()));

  return (
    <div className="grid gap-4">
      {editing || !mine ? (
        <form
          className="card grid gap-3 p-5"
          aria-label="Share your artifact"
          onSubmit={(e) => {
            e.preventDefault();
            send({ t: 'show_submit', kind, url: url.trim(), line: line.trim() });
            setEditing(false);
          }}
        >
          <p className="eyebrow">show: share what you made</p>
          <p className="d text-sm">It goes on your portfolio. The host picks a few for the screen.</p>
          <div className="chips" role="group" aria-label="What to share">
            <button type="button" aria-pressed={kind === 'link'} onClick={() => setKind('link')}>A link</button>
            {earned?.lab && <button type="button" aria-pressed={kind === 'lab'} onClick={() => setKind('lab')}>My lab result</button>}
            {earned?.duel && <button type="button" aria-pressed={kind === 'duel'} onClick={() => setKind('duel')}>My duel result</button>}
          </div>
          {kind === 'link' ? (
            <input className="field" value={url} maxLength={300} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/you/project" aria-label="Link" />
          ) : (
            <p className="mono g text-sm">{earned[kind]}</p>
          )}
          <input className="field" value={line} maxLength={140} onChange={(e) => setLine(e.target.value)} placeholder="One line about it" aria-label="One line about it" />
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={!can}>{mine ? 'Replace mine' : 'Share'}</button>
        </form>
      ) : (
        <section className="card p-5" aria-label="Your artifact">
          <p className="eyebrow">you shared</p>
          <p className="mt-1 text-lg">{mine.line}</p>
          <p className="mono m text-xs" style={{ overflowWrap: 'anywhere' }}>
            {mine.url || mine.result} / {mine.kudos} kudos{show.picked.includes(mine.id) ? ' / on the screen now' : ''}
          </p>
          <button type="button" className="btn btn-ghost mt-3" onClick={() => setEditing(true)}>Replace it</button>
        </section>
      )}
      {show.items.some((x) => !x.mine) && (
        <section className="card p-5" aria-label="Gallery">
          <p className="eyebrow mb-3">gallery: one kudos each</p>
          <ul className="ses-show-list">
            {show.items.filter((x) => !x.mine).map((x) => (
              <li key={x.id}>
                <div className="min-w-0">
                  <b>{x.name}</b>
                  <p className="text-sm">{x.line}</p>
                  {x.url ? (
                    <a className="mono g truncate text-xs" href={x.url} target="_blank" rel="noreferrer noopener">{x.url}</a>
                  ) : (
                    <p className="mono m text-xs">{x.result}</p>
                  )}
                </div>
                <button type="button" className="btn btn-ghost" disabled={x.gave} aria-pressed={x.gave} onClick={() => send({ t: 'show_kudos', id: x.id })}>
                  {x.gave ? 'Kudos given' : 'Kudos'} {x.kudos}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** B8: ask the speaker, upvote others (one each). Anonymous. */
export function SpeakerPlay({ speaker, send }) {
  const [text, setText] = useState('');
  return (
    <div className="grid gap-4">
      <form
        className="card grid gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send({ t: 'sq_ask', text: text.trim() });
          setText('');
        }}
      >
        <label className="eyebrow" htmlFor="sq-box">Ask the speaker (no name shown)</label>
        <div className="flex gap-2">
          <input id="sq-box" className="field" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question" />
          <button className="btn btn-primary" disabled={text.trim().length < 3}>Send</button>
        </div>
      </form>
      {speaker.qs.length > 0 && (
        <ul className="ses-qs card p-4">
          {speaker.qs.map((q) => (
            <li key={q.id} className={q.answered ? 'done' : ''}>
              <button
                type="button"
                className="ses-vote"
                aria-pressed={q.voted}
                disabled={q.mine || q.answered}
                aria-label={`${q.mine ? 'Your question' : q.voted ? 'You upvoted this' : 'Upvote'}, ${q.votes} ${q.votes === 1 ? 'vote' : 'votes'}`}
                onClick={() => send({ t: 'sq_vote', id: q.id })}
              >
                <span aria-hidden="true">^</span>
                <b>{q.votes}</b>
              </button>
              <span className="flex-1">{q.text}{q.mine && <span className="m mono text-xs"> (yours)</span>}</span>
              {q.answered && <span className="m mono text-xs">answered</span>}
            </li>
          ))}
        </ul>
      )}
      {speaker.takeaways && (
        <section className="card p-4">
          <p className="eyebrow mb-1">takeaways</p>
          <p className="text-sm whitespace-pre-wrap">{speaker.takeaways}</p>
        </section>
      )}
    </div>
  );
}

/** B7 for members: ask, offer to help, and name your helper when it is solved. */
export function HelpQueue({ help, send }) {
  const [topic, setTopic] = useState('');
  const mine = help.filter((h) => h.mine);
  const others = help.filter((h) => !h.mine);
  return (
    <section className="card grid gap-3 p-4" aria-label="Help queue">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send({ t: 'help_ask', topic: topic.trim() });
          setTopic('');
        }}
      >
        <label className="eyebrow" htmlFor="help-box">Stuck? Ask the room for help</label>
        <div className="flex gap-2">
          <input id="help-box" className="field" maxLength={140} value={topic} disabled={mine.length >= 2} onChange={(e) => setTopic(e.target.value)} placeholder={mine.length >= 2 ? 'Mark one solved first' : 'What are you stuck on?'} />
          <button className="btn btn-ghost" disabled={topic.trim().length < 3 || mine.length >= 2}>Ask</button>
        </div>
      </form>
      {mine.map((h) => (
        <div key={h.id} className="ses-help-mine">
          <p><b>You asked:</b> {h.topic}</p>
          <p className="m mono text-xs">{h.helpers.length ? `${h.helpers.map((x) => x.name).join(', ')} can help.` : 'Waiting for a helper. Officers see it too.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {h.helpers.map((x) => (
              <button key={x.uid} type="button" className="btn btn-primary" onClick={() => send({ t: 'help_solve', id: h.id, helper: x.uid })}>
                Solved, thanks to {x.name.split(' ')[0]}
              </button>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'help_solve', id: h.id, helper: null })}>Solved it another way</button>
            <button type="button" className="btn btn-ghost" onClick={() => send({ t: 'help_cancel', id: h.id })}>Withdraw</button>
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <>
          <p className="eyebrow">others waiting ({others.length}). Helping earns mentor credit once they mark it solved.</p>
          <ul className="grid gap-2">
            {others.map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm">
                  {h.topic} <span className="m mono text-xs">{h.name}</span>
                </span>
                <button type="button" className="btn btn-ghost" disabled={h.offered} aria-pressed={h.offered} onClick={() => send({ t: 'help_offer', id: h.id })}>
                  {h.offered ? 'Go to them' : 'I can help'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
