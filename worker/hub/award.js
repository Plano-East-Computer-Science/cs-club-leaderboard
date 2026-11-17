/**
 * Glue between features and the ledger. Features describe what a member did
 * as `{ userId, kind, ref, meta }` (see daily-awards.js, duel-awards.js,
 * board-awards.js); this resolves the account to its leaderboard entry and
 * records it. Points must never break the feature that earned them, so a
 * ledger failure is logged, not thrown.
 */
import { recordActivity } from './ledger.js';

export async function awardFromUser(db, user, act) {
  if (!act) return null;
  const studentId = user?.student_id ?? (await db.prepare('SELECT student_id FROM users WHERE id = ?').bind(act.userId).first())?.student_id;
  if (!Number.isInteger(studentId)) return null; // account not on the leaderboard yet
  try {
    return await recordActivity(db, { studentId, kind: act.kind, ref: act.ref, meta: act.meta });
  } catch (err) {
    console.error('[award]', act.kind, act.ref, err?.message ?? err);
    return null;
  }
}
