/**
 * Daily problem rules (C3). Pure functions, shared by the worker and tests.
 *
 * One problem a day for everyone. The day flips at midnight in the club's
 * timezone, not UTC, so "today" means the same thing to a student at 11pm.
 */

export const CLUB_TZ = 'America/Chicago';
export const NO_REPEAT_DAYS = 30;
// Chain start for the deterministic pick. Fixed so every date resolves the same way.
const ANCHOR = '2026-01-01';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' of an instant on the club's wall clock. */
export const chicagoDate = (now = new Date()) => fmt.format(now);

/** Calendar arithmetic on date strings (UTC noon dodges DST entirely). */
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

// FNV-1a: tiny, stable across runtimes, plenty even for picking from a list.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Pick the problem for every date from ANCHOR through `date`, walking forward so
 * a problem is never repeated inside NO_REPEAT_DAYS when the pool allows it.
 * `pool` is [{ id, slug }] (live, difficulty 1-3); `pins` maps date -> problem id.
 * Returns the id for `date`, or null if the pool is empty and nothing is pinned.
 * ponytail: replays the chain on each call (a few hundred cheap steps); cache it if the pool grows huge.
 */
export function pickDaily(date, pool, pins = {}) {
  const sorted = [...pool].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const picks = []; // ids, oldest first
  let day = ANCHOR;
  let id = null;
  while (day <= date) {
    if (pins[day] != null) {
      id = pins[day];
    } else if (!sorted.length) {
      id = null;
    } else {
      const recent = new Set(picks.slice(-NO_REPEAT_DAYS));
      let free = sorted.filter((p) => !recent.has(p.id));
      // Pool smaller than the window: at least avoid yesterday's.
      if (!free.length) free = sorted.length > 1 ? sorted.filter((p) => p.id !== picks[picks.length - 1]) : sorted;
      id = free[hash(day) % free.length].id;
    }
    picks.push(id);
    day = addDays(day, 1);
  }
  return id;
}

/**
 * This week's count. `solvedDates` are the member's solved dates; `today` is
 * the club date. Each past day of the week with no solve is a miss; the first
 * miss is free.
 */
export function weeklyCount(solvedDates, today) {
  const start = weekStart(today);
  const set = new Set(solvedDates);
  let solved = 0;
  let misses = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (set.has(d)) solved++;
    else if (d < today) misses++;
  }
  return { solved, of: 7, misses, freeMissUsed: Math.min(1, misses), onTrack: misses <= 1 };
}

export const formatMs = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** The pasteable line. Colored squares live only in the copied text, never in the page. */
export function shareText({ date, attempts, ms, solved = true }) {
  const n = Math.min(Math.max(attempts, 1), 6);
  const squares = solved ? '⬛'.repeat(n - 1) + '🟩' : '⬛'.repeat(n);
  const tail = solved ? `${attempts} ${attempts === 1 ? 'try' : 'tries'} ${formatMs(ms)}` : 'not yet';
  return `PEHS daily ${date}  ${squares}  ${tail}`;
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
