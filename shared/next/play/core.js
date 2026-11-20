/**
 * Play: the rules every game shares, used by the browser, the worker and the
 * tests. No content here (the word lists and banks are their own modules), so
 * the worker stays small.
 *
 * Every student gets the same puzzle on the same Chicago date: picks come from
 * a seeded shuffle of the bank, and a bank is used up before anything repeats.
 */
import { chicagoDate, addDays, weekStart } from '../../daily.js';

export { chicagoDate, addDays, weekStart };

/** `tile` names the colour token each game's tile and accents use. */
export const GAMES = [
  { slug: 'keyword', name: 'Keyword', blurb: 'Guess the hidden CS term in six tries.', tile: 'hit' },
  { slug: 'trace', name: 'Trace', blurb: 'Read the Java. Call the exact output.', tile: 'near' },
  { slug: 'buckets', name: 'Buckets', blurb: 'Sort sixteen terms into four groups.', tile: 'blue' },
  { slug: 'order-up', name: 'Order Up', blurb: 'Sixty seconds of Big-O, as fast as you can.', tile: 'purple' },
  { slug: 'squash', name: 'Squash', blurb: 'Find the buggy line, then pick the fix.', tile: 'red' },
  { slug: 'bits', name: 'Bit Flip', blurb: 'Flip eight bits to hit each number.', tile: 'miss' },
];
export const SLUGS = GAMES.map((g) => g.slug);
export const gameBySlug = (slug) => GAMES.find((g) => g.slug === slug) ?? null;

const ANCHOR = '2026-01-01';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s) => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

/** Whole days from the anchor to `date` (negative before it). */
export const dayNumber = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${ANCHOR}T12:00:00Z`)) / 86_400_000);

// FNV-1a then mulberry32: tiny, the same in every runtime.
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A seeded random number generator: rng('x')() is in [0, 1). */
export function rng(seed) {
  let a = hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded Fisher-Yates shuffle of `list` (a copy). */
export function shuffle(list, seed) {
  const r = rng(seed);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const range = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * `k` indexes into a bank of `n` for one day. Day d takes positions d*k to
 * d*k+k-1 of an endless list made of shuffled copies of the bank, so nothing
 * repeats until the whole bank has been used.
 */
export function dailyPicks(slug, date, n, k = 1) {
  const d = dayNumber(date);
  const cache = new Map();
  return range(k).map((j) => {
    const i = d * k + j;
    const cycle = Math.floor(i / n);
    if (!cache.has(cycle)) cache.set(cycle, shuffle(range(n), `${slug}:${cycle}`));
    return cache.get(cycle)[((i % n) + n) % n];
  });
}

/** `k` distinct indexes for a practice round. */
export const practicePicks = (n, k, seed) => shuffle(range(n), `practice:${seed}`).slice(0, k);

/* ---------------------------------- scores --------------------------------- */

/**
 * Every finished game becomes a 0-100 score for the weekly play board. These
 * never touch club season points.
 */
export function pointsFor(slug, r) {
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
  switch (slug) {
    case 'keyword': // 1 guess 100 ... 6 guesses 50; a loss still shows up
      return r.won ? clamp(110 - 10 * r.guesses) : 10;
    case 'trace': // five snippets
      return clamp(20 * r.correct);
    case 'buckets': // four mistakes allowed
      return r.won ? clamp(100 - 20 * r.mistakes) : clamp(10 * r.found);
    case 'order-up': // 25 right in a minute is a perfect run
      return clamp(4 * r.correct);
    case 'squash': // three bugs, three lives
      return clamp((100 * r.fixed) / 3 - 10 * r.mistakes);
    case 'bits': // five targets; 30 seconds or faster is perfect
      return clamp(Math.max(20, 130 - r.ms / 1000));
    default:
      return 0;
  }
}

/** Server-side check of a posted result. Returns an error sentence or null. */
export function resultError(b) {
  if (!b || typeof b !== 'object') return 'Send a result.';
  if (!SLUGS.includes(b.game)) return 'That game does not exist.';
  if (!isDate(b.date)) return 'Send the puzzle date as YYYY-MM-DD.';
  if (!Number.isInteger(b.score) || b.score < 0 || b.score > 100) return 'Score must be a whole number from 0 to 100.';
  if (b.guesses != null && (!Number.isInteger(b.guesses) || b.guesses < 0 || b.guesses > 99)) return 'Guesses must be a whole number from 0 to 99.';
  if (b.ms != null && (!Number.isInteger(b.ms) || b.ms < 0 || b.ms > 86_400_000)) return 'Time must be under a day.';
  if (b.detail != null && (typeof b.detail !== 'string' || b.detail.length > 400)) return 'Detail must be text under 400 characters.';
  return null;
}

/** Results may be saved for today or yesterday (Chicago), so a late-night finish still counts. */
export const dateOpen = (date, today = chicagoDate()) => date === today || date === addDays(today, -1);

/**
 * Days in a row with at least one daily game finished. Today not played yet
 * does not break the streak; yesterday missed does.
 */
export function streakOf(dates, today = chicagoDate()) {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Milliseconds until the next Chicago midnight. ponytail: off by an hour on the two DST days. */
export function msToNextPuzzle(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(now)
      .map((x) => [x.type, Number(x.value)])
  );
  const since = ((p.hour % 24) * 3600 + p.minute * 60 + p.second) * 1000 + now.getMilliseconds();
  return 86_400_000 - since;
}

/* ---------------------------------- Keyword --------------------------------- */

/**
 * Per-letter feedback for a guess: 'hit' (right place), 'near' (in the word,
 * elsewhere) or 'miss'. Repeated letters only get as many hit/near marks as
 * the answer has copies, hits first.
 */
export function scoreGuess(guess, answer) {
  const out = Array(guess.length).fill('miss');
  const left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (out[i] !== 'hit' && left[guess[i]] > 0) {
      out[i] = 'near';
      left[guess[i]]--;
    }
  }
  return out;
}

/* ---------------------------------- Bit Flip -------------------------------- */

/** Five targets for a seed: three shown in decimal, the last two in hex. Never 0. */
export function bitTargets(seed) {
  const r = rng(`bits:${seed}`);
  return [0, 1, 2, 3, 4].map((i) => ({ value: 1 + Math.floor(r() * 255), hex: i >= 3 }));
}

export const SQUARE = { hit: '🟩', near: '🟨', miss: '⬛', bad: '🟥', blue: '🟦', purple: '🟪' };
