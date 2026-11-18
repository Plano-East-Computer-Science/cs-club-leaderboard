/**
 * Duel block (B2): the rules, as pure functions over a plain state object.
 * The room's Durable Object (room-do.js) holds the state, supplies the clock
 * and the database, and calls these; keeping them pure is what lets
 * test/duel.test.js check matching and the round lifecycle without a runtime.
 *
 * Shape:
 *   { phase: 'lobby' | 'live' | 'spotlight' | 'done', round, rounds, minutes, newMode,
 *     problems: { div: [{ slug, title }] }, divs: { uid: div },
 *     matches: [{ id, div, slug, title, ghost, ghostMs, sides: [{ uids, attempts, solvedMs, won }] }],
 *     startedAt, endsAt, spotlightEndsAt, spotlight, avoid }
 *
 * Judging is in the browser (honour system); the server only checks that a
 * submit is for this round, this student and this student's problem, and
 * times it with its own clock.
 */
import { makePairs, groupKeys } from './pairs.js';

export const DIVISIONS = ['new', 'comfortable', 'contest'];
export const SPOTLIGHT_MS = 3 * 60_000;
const MAX_PROBLEMS = 3;

/** problems: { div: [{ slug, title }] } already checked against the bank. */
export function newDuel({ problems, minutes = 10, rounds = 3, newMode = '1v1' } = {}) {
  const clean = {};
  for (const d of DIVISIONS) {
    const list = Array.isArray(problems?.[d]) ? problems[d] : [];
    clean[d] = list.filter((p) => p?.slug).slice(0, MAX_PROBLEMS).map((p) => ({ slug: String(p.slug), title: String(p.title ?? p.slug) }));
  }
  if (!DIVISIONS.some((d) => clean[d].length)) return { error: 'Pick at least one problem.' };
  const m = Math.round(Number(minutes));
  const r = Math.round(Number(rounds));
  if (!(m >= 1 && m <= 60)) return { error: 'Rounds last 1 to 60 minutes.' };
  if (!(r >= 1 && r <= 6)) return { error: 'A duel has 1 to 6 rounds.' };
  return {
    duel: {
      phase: 'lobby',
      round: 0,
      rounds: r,
      minutes: m,
      newMode: newMode === '2v2' ? '2v2' : '1v1',
      problems: clean,
      divs: {},
      matches: [],
      startedAt: 0,
      endsAt: 0,
      spotlightEndsAt: 0,
      spotlight: null,
      avoid: [],
    },
  };
}

export const findSide = (duel, uid) => {
  for (const match of duel.matches) for (const side of match.sides) if (side.uids.includes(uid)) return { match, side };
  return null;
};

/** A student picks a division. Not while they are mid-match. */
export function setDivision(duel, uid, div) {
  if (!DIVISIONS.includes(div)) return { error: 'Pick New, Comfortable or Contest.' };
  if (!duel.problems[div].length) return { error: 'That division has no problems today.' };
  if (duel.phase === 'done') return { error: 'The duel is over.' };
  if (duel.phase === 'live' && findSide(duel, uid)) return { error: 'Finish this round first.' };
  duel.divs[uid] = div;
  return { ok: true };
}

/** The problem a division plays in a given round: problems are used in order, then repeat. */
export const problemFor = (duel, div, round) => {
  const list = duel.problems[div];
  return list.length ? list[(round - 1) % list.length] : null;
};

/**
 * Starts the next round for everyone present who has picked a division.
 * present: uids connected right now. ghostTimes: { slug: best solved ms so far }.
 * Pairs within a division; an odd count makes one 3-way match; someone alone
 * races a ghost (the best time so far, or just the clock).
 * New division in 2v2 mode: pairs become driver/navigator teams first.
 */
export function startRound(duel, { now, present, ghostTimes = {}, rng = Math.random }) {
  if (duel.phase !== 'lobby' && duel.phase !== 'spotlight') return { error: 'A round is already running.' };
  if (duel.round >= duel.rounds) return { error: 'That was the last round.' };
  const round = duel.round + 1;
  const here = new Set(present.map(String));
  const matches = [];
  const avoid = [];

  for (const div of DIVISIONS) {
    const prob = problemFor(duel, div, round);
    const people = Object.keys(duel.divs).filter((u) => duel.divs[u] === div && here.has(u));
    if (!prob || !people.length) continue;

    const teams =
      div === 'new' && duel.newMode === '2v2' && people.length >= 4
        ? makePairs(people, { avoid: duel.avoid, rng })
        : people.map((u) => [u]);
    const byKey = new Map(teams.map((t) => [t.join('+'), t]));
    const groups = makePairs([...byKey.keys()], { avoid: duel.avoid, rng });
    avoid.push(...groupKeys(groups));

    for (const g of groups) {
      matches.push({
        id: matches.length + 1,
        div,
        slug: prob.slug,
        title: prob.title,
        ghost: g.length === 1,
        ghostMs: g.length === 1 ? (ghostTimes[prob.slug] ?? null) : null,
        sides: g.map((k) => ({ uids: byKey.get(k), attempts: 0, solvedMs: null, won: false })),
      });
    }
  }
  if (!matches.length) return { error: 'Nobody here has picked a division yet.' };

  Object.assign(duel, {
    phase: 'live',
    round,
    matches,
    avoid,
    startedAt: now,
    endsAt: now + duel.minutes * 60_000,
    spotlight: null,
    spotlightEndsAt: 0,
  });
  return { ok: true };
}

