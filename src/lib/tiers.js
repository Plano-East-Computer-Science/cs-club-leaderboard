/**
 * Rating tiers.
 *
 * Rank alone only gives three people something to chase. Tiers give everyone a
 * threshold in front of them: a member sitting in 11th place is still four
 * points from Builder, and that is a thing worth showing up for.
 *
 * Colours are tuned for the dark terminal theme (design E). Crest artwork
 * for each tier lives in components/Crest.jsx, indexed by position here.
 *
 * Thresholds are deliberately close together at the bottom so a new member
 * moves up quickly in their first month, and spread out at the top so Legend
 * stays rare.
 */
export const TIERS = [
  { name: 'Newcomer',    min: 0,   color: '#a3a398', blurb: 'Just joined. Welcome.' },
  { name: 'Contributor', min: 25,  color: '#3ecf7a', blurb: 'Showing up and pitching in.' },
  { name: 'Builder',     min: 75,  color: '#2dd4bf', blurb: 'Shipping projects.' },
  { name: 'Specialist',  min: 150, color: '#6b97ff', blurb: 'Competing and placing.' },
  { name: 'Expert',      min: 250, color: '#b093ff', blurb: 'Carrying the club.' },
  { name: 'Master',      min: 400, color: '#ffc20e', blurb: 'Rare air.' },
  { name: 'Legend',      min: 600, color: '#ff6253', blurb: 'One of a kind.' },
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

/** Index of a member's tier in TIERS. */
export function tierIndex(points) {
  return TIERS.indexOf(tierFor(points));
}
