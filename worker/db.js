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

/**
 * Public puzzle list never leaks an unrevealed answer, even to a curious
 * network tab.
 *
 * Hints deliberately ARE sent for an unrevealed puzzle: their whole purpose is
 * to help someone who is stuck this week. Only the solution is withheld until
 * an officer reveals it.
 */
export async function getPuzzles(db) {
  const rows = await all(db, 'SELECT * FROM puzzles ORDER BY posted_at DESC, id DESC');
  return rows.map((p) => (p.revealed ? p : { ...p, answer: '' }));
}

/** The one puzzle flagged as this week's, or null. Same answer redaction. */
export async function getCurrentPuzzle(db) {
  const row = await first(
    db,
    'SELECT * FROM puzzles WHERE is_current = 1 ORDER BY posted_at DESC, id DESC LIMIT 1'
  );
  if (!row) return null;
  return row.revealed ? row : { ...row, answer: '' };
}

/** Exactly one puzzle is current; setting one clears the rest. */
export async function setCurrentPuzzle(db, id) {
  await db.batch([
    db.prepare('UPDATE puzzles SET is_current = 0 WHERE is_current = 1'),
    db.prepare('UPDATE puzzles SET is_current = 1 WHERE id = ?').bind(id),
  ]);
}

/* --------------------------------- members --------------------------------- */

export const getMemberById = (db, id) =>
  first(db, 'SELECT * FROM members WHERE id = ?', id);

export const getMemberByFeedToken = (db, token) =>
  first(db, 'SELECT * FROM members WHERE feed_token = ?', token);

export const listMembers = (db) =>
  all(
    db,
    `SELECT m.*, s.name AS student_name
     FROM members m LEFT JOIN students s ON s.id = m.student_id
     ORDER BY m.created_at DESC`
  );

/**
 * Finds or creates the member for a verified school email, and records the
 * login. Tokens are generated once, on first sight, and never rotated here --
 * rotating a feed token would silently break a subscribed calendar.
 */
export async function upsertMember(db, { school_email, full_name, tokenFactory }) {
  const email = String(school_email).trim().toLowerCase();
  const existing = await first(db, 'SELECT * FROM members WHERE school_email = ?', email);

  if (existing) {
    await run(db, "UPDATE members SET last_login_at = datetime('now') WHERE id = ?", existing.id);
    return { ...existing, last_login_at: new Date().toISOString() };
  }

  const info = await run(
    db,
    `INSERT INTO members (school_email, full_name, unsubscribe_token, feed_token, last_login_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    email,
    full_name ?? '',
    tokenFactory(),
    tokenFactory()
  );
  return getMemberById(db, info.meta?.last_row_id);
}

export function setMemberPrefs(db, id, { personal_email, email_opt_in }) {
  return run(
    db,
    'UPDATE members SET personal_email = ?, email_opt_in = ? WHERE id = ?',
    String(personal_email ?? '').trim(),
    email_opt_in ? 1 : 0,
    id
  );
}

export function unsubscribeByToken(db, token) {
  return run(db, 'UPDATE members SET email_opt_in = 0 WHERE unsubscribe_token = ?', token);
}

export const listDigestRecipients = (db) =>
  all(
    db,
    "SELECT * FROM members WHERE email_opt_in = 1 AND TRIM(personal_email) <> ''"
  );

/** Links a member to their leaderboard row, or clears the link with null. */
export function linkMemberToStudent(db, id, studentId) {
  return run(db, 'UPDATE members SET student_id = ? WHERE id = ?', studentId ?? null, id);
}

/* --------------------------------- digest ---------------------------------- */

/**
 * The three things the weekly email reports. All read from tables that already
 * exist -- the digest stores nothing of its own except the timestamp of the
 * last send, which lives in `settings`.
 */
/*
 * `since` is an ISO timestamp ("...T02:14:00.000Z") while the columns hold
 * SQLite's own "YYYY-MM-DD HH:MM:SS". A plain string comparison gets that
 * backwards -- a space sorts before "T", so every row would look older than
 * any ISO cutoff and the digest would always be empty. datetime() normalises
 * both sides before comparing.
 */
export const pointEventsSince = (db, since) =>
  all(
    db,
    `SELECT e.delta, e.reason, e.created_at, s.name
     FROM point_events e JOIN students s ON s.id = e.student_id
     WHERE e.created_at > datetime(?)
     ORDER BY e.created_at DESC`,
    since
  );

export const opportunitiesSince = (db, since) =>
  all(
    db,
    `SELECT id, title, url, type, deadline FROM opportunities
     WHERE status = 'live' AND created_at > datetime(?)
     ORDER BY created_at DESC`,
    since
  );

export const deadlinesWithin = (db, days) =>
  all(
    db,
    `SELECT id, title, url, deadline FROM opportunities
     WHERE status = 'live' AND deadline IS NOT NULL
       AND deadline >= date('now') AND deadline <= date('now', ?)
     ORDER BY deadline ASC`,
    `+${Number(days)} days`
  );

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
  // Members carry student email addresses. They are in the backup so a restore
  // is complete, which also means a downloaded backup file contains minors'
  // contact details -- keep it off shared drives.
  'members',
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
