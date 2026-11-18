/**
 * Pair maker (B9). Splits people into pairs, with one trio when the count is
 * odd, and avoids putting the same two together twice in a row. Pure: the
 * room's Durable Object remembers last time's pairs and passes them in.
 *
 * Used for "pair the room" and by the duel block (B2) for teams and matches.
 */

/** Order-free key for two people (or two duel sides). */
export const pairKey = (a, b) => [String(a), String(b)].sort().join('|');

/** Every two-person key inside each group: a trio gives three. */
export function groupKeys(groups) {
  const keys = [];
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) keys.push(pairKey(g[i], g[j]));
  return keys;
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attempt(ids, { mode, levels, squads, avoid, rng }) {
  // Shuffle first so ties (same level, same squad) break differently each time.
  const order = shuffle(ids, rng);
  if (mode === 'mixed') order.sort((a, b) => (levels[b] ?? 0) - (levels[a] ?? 0));
  if (mode === 'squad') order.sort((a, b) => String(squads[a] ?? '').localeCompare(String(squads[b] ?? '')));

  const groups = [];
  const left = [...order];
  while (left.length > 1) {
    const a = left.shift();
    // Mixed: strongest left with weakest left. Otherwise the next in order (same squad, or random).
    const prefs = mode === 'mixed' ? [...left].reverse() : left;
    const b = prefs.find((x) => !avoid.has(pairKey(a, x))) ?? prefs[0];
    left.splice(left.indexOf(b), 1);
    groups.push([a, b]);
  }
  if (left.length) {
    const x = left[0];
    // The odd one out joins the pair it has met least.
    const clash = (g) => g.filter((y) => avoid.has(pairKey(x, y))).length;
    const g = groups.reduce((best, g) => (best && clash(best) <= clash(g) ? best : g), null);
    if (g) g.push(x);
    else groups.push([x]);
  }
  return groups;
}

/**
 * ids: people to pair. mode: 'random' | 'mixed' | 'squad'.
 * levels: id -> number, for mixed. squads: id -> squad, for squad.
 * Squads do not exist yet (A5); with no map, 'squad' behaves like 'random'.
 * avoid: keys from groupKeys() of last time.
 * Returns groups of 2 (one of 3 when odd, [x] when only one person).
 */
export function makePairs(ids, { mode = 'random', levels = {}, squads = {}, avoid = [], rng = Math.random } = {}) {
  const people = [...new Set(ids.map(String))];
  const opts = { mode, levels, squads, avoid: new Set(avoid), rng };
  let best = null;
  let bestRepeats = Infinity;
  // Greedy can paint itself into a corner; a few reshuffles almost always find a clean set.
  for (let i = 0; i < 20 && bestRepeats > 0; i++) {
    const groups = attempt(people, opts);
    const repeats = groupKeys(groups).filter((k) => opts.avoid.has(k)).length;
    if (repeats < bestRepeats) [best, bestRepeats] = [groups, repeats];
  }
  return best;
}
