/**
 * Ranks (A4): the one label a member carries, from their all-time points.
 *
 * There used to be two ladders (point tiers here and XP ranks in quests.js).
 * Now there is one ledger and two views of it: season points decide the
 * prize, and the rank below is the lifetime label on a portfolio. A rank is
 * read from a member's PEAK running total, so it never goes down, even if an
 * officer later removes or corrects an award.
 *
 * Thresholds are close together at the bottom so a new member moves up in
 * their first month, and spread out at the top so Legend stays rare. Colours
 * suit the dark terminal theme; crest artwork is indexed by position in
 * src/components/Crest.jsx.
 */
export const RANKS = [
  { id: 'newcomer', name: 'Newcomer', min: 0, color: '#a3a398', blurb: 'Just joined. Welcome.' },
  { id: 'contributor', name: 'Contributor', min: 25, color: '#3ecf7a', blurb: 'Showing up and pitching in.' },
  { id: 'builder', name: 'Builder', min: 75, color: '#2dd4bf', blurb: 'Shipping projects.' },
  { id: 'specialist', name: 'Specialist', min: 150, color: '#6b97ff', blurb: 'Competing and placing.' },
  { id: 'expert', name: 'Expert', min: 250, color: '#b093ff', blurb: 'Carrying the club.' },
  { id: 'master', name: 'Master', min: 400, color: '#ffc20e', blurb: 'Rare air.' },
  { id: 'legend', name: 'Legend', min: 600, color: '#ff6253', blurb: 'One of a kind.' },
];

/** Index into RANKS for a points total. */
export function rankIndex(points) {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (points >= r.min) i = k;
  });
  return i;
}

/** { rank: id, name, color, min, next } where next is the following rank or null. */
export function rankFor(points) {
  const i = rankIndex(points);
  return { rank: RANKS[i].id, name: RANKS[i].name, color: RANKS[i].color, min: RANKS[i].min, next: RANKS[i + 1] ?? null };
}

/** How far through the current rank, 0..1. Full at the top rank. */
export function rankProgress(points) {
  const i = rankIndex(points);
  const next = RANKS[i + 1];
  if (!next) return 1;
  return Math.min(1, Math.max(0, (points - RANKS[i].min) / (next.min - RANKS[i].min)));
}

/** Highest running total over a member's deltas in time order. Never below 0. */
export function peakOf(deltas) {
  let run = 0;
  let peak = 0;
  for (const d of deltas) {
    run += d;
    if (run > peak) peak = run;
  }
  return peak;
}
