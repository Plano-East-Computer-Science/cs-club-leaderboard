/**
 * The Board (C1): tracks, placement and "what is next", as pure functions so
 * the worker and the Arena page agree, and so the rules are unit tested.
 *
 * A track is a ladder of rungs grouped into tiers. Nothing is locked: the
 * "next" rung is a suggestion, and members can open or tick any rung.
 */

export const TRACKS = [
  { id: 'contest', name: 'Contest', blurb: 'USACO, UIL and Codeforces. Problems with a judge and a clock.', tiers: [['bronze', 'Bronze'], ['silver', 'Silver']] },
  { id: 'build', name: 'Build', blurb: 'Git, a web page, a bot. Things you can show someone.', tiers: [['start', 'First builds'], ['ship', 'Ship it']] },
  { id: 'ai', name: 'AI', blurb: 'How models work, from a tiny one you write to real deep learning.', tiers: [['how', 'How it works'], ['deep', 'Go deeper']] },
  { id: 'data', name: 'Data', blurb: 'Python, pandas and your first model, on real datasets.', tiers: [['python', 'Python and tables'], ['ml', 'Models']] },
  { id: 'cyber', name: 'Cyber', blurb: 'Capture the flag: decode, inspect, break in (legally).', tiers: [['basics', 'Basics'], ['ctf', 'Real CTFs']] },
];

export const TRACK_IDS = TRACKS.map((t) => t.id);
export const VERIFY = ['checkbox', 'answer', 'codeforces', 'internal'];
export const trackOf = (id) => TRACKS.find((t) => t.id === id);
export const tierIndex = (track, tier) => (trackOf(track)?.tiers.findIndex(([id]) => id === tier) ?? -1);

/**
 * The three placement questions. Answers are option indexes.
 * `focus` picks the track the Arena opens on.
 */
export const PLACEMENT = [
  { id: 'coded', q: 'Have you written code before?', options: ['Never', 'A little, in class or a tutorial', 'Yes, I am comfortable'] },
  { id: 'contest', q: 'Have you solved contest problems (USACO, Codeforces, UIL)?', options: ['No', 'A few', 'Yes, Bronze or harder'] },
  { id: 'focus', q: 'Which sounds most fun right now?', options: TRACKS.map((t) => t.name) },
];

/**
 * Answers -> the difficulty each track starts at, plus the focus track.
 * Out-of-range answers are clamped rather than rejected, so an old client
 * still gets a sensible board.
 */
export function placementFor(answers = {}) {
  const pick = (k, max) => Math.min(max, Math.max(0, Math.trunc(Number(answers[k]) || 0)));
  const coded = pick('coded', 2);
  const contest = pick('contest', 2);
  const focus = TRACKS[pick('focus', TRACKS.length - 1)].id;
  const start = {};
  for (const t of TRACK_IDS) start[t] = coded === 2 ? 2 : 1;
  start.contest = contest === 2 ? 3 : contest === 1 || coded === 2 ? 2 : 1;
  return { start, focus };
}

/** A track's rungs in ladder order: tier, then the officer's order. */
export function ladderOf(rungs, track) {
  return rungs
    .filter((r) => r.track === track && !r.hidden)
    .sort((a, b) => tierIndex(track, a.tier) - tierIndex(track, b.tier) || a.ord - b.ord || a.id - b.id);
}

const isDone = (progress, r) => progress[r.id]?.status === 'done';

/**
 * The suggested next rung: the first not-done rung at or after the starting
 * difficulty; once those are all done, the first skipped one; else null.
 */
export function nextRung(ladder, progress = {}, startLevel = 1) {
  let from = ladder.findIndex((r) => r.difficulty >= startLevel);
  if (from < 0) from = 0;
  return ladder.slice(from).find((r) => !isDone(progress, r)) ?? ladder.slice(0, from).find((r) => !isDone(progress, r)) ?? null;
}

/** Per-rung display state: done | next | skipped (below your start) | ahead. */
export function rungStates(ladder, progress = {}, startLevel = 1) {
  const next = nextRung(ladder, progress, startLevel);
  let from = ladder.findIndex((r) => r.difficulty >= startLevel);
  if (from < 0) from = 0;
  return Object.fromEntries(
    ladder.map((r, i) => [r.id, isDone(progress, r) ? 'done' : r === next ? 'next' : i < from ? 'skipped' : 'ahead'])
  );
}

/** How answers are compared: case, spacing and surrounding quotes do not matter. */
export const normAnswer = (s) => String(s ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLowerCase();

/**
 * USACO countdown (C5). The setting is one contest per line:
 * `2027-01-09 2027-01-12 First contest`. Returns the window in progress or
 * the next one, or null. Bad lines are skipped.
 */
export function parseContests(text, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const list = String(text || '')
    .split('\n')
    .map((l) => l.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/))
    .filter(Boolean)
    .map(([, start, end, name]) => ({ start, end, name: name.trim().slice(0, 60) }))
    .filter((c) => c.start <= c.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const c = list.find((x) => x.end >= today);
  if (!c) return null;
  const days = Math.round((Date.parse(c.start) - Date.parse(today)) / 86_400_000);
  return { ...c, live: c.start <= today, days: Math.max(0, days) };
}

/** A readable label for where a rung lives: "cses.fi", "club judge", "club course". */
export function hostOf(url) {
  if (url.startsWith('/p/')) return 'club judge';
  if (url.startsWith('/learn/')) return 'club course';
  if (url.startsWith('/')) return 'this site';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
