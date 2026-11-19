/**
 * The meeting as a system (B1, B3, B6, B7, B8): pure rules over plain state,
 * like duel.js. The room's Durable Object (room-do.js) holds the state,
 * supplies the clock and the database, and calls these; test/session.test.js
 * checks them without a runtime.
 *
 *   session  { kind, template, blocks, cur, startedAt, endsAt }   cur -1 = lobby (join screen)
 *   help     [{ id, uid, topic, helpers: [uid], status, helper }]  B7 help queue
 *   speaker  { qs: [{ id, uid, text, votes: [uid], answered }], takeaways }   B8
 *   show     { items: [{ id, uid, kind, url, line, kudos: [uid] }], picked: [id] }  B6
 *   labs     { blockId: { picks: { uid: tier }, passed: { uid: [checkpoint] } } }  B3
 *
 * Every function returns { error } with a sentence for the student, or a result.
 */
import { cleanBlocks, templateBlocks, ROOM_KINDS } from '../../shared/session-templates.js';

export const SWAP_MS = 7 * 60_000; // B3 pair mode: driver and navigator swap this often

const line = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* --------------------------------- B1 blocks -------------------------------- */

export function newSession({ kind = 'meeting', template = '', blocks = null, minutes } = {}) {
  const k = ROOM_KINDS.includes(kind) ? kind : 'meeting';
  // G1: a planned session brings its own blocks; they go through the same validator as any edit.
  const planned = k === 'dropin' ? [] : cleanBlocks(blocks);
  // V3-A: otherwise the template at the room's length (60 or 120 minutes).
  const agenda = k === 'dropin' ? [] : planned.length ? planned : templateBlocks(template || 'build', minutes);
  return { kind: k, template: k === 'dropin' ? '' : template, blocks: agenda, cur: -1, startedAt: 0, endsAt: 0 };
}

export const currentBlock = (sess) => sess?.blocks[sess.cur] ?? null;

/** Host jumps to block i (-1 is the join screen). Starts that block's timer. */
export function goTo(sess, i, now) {
  if (sess.kind === 'dropin') return { error: 'A drop-in has no agenda.' };
  const n = Number(i);
  if (!Number.isInteger(n) || n < -1 || n >= sess.blocks.length) return { error: 'No such block.' };
  const mins = sess.blocks[n]?.minutes ?? 0;
  Object.assign(sess, { cur: n, startedAt: now, endsAt: mins ? now + mins * 60_000 : 0 });
  return { ok: true };
}

/** Adds (or with a negative n, removes) minutes on the running block's timer. */
export function addTime(sess, minutes, now) {
  const m = Math.round(Number(minutes));
  if (!currentBlock(sess) || !(Math.abs(m) >= 1 && Math.abs(m) <= 30)) return { error: 'Nothing to time.' };
  sess.endsAt = Math.max(now, (sess.endsAt || now) + m * 60_000);
  return { ok: true };
}

/**
 * Replaces the run-of-show, before or during the meeting. The current block
 * keeps running when it survives the edit; if it was removed, the pointer
 * stays at the same position and that block starts fresh.
 */
export function setBlocks(sess, blocks, now) {
  if (sess.kind === 'dropin') return { error: 'A drop-in has no agenda.' };
  const was = currentBlock(sess);
  const list = cleanBlocks(blocks);
  if (!list.length) return { error: 'Keep at least one block.' };
  sess.blocks = list;
  if (sess.cur < 0) return { ok: true };
  const at = list.findIndex((x) => x.id === was?.id);
  if (at >= 0) sess.cur = at;
  else goTo(sess, Math.min(sess.cur, list.length - 1), now);
  return { ok: true };
}

/* ------------------------------ B7 help queue ------------------------------- */

