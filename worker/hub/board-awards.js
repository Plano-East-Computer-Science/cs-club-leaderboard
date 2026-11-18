/**
 * Board -> ledger (C1 to A2). Turns a finished rung into the activity the
 * ledger expects. Not wired yet: the orchestrator calls this from the done
 * routes in board.js once worker/hub/ledger.js exists.
 *
 * `progress` is a rung_progress row joined with its rung:
 *   { user_id, rung_id, status, method, track, tier, difficulty, verify }
 * Returns null for anything not done, so callers can pass every row.
 */
export function rungActivity(progress) {
  if (!progress || progress.status !== 'done' || !progress.user_id || !progress.rung_id) return null;
  return {
    userId: progress.user_id,
    kind: 'solve',
    // One award per member per rung, however often it is ticked and unticked.
    ref: `rung:${progress.rung_id}`,
    meta: {
      track: progress.track,
      tier: progress.tier,
      difficulty: progress.difficulty,
      method: progress.method,
      // Self-reported rungs are honour-system and fall under the solve cap.
      honour: progress.method === 'self',
    },
  };
}
