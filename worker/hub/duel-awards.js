/**
 * Duel results -> ledger activities (B2). Pure, and called by nothing yet:
 * the ledger (A2) is built in parallel and the orchestrator wires this to
 * recordActivity. `ref` makes each award idempotent per (student, kind, ref),
 * so re-running a room's results never pays twice.
 *
 * results: duel_results rows ({ room_code, round, division, user_id, slug, attempts, solved_ms, won }).
 * Participation needs at least one submitted attempt; a win needs `won`.
 */
export function duelActivities(results) {
  const out = [];
  for (const r of results ?? []) {
    if (!(Number(r.attempts) > 0)) continue; // sitting in a match without trying earns nothing
    const meta = { room: r.room_code, round: r.round, division: r.division, slug: r.slug, solvedMs: r.solved_ms ?? null };
    out.push({ userId: r.user_id, kind: 'duel', ref: `duel:${r.room_code}:${r.round}`, meta: { ...meta, result: 'played' } });
    if (Number(r.won) === 1 || r.won === true) {
      out.push({ userId: r.user_id, kind: 'duel', ref: `duel-win:${r.room_code}:${r.round}`, meta: { ...meta, result: 'win' } });
    }
  }
  return out;
}
