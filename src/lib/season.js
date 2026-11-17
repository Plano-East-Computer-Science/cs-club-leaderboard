/**
 * Season dates and timestamp helpers.
 *
 * A season is the school year. Officers can pin exact dates with the
 * `season_start` / `season_end` settings (YYYY-MM-DD); without them the season
 * runs Aug 24 to May 31 of the current school year.
 */

const DAY = 86_400_000;

/** SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; a bare date is local noon. */
export function parseTs(s) {
  if (!s) return null;
  const d = s.length <= 10 ? new Date(`${s}T12:00:00`) : new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const parseDate = (s) => {
  const d = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export function seasonOf(settings = {}, now = new Date()) {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const start = parseDate(settings.season_start) ?? new Date(y, 7, 24);
  const end = parseDate(settings.season_end) ?? new Date(y + 1, 4, 31, 23, 59, 59);
  const day = Math.max(1, Math.floor((now - start) / DAY) + 1);
  return { start, end, day, today: Math.max(1, Math.floor((now - start) / DAY)), label: `season-${String(start.getFullYear()).slice(2)}` };
}

/** Whole days between the season start and a timestamp (can be negative). */
export const dayOf = (season, ts) => Math.floor((ts - season.start) / DAY);

export const shortDate = (season, day) => {
  const d = new Date(season.start.getTime() + day * DAY);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
