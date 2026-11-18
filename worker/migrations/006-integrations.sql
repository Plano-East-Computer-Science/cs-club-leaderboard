-- Migration 006 (C4, D3): Codeforces link and GitHub repo stats.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/006-integrations.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/006-integrations.sql
--
-- Run it once. A rerun stops at the first ALTER with "duplicate column name",
-- which is harmless: the columns already exist (tables and index are created first).

CREATE TABLE IF NOT EXISTS cf_challenges (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle    TEXT    NOT NULL,
  issued_at INTEGER NOT NULL,
  tried_at  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cf_solves (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contest_id INTEGER NOT NULL,
  idx        TEXT    NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 0,
  solved_at  INTEGER NOT NULL,
  UNIQUE (user_id, contest_id, idx)
);
CREATE TABLE IF NOT EXISTS repo_stats (
  repo        TEXT PRIMARY KEY,
  stars       INTEGER NOT NULL DEFAULT 0,
  pushed_at   TEXT,
  language    TEXT,
  open_issues INTEGER NOT NULL DEFAULT 0,
  error       TEXT    NOT NULL DEFAULT '',
  checked_at  INTEGER NOT NULL DEFAULT 0
);

-- Codeforces rungs are confirmed by the sync now, not by the honour system.
UPDATE rungs SET verify = 'codeforces' WHERE verify = 'checkbox' AND url LIKE 'https://codeforces.com/%';

ALTER TABLE users ADD COLUMN cf_handle TEXT;
ALTER TABLE users ADD COLUMN cf_verified_at TEXT;
ALTER TABLE users ADD COLUMN cf_rating INTEGER;
ALTER TABLE users ADD COLUMN cf_synced_at INTEGER;
ALTER TABLE users ADD COLUMN cf_last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cf_handle ON users(lower(cf_handle)) WHERE cf_handle IS NOT NULL;
