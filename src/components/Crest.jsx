import { TIERS } from '../lib/tiers.js';

const D = { fill: '#0c0c0a' };
const S = {
  fill: 'none',
  stroke: '#0c0c0a',
  strokeWidth: 3,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
};

/** One SVG crest per tier, in TIERS order. */
const CRESTS = [
  <>
    <path d="M32 6 54 14V32C54 44 44 54 32 59 20 54 10 44 10 32V14Z" />
    <path {...S} d="M22 29 32 38 42 29" />
  </>,
  <>
    <path d="M10 14 24 9 32 15 40 9 54 14V32C54 44 44 54 32 59 20 54 10 44 10 32Z" />
    <path {...S} d="M22 25 32 33 42 25M22 35 32 43 42 35" />
  </>,
  <>
    <path d="M32 3 56 17V43L32 61 8 43V17Z" />
    <path {...S} strokeWidth={2} d="M32 11 49 21V40L32 52 15 40V21Z" />
    <path {...S} d="M26 25 19 32 26 39M38 25 45 32 38 39" />
  </>,
  <>
    <path d="M32 4 50 11 58 6 56 28C55 42 44 53 32 61 20 53 9 42 8 28L6 6 14 11Z" />
    <path {...D} d="M32 17 36.5 28 48 32 36.5 36 32 47 27.5 36 16 32 27.5 28Z" />
  </>,
  <>
    <path d="M32 2 38 9 52 7 58 15 54 34C52 46 42 56 32 62 22 56 12 46 10 34L6 15 12 7 26 9Z" />
    <path {...D} d="M32 16 44 32 32 50 20 32Z" />
    <path d="M32 25 37 32 32 39 27 32Z" />
  </>,
  <>
    <path d="M32 1 37 8 45 3 46 12 57 10 58 21 63 25 56 33C54 47 44 57 32 63 20 57 10 47 8 33L1 25 6 21 7 10 18 12 19 3 27 8Z" />
    <path {...S} strokeWidth={2} d="M32 11 50 18V33C50 43 42 51 32 56 22 51 14 43 14 33V18Z" />
    <path {...D} d="M32 18 35.6 27 45 27.6 37.8 33.7 40.2 43 32 38 23.8 43 26.2 33.7 19 27.6 28.4 27Z" />
  </>,
  <>
    <path d="M12 18 4 2 21 9 28 3 32 8 36 3 43 9 60 2 52 18 62 28 55 38C52 50 43 58 32 63 21 58 12 50 9 38L2 28Z" />
    <path {...D} d="M20 17C32 29 29 41 22 52 38 42 40 28 28 17ZM33 14C46 28 42 42 35 55 50 44 50 28 40 14ZM11 28C20 36 18 44 14 50 24 44 24 34 16 26Z" />
  </>,
];

/** Tier crest. `i` is the index into TIERS, `cls` is "cr" (large) or "cs" (inline small). */
export function Crest({ i, cls = '' }) {
  const c = TIERS[i].color;
  return (
    <svg className={`crest ${cls}`} viewBox="0 0 64 64" style={{ '--c': c }} fill={c} aria-hidden="true">
      {CRESTS[i]}
    </svg>
  );
}
