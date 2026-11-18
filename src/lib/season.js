/**
 * Season dates and timestamp helpers for charts and the countdown.
 *
 * A4: a season is a semester, defined once in shared/points.js (points from
 * June to December count toward fall, January to May toward spring; the
 * "season day" counter starts on August 1 for fall) so the page and the ledger agree
 * on which points count. `key` picks a season; 'all' starts at `since`
 * (usually the first award) and runs to now.
 */
import { seasonOf as seasonKey, seasonRange } from '../../shared/points.js';

const DAY = 86_400_000;

/** SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; a bare date is local noon. */
export function parseTs(s) {
  if (!s) return null;
  const d = s.length <= 10 ? new Date(`${s}T12:00:00`) : new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function seasonOf(_settings = {}, now = new Date(), key = seasonKey(now), since = null) {
  const r = seasonRange(key) ?? seasonRange(seasonKey(now));
  // `since` (the first award) trims empty summer weeks off the front of a chart.
  const from = parseTs(r.start);
  const start = key === 'all' ? (since ?? new Date(now.getTime() - 120 * DAY)) : since && since > from ? since : from;
  const end = key === 'all' ? now : parseTs(r.end);
  const at = Math.min(now, end);
  // The day counter follows the school calendar (fall starts in August, per the
  // club's decision) even though summer points count toward fall.
  const [, half] = String(key).split('-');
  const termStart = key === 'all' ? start : half === 'fall' ? new Date(from.getFullYear(), 7, 1) : from;
  const day = Math.max(1, Math.floor((at - termStart) / DAY) + 1);
  return { key, start, end, day, today: Math.max(1, Math.floor((at - start) / DAY)), label: key === 'all' ? 'all-time' : key };
}

/** Whole days between the season start and a timestamp (can be negative). */
export const dayOf = (season, ts) => Math.floor((ts - season.start) / DAY);

export const shortDate = (season, day) => {
  const d = new Date(season.start.getTime() + day * DAY);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
