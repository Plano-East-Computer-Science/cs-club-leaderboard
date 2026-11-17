-- Migration 004 (A7): officer accounts and roles.
--
-- Adds users.role (member | officer | lead) and the officer_log audit table.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/004-roles.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/004-roles.sql
--
-- Run it once. A second run fails on the ALTER TABLE with "duplicate column
-- name: role", which is harmless: the table already has the column.
--
-- Afterwards nobody is an officer yet. Sign in at /officer with the shared
-- password (break-glass acts as lead) and use Team to make the first lead.

-- The table first, so a rerun that stops at the ALTER still has it.
CREATE TABLE IF NOT EXISTS officer_log (
  ts              INTEGER NOT NULL,
  officer_user_id INTEGER,
  officer_name    TEXT    NOT NULL,
  action          TEXT    NOT NULL,
  detail          TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_officer_log_ts ON officer_log(ts);

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
