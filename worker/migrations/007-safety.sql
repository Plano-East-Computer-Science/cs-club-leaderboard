-- Migration 007 (G5 safety and privacy, E7 verified record).
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/007-safety.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/007-safety.sql
--
-- Run it once. A rerun fails on the first ALTER TABLE with "duplicate column
-- name", which is harmless: the columns are already there.

-- Tables first, so a rerun that stops at an ALTER still has them.
CREATE TABLE IF NOT EXISTS rate_hits (
  key TEXT    NOT NULL,
  ts  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits ON rate_hits(key, ts);

CREATE TABLE IF NOT EXISTS reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind             TEXT    NOT NULL,
  target_id        INTEGER NOT NULL,
  reason           TEXT    NOT NULL DEFAULT '',
  status           TEXT    NOT NULL DEFAULT 'open',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_name     TEXT,
  decided_at       TEXT,
  UNIQUE (reporter_user_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS record_codes (
  code           TEXT PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by_name TEXT    NOT NULL,
  created_at     INTEGER NOT NULL,
  revoked_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_record_codes_user ON record_codes(user_id);

ALTER TABLE users ADD COLUMN show_full_name INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN keep_history INTEGER NOT NULL DEFAULT 0;
ALTER TABLE activity ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
