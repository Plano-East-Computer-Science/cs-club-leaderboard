-- Database schema.
--
-- This is the SAME SQLite schema the project has always used. Cloudflare D1 is
-- SQLite, so nothing here had to be rewritten when we moved off a local file.
--
-- Applied with:  npx wrangler d1 execute cs-club --remote --file worker/schema.sql
-- See DEPLOY.md.

CREATE TABLE IF NOT EXISTS students (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  grade       INTEGER,
  avatar_seed TEXT    NOT NULL DEFAULT '',
  joined_at   TEXT    NOT NULL DEFAULT (date('now')),
  active      INTEGER NOT NULL DEFAULT 1
);

-- Append-only log. A student's total is the SUM of their deltas.
-- We never store a running total, so a mistake is fixed by deleting one row.
CREATE TABLE IF NOT EXISTS point_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_student ON point_events(student_id);

CREATE TABLE IF NOT EXISTS badges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  emoji       TEXT    NOT NULL DEFAULT '🏅',
  description TEXT    NOT NULL DEFAULT '',
  color       TEXT    NOT NULL DEFAULT 'violet'
);

CREATE TABLE IF NOT EXISTS student_badges (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  badge_id   INTEGER NOT NULL REFERENCES badges(id)   ON DELETE CASCADE,
  awarded_at TEXT    NOT NULL DEFAULT (date('now')),
  PRIMARY KEY (student_id, badge_id)
);

CREATE TABLE IF NOT EXISTS opportunities (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  org          TEXT    NOT NULL DEFAULT '',
  description  TEXT    NOT NULL DEFAULT '',
  url          TEXT    NOT NULL DEFAULT '',
  type         TEXT    NOT NULL DEFAULT 'program',
  deadline     TEXT,
  cost         TEXT    NOT NULL DEFAULT 'free',
  format       TEXT    NOT NULL DEFAULT 'online',  -- online | local | residential
  location     TEXT    NOT NULL DEFAULT '',
  lat          REAL,
  lng          REAL,
  distance_mi  REAL,
  age_min      INTEGER NOT NULL DEFAULT 14,
  age_max      INTEGER NOT NULL DEFAULT 17,
  source       TEXT    NOT NULL DEFAULT 'manual',
  status       TEXT    NOT NULL DEFAULT 'live',
  needs_review INTEGER NOT NULL DEFAULT 0,
  fingerprint  TEXT    UNIQUE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_opps_status ON opportunities(status);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
