/**
 * Public display names (G5). Members are minors, so public pages show a first
 * name unless the member opted in to showing their full name. Officers still
 * see full names on officer screens.
 */
export const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'Member';

export const publicName = (name, showFull) => (showFull ? String(name ?? '').trim() || 'Member' : firstName(name));

/**
 * SQL for a leaderboard entry's public name. An entry linked to an account that
 * has not opted in shows its first word; unlinked entries (typed by officers)
 * keep the name officers gave them. `s` is the students alias.
 */
export const PUBLIC_NAME_SQL = `CASE
  WHEN EXISTS (SELECT 1 FROM users pu WHERE pu.student_id = s.id AND pu.show_full_name = 0 AND pu.deleted_at IS NULL)
   AND instr(trim(s.name), ' ') > 0
  THEN substr(trim(s.name), 1, instr(trim(s.name), ' ') - 1)
  ELSE s.name END`;
