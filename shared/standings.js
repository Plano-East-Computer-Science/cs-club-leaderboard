/**
 * Standings rules (A5, A6). Pure functions shared by the worker and tests:
 * season tiers, the "you and your neighbours" window, raffle tickets and the
 * draw, squad scores and the balanced-squad suggestion.
 *
 * Rows are leaderboard rows { id, name, points, place, ... } already sorted
 * by points, highest first, with tied points sharing a place.
 */

/** Season tiers: fixed thresholds of season points. Officers can change them. */
export const DEFAULT_TIERS = [60, 120, 200];
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

/** 1 to 5 whole numbers, strictly increasing, 1 to 10000. Returns { tiers } or { error }. */
export function cleanTiers(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5) return { error: 'Give between one and five tier thresholds.' };
  for (let i = 0; i < input.length; i++) {
    const v = input[i];
    if (!Number.isInteger(v) || v < 1 || v > 10000) return { error: 'Each threshold must be a whole number from 1 to 10000.' };
    if (i && v <= input[i - 1]) return { error: 'Thresholds must go up from left to right.' };
  }
  return { tiers: [...input] };
}

/** The saved `season_tiers` setting (JSON text), or the defaults if missing or bad. */
export function tiersFrom(saved) {
  try {
    return cleanTiers(JSON.parse(saved)).tiers ?? DEFAULT_TIERS;
  } catch {
    return DEFAULT_TIERS;
  }
}

/** Index of the highest tier reached, or -1 below the first. */
export function tierOf(points, tiers) {
  let i = -1;
  tiers.forEach((min, k) => {
    if (points >= min) i = k;
  });
  return i;
}

/** How many members sit in each tier: { below, tiers: [{ name, min, n }] }. */
export function tierCounts(rows, tiers) {
  const n = tiers.map(() => 0);
  let below = 0;
  for (const r of rows) {
    const t = tierOf(r.points, tiers);
    if (t < 0) below++;
    else n[t]++;
  }
  return { below, tiers: tiers.map((min, k) => ({ name: TIER_NAMES[k], min, n: n[k] })) };
}

/** Sorts by points (then name) and sets `place`; tied points share a place: 100, 100, 90 -> 1, 1, 3. */
export function placeRows(rows) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || String(a.name).localeCompare(String(b.name)));
  let last = null;
  let place = 0;
  return sorted.map((r, i) => {
    if (r.points !== last) place = i + 1;
    last = r.points;
    return { ...r, place };
  });
}

/** The member's row with up to `n` rows either side, in standings order. Empty if not found. */
export function neighbours(rows, id, n = 2) {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return [];
  return rows.slice(Math.max(0, i - n), i + n + 1);
}

/** Members at or above the first tier hold one ticket per season point. */
export function raffleTickets(rows, firstTier) {
  return rows.filter((r) => r.points >= firstTier && r.points > 0).map((r) => ({ id: r.id, name: r.name, tickets: r.points }));
}

/**
 * Picks the winner. `randInt(n)` must return a whole number in [0, n); the
 * worker passes a crypto-backed one, tests pass a fixed one. Ticket k belongs
 * to the entry whose running total first passes k.
 */
export function drawWinner(entries, randInt) {
  const total = entries.reduce((a, e) => a + e.tickets, 0);
  if (!total) return null;
  const k = randInt(total);
  let run = 0;
  for (const e of entries) {
    run += e.tickets;
    if (k < run) return { ...e, ticket: k, total };
  }
  return null;
}

/** Middle value; the mean of the middle two for an even count; 0 for none. */
export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Balanced squads by snake draft on lifetime points: the strongest member goes
 * to squad 1, the next to squad 2, ..., then the order reverses, so every
 * squad gets one member from each band of skill. Then, within each round,
 * two members swap squads whenever that lowers the number of pairs who were
 * squadded together last season (`pastPairs`, a Set of pairKey strings).
 * Members in one round are neighbours in skill, so balance holds.
 *   members: [{ id, lifetime }]  ->  [[id, ...], ...] (count arrays)
 */
export function suggestSquads(members, count, pastPairs = new Set()) {
  const k = Math.max(1, Math.min(count, members.length || 1));
  const squads = Array.from({ length: k }, () => []);
  const order = [...members].sort((a, b) => b.lifetime - a.lifetime || a.id - b.id);
  const clash = (id, s) => squads[s].filter((o) => pastPairs.has(pairKey(o, id))).length;
  for (let start = 0, round = 0; start < order.length; start += k, round++) {
    const slots = [...Array(k).keys()];
    if (round % 2) slots.reverse();
    const ids = order.slice(start, start + k).map((m) => m.id);
    const seat = ids.map((_, j) => slots[j]);
    // ponytail: pairwise swap until stable, O(k^2) per pass; plenty for a club of 40.
    for (let changed = true; changed; ) {
      changed = false;
      for (let a = 0; a < ids.length; a++)
        for (let b = a + 1; b < ids.length; b++) {
          const now = clash(ids[a], seat[a]) + clash(ids[b], seat[b]);
          if (clash(ids[a], seat[b]) + clash(ids[b], seat[a]) < now) {
            [seat[a], seat[b]] = [seat[b], seat[a]];
            changed = true;
          }
        }
    }
    ids.forEach((id, j) => squads[seat[j]].push(id));
  }
  return squads;
}