/**
 * A student reports a judged attempt. Rejected after the round ends, for an
 * old round, for anyone not in a match, and for a problem not theirs.
 */
export function submit(duel, uid, { round, slug, passed }, now) {
  if (duel.phase !== 'live' || now >= duel.endsAt) return { error: 'The round is over.' };
  if (Number(round) !== duel.round) return { error: 'That round is over.' };
  const found = findSide(duel, String(uid));
  if (!found) return { error: 'You are not in this round. Wait for the next one.' };
  if (slug !== found.match.slug) return { error: 'That is not your problem this round.' };
  if (found.side.solvedMs != null) return { error: 'Already solved.' };
  found.side.attempts += 1;
  if (passed === true) found.side.solvedMs = now - duel.startedAt;
  return { ok: true, solved: passed === true };
}

/** Every side has solved: no reason to keep the clock running. */
export const everyoneSolved = (duel) => duel.matches.every((m) => m.sides.every((s) => s.solvedMs != null));

/** Decides each match. First accepted wins; against a ghost, beat its time (or just solve). */
function decide(match) {
  const solved = match.sides.filter((s) => s.solvedMs != null);
  if (!solved.length) return;
  const best = solved.reduce((a, b) => (b.solvedMs < a.solvedMs ? b : a));
  if (match.ghost && match.ghostMs != null && best.solvedMs >= match.ghostMs) return;
  best.won = true;
}

/**
 * Ends the live round and opens the 3-minute "how I solved it" spotlight.
 * Returns one row per student for duel_results (the caller adds code and room).
 */
export function endRound(duel, now) {
  if (duel.phase !== 'live') return { error: 'No round is running.' };
  const rows = [];
  for (const m of duel.matches) {
    decide(m);
    for (const s of m.sides) {
      for (const uid of s.uids) {
        rows.push({ round: duel.round, division: m.div, match_no: m.id, user_id: uid, slug: m.slug, attempts: s.attempts, solved_ms: s.solvedMs, won: s.won ? 1 : 0 });
      }
    }
  }
  Object.assign(duel, { phase: 'spotlight', spotlightEndsAt: now + SPOTLIGHT_MS, spotlight: null });
  return { ok: true, rows };
}

/** The host asks someone who solved it this round to explain. */
export function pickSpotlight(duel, uid) {
  if (duel.phase !== 'spotlight') return { error: 'Spotlight is between rounds.' };
  const found = findSide(duel, String(uid));
  if (!found || found.side.solvedMs == null) return { error: 'Pick someone who solved it.' };
  duel.spotlight = String(uid);
  return { ok: true };
}

export function finish(duel) {
  if (duel.phase === 'live') return { error: 'End the round first.' };
  duel.phase = 'done';
  return { ok: true };
}

/* ---------------------------------- views --------------------------------- */

const sideView = (s, names, ids = false) => ({
  ...(ids && { uids: s.uids }),
  names: s.uids.map((u) => names[u] ?? 'Student'),
  attempts: s.attempts,
  solved: s.solvedMs != null,
  ms: s.solvedMs,
  won: s.won,
});

/**
 * What each screen sees. Never code, and never a ranking across divisions:
 * the projector shows matches grouped by division, a student sees their own.
 */
export function duelView(duel, { role, uid, names = {}, present = [] }) {
  if (!duel) return null;
  const base = {
    phase: duel.phase,
    round: duel.round,
    rounds: duel.rounds,
    minutes: duel.minutes,
    newMode: duel.newMode,
    endsAt: duel.endsAt,
    spotlightEndsAt: duel.spotlightEndsAt,
    open: Object.fromEntries(DIVISIONS.map((d) => [d, duel.problems[d].length > 0])),
    spotlight: duel.spotlight && {
      name: names[duel.spotlight] ?? 'Student',
      title: findSide(duel, duel.spotlight)?.match.title ?? '',
      ms: findSide(duel, duel.spotlight)?.side.solvedMs ?? null,
    },
  };

  if (role === 'host') {
    const here = new Set(present.map(String));
    const inMatch = new Set(duel.matches.flatMap((m) => m.sides.flatMap((s) => s.uids)));
    return {
      ...base,
      problems: duel.problems,
      ready: Object.fromEntries(DIVISIONS.map((d) => [d, Object.keys(duel.divs).filter((u) => duel.divs[u] === d && here.has(u)).length])),
      waiting: Object.keys(duel.divs).filter((u) => here.has(u) && !inMatch.has(u)).length,
      matches: duel.matches.map((m) => ({ id: m.id, div: m.div, title: m.title, ghost: m.ghost, ghostMs: m.ghostMs, sides: m.sides.map((s) => sideView(s, names, true)) })),
    };
  }

  const found = findSide(duel, String(uid));
  const me = found && found.match.sides.indexOf(found.side);
  return {
    ...base,
    div: duel.divs[uid] ?? null,
    match: found && {
      slug: found.match.slug,
      title: found.match.title,
      ghost: found.match.ghost,
      ghostMs: found.match.ghostMs,
      me,
      seat: found.side.uids.indexOf(String(uid)), // 2v2: 0 drives first, 1 navigates
      sides: found.match.sides.map((s) => sideView(s, names)),
    },
  };
}
