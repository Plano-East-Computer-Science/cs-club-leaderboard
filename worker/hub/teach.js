/**
 * Concept checks in a teach block (Wave 6, peer instruction): everyone votes,
 * the room sees the split without the answer, talks to a neighbour for a
 * minute, votes again, then the answer is revealed next to both splits.
 * No points for answers: a vote only counts as having done something.
 *
 * Pure rules over plain state, like session.js. The room's Durable Object
 * holds `check` and supplies the clock; test/live.test.js checks these.
 *
 *   check { id, block, i, text, options, answer, phase, first: {uid: n}, second: {uid: n}, discussEndsAt }
 *   phase: 'vote' -> 'discuss' -> 'revote' -> 'reveal'
 */

export const DISCUSS_MS = 60_000;
export const PHASES = ['vote', 'discuss', 'revote', 'reveal'];

/** Opens check `i` of a teach block. */
export function startCheck(block, i, id) {
  const c = block?.type === 'teach' ? block.teach?.checks?.[Number(i)] : null;
  if (!c) return { error: 'No such check in this block.' };
  return { check: { id, block: block.id, i: Number(i), text: c.text, options: c.options, answer: c.answer, phase: 'vote', first: {}, second: {}, discussEndsAt: 0 } };
}

/** A member votes, or changes their vote, while voting is open. */
export function castVote(check, uid, choice) {
  const box = check?.phase === 'vote' ? check.first : check?.phase === 'revote' ? check.second : null;
  if (!box) return { error: 'Voting is closed.' };
  const n = Number(choice);
  if (!Number.isInteger(n) || n < 0 || n >= check.options.length) return { error: 'Pick one of the options.' };
  box[uid] = n;
  return { ok: true };
}

/** Votes per option. */
export const split = (votes, n) => {
  const out = Array(n).fill(0);
  for (const v of Object.values(votes ?? {})) if (v >= 0 && v < n) out[v] += 1;
  return out;
};

/** Moves to the next phase. Entering discussion starts the one-minute timer. */
export function nextPhase(check, now) {
  if (!check) return { error: 'No check is running.' };
  const at = PHASES.indexOf(check.phase);
  if (at >= PHASES.length - 1) return { error: 'The answer is already showing.' };
  check.phase = PHASES[at + 1];
  check.discussEndsAt = check.phase === 'discuss' ? now + DISCUSS_MS : 0;
  return { ok: true };
}

/** Straight to the answer: when nearly everyone got it right first time, discussion adds little. */
export function reveal(check) {
  if (!check) return { error: 'No check is running.' };
  check.phase = 'reveal';
  check.discussEndsAt = 0;
  return { ok: true };
}

/**
 * The check as one screen sees it. The officer console sees everything as it
 * happens. Everyone else (projector, members) sees how many voted while a
 * vote is open, the first split once discussion starts, the second split and
 * the answer only at the reveal. A member also sees their own votes.
 */
export function checkView(check, role, uid) {
  if (!check) return null;
  const n = check.options.length;
  const officer = role === 'host';
  const revealed = check.phase === 'reveal';
  const box = check.phase === 'revote' ? check.second : check.first;
  return {
    id: check.id,
    i: check.i,
    text: check.text,
    options: check.options,
    phase: check.phase,
    discussEndsAt: check.discussEndsAt,
    voted: Object.keys(box).length,
    first: officer || check.phase !== 'vote' ? split(check.first, n) : null,
    second: officer || revealed ? (Object.keys(check.second).length ? split(check.second, n) : null) : null,
    answer: officer || revealed ? check.answer : null,
    ...(role === 'student' && { mine: check.first[uid] ?? null, mine2: check.second[uid] ?? null }),
  };
}
