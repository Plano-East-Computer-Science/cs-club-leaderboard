/**
 * Point rules (A2). Pure functions only, so the worker and the tests share
 * one definition of what an activity is worth.
 *
 * A rule is { points, approval, perDay, perWeek, perSeason, seasonPoints,
 * firstDoubled }. Counts (perX) limit how many activities of that kind earn
 * points; seasonPoints limits the total points of that kind in a season.
 * Officers override any field through the `point_rules` setting, which is
 * merged over these defaults by rulesFrom().
 *
 * Seasons are semesters: fall is June through December, spring is January
 * through May. June and July have no meetings, so anything logged then
 * (a summer competition, say) counts toward the coming fall. Day, week and
 * season boundaries are UTC; club meetings are afternoons in Texas, which is
 * the same UTC day, so this only matters for activity logged near midnight.
 */

export const KINDS = ['attend', 'compete', 'place', 'ship', 'mentor', 'solve', 'idea', 'daily', 'duel', 'dropin', 'manual', 'quest'];

/** Kinds a member can claim for themselves, pending officer approval. */
export const CLAIM_KINDS = ['compete', 'place', 'ship'];

export const POINT_RULES = {
  attend: { points: 10, perDay: 1, firstDoubled: 3 },
  compete: { points: 15, perSeason: 4, approval: true },
  place: { points: 25, seasonPoints: 50, approval: true },
  ship: { points: 30, perSeason: 2, approval: true },
  mentor: { points: 15, approval: true },
  solve: { points: 1, perWeek: 10 },
  // Honour-system items stay small and capped so they cannot decide the prize.
  idea: { points: 2, perSeason: 5 },
  daily: { points: 2, perWeek: 5 },
  duel: { points: 2, perWeek: 5 },
  // A4: quests are bonus rules on the ledger. Each quest pays once (ref is the
  // quest id) and the season total is capped, since lessons are honour-system.
  quest: { points: 3, seasonPoints: 15 },
  // B10: a Panther Pause drop-in is a smaller attendance, kept separate from meetings.
  dropin: { points: 5, perWeek: 2 },
  // An officer's one-off award: the amount comes from meta.points.
  manual: { points: 0, approval: true },
};

const NUM_FIELDS = ['points', 'perDay', 'perWeek', 'perSeason', 'seasonPoints', 'firstDoubled'];

/** Date, ms number, ISO string or SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to a Date. */
export function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  const s = String(v ?? '');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !s.includes(' ') ? s : `${s.replace(' ', 'T')}Z`);
}

/** SQLite's datetime('now') format, so stored times sort and compare as text. */
export const sqlTime = (v) => toDate(v).toISOString().slice(0, 19).replace('T', ' ');

/** "2026-fall" or "2027-spring". See the header for why June and July are fall. */
export function seasonOf(v) {
  const d = toDate(v);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() <= 4 ? 'spring' : 'fall'}`;
}

/**
 * [start, end) of a season as SQLite UTC text, so a season filter is a plain
 * string comparison on created_at. 'all' spans everything.
 */
export function seasonRange(key) {
  if (key === 'all') return { start: '0000-01-01 00:00:00', end: '9999-12-31 23:59:59' };
  const [y, half] = String(key).split('-');
  const year = Number(y);
  if (!Number.isInteger(year) || (half !== 'fall' && half !== 'spring')) return null;
  return half === 'spring'
    ? { start: `${year}-01-01 00:00:00`, end: `${year}-06-01 00:00:00` }
    : { start: `${year}-06-01 00:00:00`, end: `${year + 1}-01-01 00:00:00` };
}

/** The season before this one: 2026-fall -> 2026-spring -> 2025-fall. */
export function prevSeason(key) {
  const [y, half] = String(key).split('-');
  return half === 'fall' ? `${y}-spring` : `${Number(y) - 1}-fall`;
}

/** "2026-fall" -> "Fall 2026". */
export const seasonLabel = (key) =>
  key === 'all' ? 'All time' : key.replace(/^(\d+)-(\w)(\w+)$/, (_, y, a, b) => `${a.toUpperCase()}${b} ${y}`);

const dayKey = (v) => toDate(v).toISOString().slice(0, 10);
// Weeks start Monday. Day 0 of the epoch was a Thursday, hence the +3.
const weekKey = (v) => Math.floor((Math.floor(toDate(v).getTime() / 86400000) + 3) / 7);

/**
 * Points for one new activity.
 *   history: the student's earlier APPROVED activities, [{ kind, at, points }]
 *   at:      when the new activity happened
 * Returns 0 once a cap is reached, never a negative number (except manual).
 */
export function pointsFor(kind, meta = {}, history = [], rules = POINT_RULES, at = new Date()) {
  const r = rules[kind];
  if (!r) return 0;
  if (kind === 'manual') return Math.trunc(Number(meta?.points) || 0);

  const same = history.filter((h) => h.kind === kind);
  const season = seasonOf(at);
  const inSeason = same.filter((h) => seasonOf(h.at) === season);

  if (r.perDay && same.filter((h) => dayKey(h.at) === dayKey(at)).length >= r.perDay) return 0;
  if (r.perWeek && same.filter((h) => weekKey(h.at) === weekKey(at)).length >= r.perWeek) return 0;
  if (r.perSeason && inSeason.length >= r.perSeason) return 0;

  let pts = r.points || 0;
  // "First three meetings double" is lifetime, a welcome for new members.
  if (r.firstDoubled && same.filter((h) => h.points > 0).length < r.firstDoubled) pts *= 2;
  if (r.seasonPoints != null) {
    const used = inSeason.reduce((n, h) => n + (h.points || 0), 0);
    pts = Math.max(0, Math.min(pts, r.seasonPoints - used));
  }
  return pts;
}

/**
 * Validates an officer's override object. Returns { rules } (only known kinds
 * and fields, whole numbers 0-1000, approval as a boolean) or { error }.
 */
export function cleanRules(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Rules must be a JSON object keyed by kind.' };
  const out = {};
  for (const [kind, rule] of Object.entries(input)) {
    if (!KINDS.includes(kind)) return { error: `Unknown kind "${kind}".` };
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return { error: `The rule for ${kind} must be an object.` };
    out[kind] = {};
    for (const [field, v] of Object.entries(rule)) {
      if (field === 'approval') {
        if (typeof v !== 'boolean') return { error: `${kind}.approval must be true or false.` };
        out[kind].approval = v;
      } else if (NUM_FIELDS.includes(field)) {
        if (v === null) { out[kind][field] = null; continue; }
        if (!Number.isInteger(v) || v < 0 || v > 1000) return { error: `${kind}.${field} must be a whole number from 0 to 1000.` };
        out[kind][field] = v;
      } else {
        return { error: `Unknown field "${field}" on ${kind}.` };
      }
    }
  }
  return { rules: out };
}

/** Defaults with the saved `point_rules` setting (JSON text) merged over them. Bad JSON falls back to defaults. */
export function rulesFrom(saved) {
  let parsed = {};
  try {
    parsed = cleanRules(typeof saved === 'string' ? JSON.parse(saved) : saved ?? {}).rules ?? {};
  } catch {
    parsed = {};
  }
  return Object.fromEntries(KINDS.map((k) => [k, { ...POINT_RULES[k], ...parsed[k] }]));
}
