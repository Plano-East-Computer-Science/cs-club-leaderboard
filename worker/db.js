/**
 * Database layer (Cloudflare D1).
 *
 * D1 is SQLite, so every query below is the same SQL this project has always
 * used. The only real change from the original local-file version is that D1 is
 * asynchronous -- each helper returns a promise, so callers await it.
 *
 * Nothing outside this module knows where the data lives.
 * See LEARN-DATABASE.md for a plain-English tour.
 */

/* ------------------------------ small helpers ------------------------------ */

const all = async (db, sql, ...params) =>
  (await db.prepare(sql).bind(...params).all()).results ?? [];

const first = (db, sql, ...params) => db.prepare(sql).bind(...params).first();

const run = (db, sql, ...params) => db.prepare(sql).bind(...params).run();

/* ------------------------------- leaderboard ------------------------------- */

const LEADERBOARD_SQL = `
  SELECT s.id, s.name, s.grade, s.avatar_seed, s.joined_at,
         COALESCE(SUM(e.delta), 0) AS points,
         COUNT(e.id)               AS award_count,
         MAX(e.created_at)         AS last_award
  FROM students s
  LEFT JOIN point_events e ON e.student_id = s.id
  WHERE s.active = 1
  GROUP BY s.id
  ORDER BY points DESC, s.name ASC
`;

export async function getLeaderboard(db) {
  const rows = await all(db, LEADERBOARD_SQL);
  const badges = await getBadgesByStudent(db);
  // Ties share a rank: 100, 100, 90 -> ranks 1, 1, 3.
  let lastPoints = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const rank = row.points === lastPoints ? lastRank : i + 1;
    lastPoints = row.points;
    lastRank = rank;
    return { ...row, rank, badges: badges.get(row.id) ?? [] };
  });
}

export async function getBadgesByStudent(db) {
  const rows = await all(
    db,
    `SELECT sb.student_id, b.id, b.name, b.emoji, b.description, b.color, sb.awarded_at
     FROM student_badges sb JOIN badges b ON b.id = sb.badge_id
     ORDER BY sb.awarded_at DESC`
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.student_id)) map.set(r.student_id, []);
    map.get(r.student_id).push(r);
  }
  return map;
}

export async function getStudent(db, id) {
  // One leaderboard pass serves both the entry and the total -- the original
  // computed it twice, which on D1 would be a second network round trip.
  const board = await getLeaderboard(db);
  const entry = board.find((s) => s.id === Number(id));
  if (!entry) return null;
  const events = await all(
    db,
    `SELECT id, delta, reason, created_at FROM point_events
     WHERE student_id = ? ORDER BY created_at DESC, id DESC`,
    id
  );
  return { ...entry, events, total_students: board.length };
}

export async function addPointEvent(db, { student_id, delta, reason }) {
  const info = await run(
    db,
    'INSERT INTO point_events (student_id, delta, reason) VALUES (?, ?, ?)',
    student_id,
    Math.trunc(delta),
    reason ?? ''
  );
  return info.meta?.last_row_id;
}

/* ------------------------------ opportunities ------------------------------ */

export function listOpportunities(db, { status = 'live' } = {}) {
  return status === 'all'
    ? all(db, 'SELECT * FROM opportunities ORDER BY created_at DESC')
    : all(
        db,
        `SELECT * FROM opportunities WHERE status = ?
         ORDER BY (deadline IS NULL), deadline ASC, created_at DESC`,
        status
      );
}

/* ---------------------------- club info pages ---------------------------- */

export const getOfficers = (db) => all(db, 'SELECT * FROM officers ORDER BY sort_order, id');
export const getCurriculum = (db) => all(db, 'SELECT * FROM curriculum_topics ORDER BY track, sort_order, id');
export const getCompetitions = (db) => all(db, 'SELECT * FROM competitions ORDER BY sort_order, id');

/** Public puzzle list never leaks an unrevealed answer, even to a curious network tab. */
export async function getPuzzles(db) {
  const rows = await all(db, 'SELECT * FROM puzzles ORDER BY posted_at DESC, id DESC');
  return rows.map((p) => (p.revealed ? p : { ...p, answer: '' }));
}

/* --------------------------------- settings -------------------------------- */

export async function getSetting(db, key, fallback = '') {
  const row = await first(db, 'SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export function setSetting(db, key, value) {
  return run(
    db,
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    String(value)
  );
}

export async function getAllSettings(db) {
  const rows = await all(db, 'SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* ----------------------------- backup / restore ---------------------------- */

const BACKUP_TABLES = [
  'students',
  'point_events',
  'badges',
  'student_badges',
  'opportunities',
  'settings',
  'officers',
  'curriculum_topics',
  'competitions',
  'puzzles',
];

export async function exportBackup(db) {
  const data = {};
  for (const t of BACKUP_TABLES) data[t] = await all(db, `SELECT * FROM ${t}`);
  return { version: 1, exported_at: new Date().toISOString(), data };
}

/**
 * Replaces all data with the contents of a backup. Validates shape first so a
 * malformed upload cannot wipe a live database halfway through.
 *
 * D1 has no interactive transactions, so the work goes through db.batch(),
 * which Cloudflare runs as a single atomic transaction.
 */
export async function restoreBackup(db, backup) {
  if (!backup || typeof backup !== 'object' || !backup.data) {
    throw new Error('Not a valid backup file: missing "data".');
  }
  for (const t of BACKUP_TABLES) {
    if (!Array.isArray(backup.data[t])) {
      throw new Error(`Not a valid backup file: "${t}" is missing or not a list.`);
    }
  }

  const statements = [];
  for (const t of [...BACKUP_TABLES].reverse()) {
    statements.push(db.prepare(`DELETE FROM ${t}`));
  }
  for (const t of BACKUP_TABLES) {
    for (const row of backup.data[t]) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      statements.push(
        db
          .prepare(
            `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
          )
          .bind(...cols.map((c) => row[c]))
      );
    }
  }
  await db.batch(statements);
}

export { all, first, run };