export function helpAsk(help, uid, topic, id) {
  const t = line(topic, 140);
  if (t.length < 3) return { error: 'Say what you are stuck on, in a few words.' };
  if (help.filter((h) => h.uid === uid && h.status === 'open').length >= 2) return { error: 'You have two open requests. Mark one solved first.' };
  if (help.filter((h) => h.status === 'open').length >= 60) return { error: 'The queue is full. Find an officer.' };
  help.push({ id, uid, topic: t, helpers: [], status: 'open', helper: null });
  // Keep the last solved ones for the console; drop the oldest beyond that.
  while (help.length > 120) help.splice(help.findIndex((h) => h.status !== 'open'), 1);
  return { ok: true };
}

const openReq = (help, id) => help.find((h) => h.id === Number(id) && h.status === 'open');

/** Any member can offer to help with someone else's open request. */
export function helpOffer(help, uid, id) {
  const h = openReq(help, id);
  if (!h) return { error: 'That one is already solved.' };
  if (h.uid === uid) return { error: 'That is your own request.' };
  if (!h.helpers.includes(uid)) h.helpers = [...h.helpers, uid].slice(0, 5);
  return { ok: true };
}

/**
 * Only the asker marks it solved, naming one of the members who offered (or
 * nobody, when an officer or the asker sorted it). Returns the helper to pay.
 */
export function helpSolve(help, uid, id, helper = null) {
  const h = openReq(help, id);
  if (!h) return { error: 'That one is already solved.' };
  if (h.uid !== uid) return { error: 'Only the person who asked can mark it solved.' };
  const by = helper == null || helper === '' ? null : String(helper);
  if (by && !h.helpers.includes(by)) return { error: 'Pick someone who offered to help.' };
  Object.assign(h, { status: 'solved', helper: by });
  return { ok: true, helper: by, topic: h.topic };
}

/** The asker withdraws it, or an officer clears it. Nobody is paid. */
export function helpClose(help, id, uid = null) {
  const h = openReq(help, id);
  if (!h) return { error: 'That one is already closed.' };
  if (uid != null && h.uid !== uid) return { error: 'Only the person who asked can withdraw it.' };
  Object.assign(h, { status: uid == null ? 'cleared' : 'withdrawn', helper: null });
  return { ok: true };
}

/* ------------------------------- B8 speaker -------------------------------- */

export const freshSpeaker = () => ({ qs: [], takeaways: '' });

export function sqAsk(sp, uid, text, id) {
  const t = line(text, 200);
  if (t.length < 3) return { error: 'Type a question first.' };
  if (sp.qs.filter((q) => q.uid === uid && !q.answered).length >= 3) return { error: 'Three questions waiting is the limit. Upvote others meanwhile.' };
  if (sp.qs.length >= 150) return { error: 'The question list is full.' };
  sp.qs.push({ id, uid, text: t, votes: [], answered: false });
  return { ok: true };
}

/** One upvote per member per question; pressing again takes it back. Not on your own. */
export function sqVote(sp, uid, id) {
  const q = sp.qs.find((x) => x.id === Number(id));
  if (!q || q.answered) return { error: 'That question was answered.' };
  if (q.uid === uid) return { error: 'You cannot upvote your own question.' };
  q.votes = q.votes.includes(uid) ? q.votes.filter((v) => v !== uid) : [...q.votes, uid];
  return { ok: true };
}

export function sqAnswered(sp, id) {
  const q = sp.qs.find((x) => x.id === Number(id));
  if (!q) return { error: 'No such question.' };
  q.answered = !q.answered;
  return { ok: true };
}

/** Most votes first, then oldest first. */
export const sqOrder = (qs) => [...qs].sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes.length - a.votes.length || a.id - b.id);

/* -------------------------------- B6 show ---------------------------------- */

export const freshShow = () => ({ items: [], picked: [] });

/**
 * A member's artifact: an https link, or a result they earned in this room
 * (`have` says which: { lab: 'text' | null, duel: 'text' | null }), plus one
 * line. One per member per room; sending again replaces it and its kudos.
 */
