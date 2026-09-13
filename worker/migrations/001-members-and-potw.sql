-- Migration 001: member sign-in, and Problem of the Week columns.
--
-- RUN ONCE per database. schema.sql already describes the end state, but
-- CREATE TABLE IF NOT EXISTS cannot add columns to the puzzles table that
-- already exists in production, so those columns are added here.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running this file errors with
-- "duplicate column name". That is harmless and means it already ran.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/001-members-and-potw.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/001-members-and-potw.sql
--
-- Take a backup from the admin panel before running this against production.

ALTER TABLE puzzles ADD COLUMN hints      TEXT    NOT NULL DEFAULT '';
ALTER TABLE puzzles ADD COLUMN difficulty TEXT    NOT NULL DEFAULT '';
ALTER TABLE puzzles ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS members (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  school_email      TEXT    NOT NULL UNIQUE,
  student_id        INTEGER REFERENCES students(id) ON DELETE SET NULL,
  full_name         TEXT    NOT NULL DEFAULT '',
  personal_email    TEXT    NOT NULL DEFAULT '',
  email_opt_in      INTEGER NOT NULL DEFAULT 0,
  unsubscribe_token TEXT    NOT NULL,
  feed_token        TEXT    NOT NULL,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_members_feed ON members(feed_token);
