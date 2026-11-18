/**
 * Ghost race maths (C7). Pure, shared by the page and the tests.
 *
 * A ghost is a recorded solve time. It "runs" at a steady pace: its bar is
 * elapsed / ghostMs, so it reaches the end exactly when the clubmate finished.
 */

/** 0..1 progress of a ghost that solved in ghostMs, after elapsedMs of your race. */
export function ghostProgress(elapsedMs, ghostMs) {
  if (!(ghostMs > 0)) return 0;
  return Math.min(1, Math.max(0, elapsedMs / ghostMs));
}

/** Beating the ghost means strictly faster; a tie goes to the ghost. */
export function raceResult(ms, ghostMs) {
  return { won: ms < ghostMs, diffMs: Math.abs(ms - ghostMs) };
}