export function showSubmit(show, uid, { kind, url, line: text }, have, id) {
  const l = line(text, 140);
  if (l.length < 3) return { error: 'Add one line about it.' };
  let u = '';
  if (kind === 'link') {
    try {
      const parsed = new URL(String(url ?? '').trim());
      if (parsed.protocol !== 'https:') throw new Error();
      u = parsed.toString().slice(0, 300);
    } catch {
      return { error: 'Links must start with https://' };
    }
  } else if (kind === 'lab' || kind === 'duel') {
    if (!have?.[kind]) return { error: kind === 'lab' ? 'Pass a lab checkpoint first.' : 'Solve a duel problem first.' };
  } else {
    return { error: 'Share a link or a result.' };
  }
  const item = { id, uid, kind, url: u, line: l, result: kind === 'link' ? '' : have[kind], kudos: [] };
  const old = show.items.findIndex((x) => x.uid === uid);
  if (old >= 0) {
    show.picked = show.picked.filter((p) => p !== show.items[old].id);
    show.items.splice(old, 1, item);
  } else show.items.push(item);
  return { ok: true, item };
}

/** Host puts up to three on the projector. Pressing again takes one down. */
export function showPick(show, id) {
  const n = Number(id);
  if (!show.items.some((x) => x.id === n)) return { error: 'No such artifact.' };
  if (show.picked.includes(n)) show.picked = show.picked.filter((p) => p !== n);
  else if (show.picked.length >= 3) return { error: 'Three on the screen at once. Take one down first.' };
  else show.picked = [...show.picked, n];
  return { ok: true };
}

/** One kudos per member per artifact, never your own. Not taken back. */
export function showKudos(show, uid, id) {
  const it = show.items.find((x) => x.id === Number(id));
  if (!it) return { error: 'No such artifact.' };
  if (it.uid === uid) return { error: 'Kudos are for other people.' };
  if (it.kudos.includes(uid)) return { error: 'You already gave this one kudos.' };
  it.kudos = [...it.kudos, uid];
  return { ok: true, item: it };
}

/* --------------------------------- B3 lab ---------------------------------- */

export const freshLab = () => ({ picks: {}, passed: {} });

/** A member picks tier 0, 1 or 2. Switching keeps checkpoints already passed in the old tier. */
export function labPick(lab, uid, tier, tiers) {
  const t = Number(tier);
  if (!Number.isInteger(t) || !tiers[t]) return { error: 'Pick one of the tiers.' };
  lab.picks[uid] = t;
  return { ok: true };
}

/** checkpoints: per tier, the ordered list of checkpoint ids (code step ids or problem slugs). */
export function labPass(lab, uid, step, checkpoints) {
  const t = lab.picks[uid];
  if (t == null) return { error: 'Pick a tier first.' };
  if (!checkpoints[t]?.includes(String(step))) return { error: 'That is not a checkpoint in your tier.' };
  const key = `${t}:${step}`;
  const mine = (lab.passed[uid] ??= []);
  if (mine.includes(key)) return { ok: true, repeat: true };
  mine.push(key);
  return { ok: true };
}

/** How many checkpoints of tier t this member has passed. */
export const passedIn = (lab, uid, t) => (lab.passed[uid] ?? []).filter((k) => k.startsWith(`${t}:`)).length;

/**
 * The projector's view: per tier, how many people picked it and how many are
 * past each checkpoint ("14 past checkpoint 1"). Counts only, never names or uids.
 */
export function labCounts(lab, tiers, checkpoints) {
  return tiers.map((tier, t) => {
    const people = Object.keys(lab.picks).filter((u) => lab.picks[u] === t);
    const total = checkpoints[t]?.length ?? 0;
    return {
      name: tier.name,
      people: people.length,
      past: Array.from({ length: total }, (_, k) => people.filter((u) => passedIn(lab, u, t) > k).length),
    };
  });
}

/**
 * Pair mode: who drives right now. Seat 0 drives first; roles swap every
 * SWAP_MS from the block start. Returns { driving, swapAt }.
 */
export function pairRole(seat, startedAt, now) {
  const turn = Math.floor(Math.max(0, now - startedAt) / SWAP_MS);
  return { driving: (turn + seat) % 2 === 0, swapAt: startedAt + (turn + 1) * SWAP_MS };
}
