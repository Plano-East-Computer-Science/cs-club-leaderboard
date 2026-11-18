-- Migration 005 (E1, F2): the onboarding compass and feed kudos.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/005-compass.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/005-compass.sql
--
-- Run it once. A rerun fails on the first ALTER TABLE with "duplicate column
-- name", which is harmless: the columns are already there.

-- The table first, so a rerun that stops at an ALTER still has it.
CREATE TABLE IF NOT EXISTS kudos (
  activity_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, user_id)
);

ALTER TABLE users ADD COLUMN compass TEXT;
ALTER TABLE users ADD COLUMN path TEXT;
ALTER TABLE users ADD COLUMN compass_at TEXT;
