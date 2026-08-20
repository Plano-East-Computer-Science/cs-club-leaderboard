/**
 * Rating tiers.
 *
 * Rank alone only gives three people something to chase. Tiers give everyone a
 * threshold in front of them: a member sitting in 11th place is still four
 * points from Builder, and that is a thing worth showing up for.
 *
 * Thresholds are deliberately close together at the bottom so a new member
 * moves up quickly in their first month, and spread out at the top so Legend
 * stays rare.
 */
export const TIERS = [
  { name: 'Newcomer',    min: 0,   color: '#6b7689', blurb: 'Just joined. Welcome.' },
  { name: 'Contributor', min: 25,  color: '#2f8f5b', blurb: 'Showing up and pitching in.' },
  { name: 'Builder',     min: 75,  color: '#128c93', blurb: 'Shipping projects.' },
  { name: 'Specialist',  min: 150, color: '#2b5fd9', blurb: 'Competing and placing.' },
  { name: 'Expert',      min: 250, color: '#6e3bd1', blurb: 'Carrying the club.' },
  { name: 'Master',      min: 400, color: '#b8720e', blurb: 'Rare air.' },
  { name: 'Legend',      min: 600, color: '#c42e2e', blurb: 'One of a kind.' },
];

export function tierFor(points) {
  let current = TIERS[0];
  for (const t of TIERS) if (points >= t.min) current = t;
  return current;
}

export function nextTier(points) {
  return TIERS.find((t) => t.min > points) ?? null;
}

/** How far through the current tier a member is, 0..1. Full bar at the top tier. */
export function tierProgress(points) {
  const current = tierFor(points);
  const next = nextTier(points);
  if (!next) return 1;
  return Math.min(1, Math.max(0, (points - current.min) / (next.min - current.min)));
}
