/**
 * The meeting as a system (B1, B3, B4, B6, B7, B8, B10): screens for the
 * run-of-show. The room's Durable Object (worker/hub/room-do.js + session.js)
 * holds the state; these render it.
 *
 *   officer console  RunOfShow, BlockEditor, LabCounts, ShowConsole, HelpConsole
 *   student laptop   ExitCard, LabPlay, ShowPlay, HelpQueue, NoteBox
 * Wave 6 moved the projector, the speaker screens and concept checks to src/pages/live/.
 */
import { useEffect, useMemo, useState } from 'react';
import { exitNoteError } from '../../shared/live.js';
import { findCourse } from '../../shared/courses.js';
import { api } from '../lib/api.js';
import CodeRunner from '../components/CodeRunner.jsx';
import { Spinner } from '../components/bits.jsx';
import { Body } from './Course.jsx';
import { BLOCK_LABEL, BLOCK_TYPES, DEFAULT_TIERS } from '../../shared/session-templates.js';
import { clock } from './Duel.jsx';
import BlockPayload from './officer/blocks/index.jsx';

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
  // A running duel round or team contest must not end by a slip of the thumb on the big yellow button.
  const live = state.duel?.phase === 'live' || state.contest?.phase === 'live';
  const leave = (fn) => () => {
    if (!live || window.confirm('A round is still running. Leave this block anyway?')) fn();
  };
  return (
    <section className="ses-ros card p-5" aria-label="Run of show">
      <div className="ses-ros-head">
        <p className="eyebrow">run of show</p>
        <BlockTimer session={sess} skew={skew} />
      </div>
      <ol className="ses-blocks">
        <li>
          <button type="button" aria-current={cur === -1 ? 'step' : undefined} onClick={leave(() => send({ t: 'block_go', i: -1 }))}>
            <span className="mono">00</span>
            <span>Join screen</span>
            <span className="m">check-in</span>
          </button>
        </li>
        {sess.blocks.map((b, i) => (
          <li key={b.id}>
            <button type="button" aria-current={cur === i ? 'step' : undefined} onClick={leave(() => send({ t: 'block_go', i }))}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span>{b.title}</span>
              <span className="m">{BLOCK_LABEL[b.type]}{b.minutes ? `, ${b.minutes} min` : ''}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="ses-ctl">
        <button type="button" className="btn btn-ghost" disabled={cur < 0} onClick={leave(() => send({ t: 'block_prev' }))}>Back</button>
        <button type="button" className={live ? 'btn btn-ghost' : 'btn btn-primary'} disabled={cur >= sess.blocks.length - 1} onClick={leave(() => send({ t: 'block_next' }))}>
          {cur < 0 ? 'Start the meeting' : `Next: ${sess.blocks[cur + 1]?.title ?? 'end'}${live ? ' (round running)' : ''}`}
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

/**
 * Edit the run-of-show, before or during the meeting. Saving keeps the current block running.
 * Wave 6: each block also edits its payload (speaker, duel pack, concept checks); planId lets
 * the speaker editor list questions asked early for that plan.
 */
export function BlockEditor({ blocks, send, onDone, planId }) {
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
  const firstSpeaker = draft.findIndex((b) => b.type === 'speaker');

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
            <div className="ses-edit-text">
              <label className="grid gap-1">
                <span className="eyebrow">On screen (projector and laptops)</span>
                <input className="field" maxLength={500} value={b.screen ?? ''} placeholder="Optional, e.g. Pick a tier and find your partner" onChange={(e) => set(i, { screen: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span className="eyebrow">Officer notes (only officers see these)</span>
                <input className="field" maxLength={500} value={b.notes ?? ''} placeholder="Optional, e.g. Ask Sam to demo first" onChange={(e) => set(i, { notes: e.target.value })} />
              </label>
            </div>
            <BlockPayload block={b} onChange={(patch) => set(i, patch)} planId={planId} firstSpeaker={i === firstSpeaker} />
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
          onClick={() => setDraft((d) => [...d, { type: addType, title: BLOCK_LABEL[addType], minutes: 5, notes: '', screen: '', ...(addType === 'lab' && { lab: { pairs: true, tiers: DEFAULT_TIERS.map((t) => ({ ...t })) } }) }])}
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

/** B4, V3-A: the attendance rule, stated plainly, with where this member stands. */
export function ExitCard({ exit, dropin }) {
  // One calm line on every block; the full rules sit one tap away so they do not push the task off a phone screen.
  return (
    <section className={`ses-exit ${exit ? "ok" : ""}`} aria-label="Attendance" role="status">
      {exit ? (
        <p><b>Checked in, bonus earned.</b> You {EXIT_LABEL[exit] ?? "did something"}. Paid when the room closes.</p>
      ) : (
        <p><b>Checked in.</b> {dropin ? "Write one line about what you did for a small bonus." : "Do one thing here for a small bonus."}</p>
      )}
      <details className="mt-1">
        <summary className="mono text-xs">How attendance works</summary>
        <p className="mt-1 text-sm">
          Checking in counts. {dropin
            ? "A real line about what you did, or helping someone, adds a small bonus."
            : "For a small bonus, answer a poll, pass a lab checkpoint, try a duel or contest problem, share in show, help someone, or write a real line at the close."}{" "}
          Both are paid when the room closes.
        </p>
      </details>
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
      <label className="eyebrow" htmlFor="note-box">One line: what did you do today? (four words or more)</label>
      <div className="flex gap-2">
        <input id="note-box" className="field" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="Got the ASCII box working with my partner" />
        <button className="btn btn-primary" disabled={Boolean(exitNoteError(text))}>Save</button>
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
              return { id, title: s?.title ?? id, python: true, body: s?.body ?? '', starter: c.progress?.[id]?.code || s?.starter || '', cases: s?.cases ?? [], course: rest };
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
  const [code, setCode] = useState('');
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
        <CodeRunner id={`lab-${item.id}`} cases={item.cases} starter={item.starter} langs={item.python ? ['python'] : undefined} onChange={setCode} playground={false} onResults={(_, ok) => ok && onPass(code)} />
      </div>
    </div>
  );
}

/** What a tier is, in words, so a member does not pick one blind: the course behind it, its level and length. */
function tierBlurb(x) {
  const slug = String(x.source ?? '').startsWith('course:') ? x.source.slice(7) : '';
  const c = slug ? findCourse(slug) : null;
  return c ? [c.title.replace(/^Lab: /, ''), c.level, c.minutes ? `about ${c.minutes} min` : ''].filter(Boolean).join(', ') : '';
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
        {block.screen && <p className="d mt-1 text-sm">{block.screen}</p>}
        <div className="duel-divs mt-4">
          {lab.tiers.map((x, i) => (
            <button key={i} type="button" onClick={() => send({ t: 'lab_tier', tier: i })}>
              <b>{x.name}</b>
              {tierBlurb(x) && <span>{tierBlurb(x)}</span>}
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
