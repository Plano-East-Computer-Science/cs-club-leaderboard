/**
 * Lifetime ranks for the browser. The definitions live in shared/ranks.js
 * (A4) so the worker and the pages read one list; these names stay because
 * the crest and badge components index by them.
 */
import { RANKS, rankIndex, rankProgress } from '../../shared/ranks.js';

export const TIERS = RANKS;
export const tierIndex = rankIndex;
export const tierProgress = rankProgress;
export const tierFor = (points) => RANKS[rankIndex(points)];
export const nextTier = (points) => RANKS[rankIndex(points) + 1] ?? null;
