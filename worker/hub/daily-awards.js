/**
 * Maps a saved daily result to a ledger activity (C3). Kept free of any ledger
 * import: the orchestrator passes the return value to recordActivity once the
 * ledger lands (it resolves userId to studentId). `ref` is the date, so the
 * same day is never awarded twice.
 */
export function dailyActivity(result) {
  if (!result || !result.userId || !result.solvedAt || !/^\d{4}-\d{2}-\d{2}$/.test(result.date || '')) return null;
  return {
    userId: result.userId,
    kind: 'daily',
    ref: result.date,
    meta: { attempts: result.attempts ?? null, ms: result.ms ?? null },
  };
}
