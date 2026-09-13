-- Migration 002: email subscriptions without sign-in.
--
-- The district blocks third-party Google sign-in for student accounts, so the
-- members table from migration 001 is gone and the weekly email is driven by
-- a plain confirmed-by-email subscriber list instead.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/002-subscribers.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/002-subscribers.sql
--
-- Safe to run more than once. If 001 was never run on this database, run it
-- first -- the Problem of the Week columns it adds are still needed.

DROP TABLE IF EXISTS members;

CREATE TABLE IF NOT EXISTS subscribers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE,
  confirmed         INTEGER NOT NULL DEFAULT 0,
  confirm_token     TEXT    NOT NULL,
  unsubscribe_token TEXT    NOT NULL,
  confirm_sent_at   TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
