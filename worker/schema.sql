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

-- Who runs the club. Shown on the About page.
CREATE TABLE IF NOT EXISTS officers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  role       TEXT    NOT NULL DEFAULT '',
  note       TEXT    NOT NULL DEFAULT '',
  committee  TEXT    NOT NULL DEFAULT 'main',  -- main | cyber
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- The Java curriculum roadmap. `covered` lets officers check off what has
-- actually been taught, so the page reflects the real year, not just the plan.
CREATE TABLE IF NOT EXISTS curriculum_topics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  track      TEXT    NOT NULL DEFAULT 'fall',  -- fall | spring
  title      TEXT    NOT NULL,
  covered    INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- The club's own competitions (UIL, HP CodeWars, Lockheed, ...) and results.
-- Distinct from `opportunities`, which is external programs a student applies
-- to individually -- these are the club's own team track record.
CREATE TABLE IF NOT EXISTS competitions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  result      TEXT    NOT NULL DEFAULT '',
  event_date  TEXT,
  url         TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'upcoming',  -- upcoming | past
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Archive of meeting-opener puzzles. `revealed` gates whether the answer is
-- shown -- an officer can post a puzzle for the current week with the answer
-- withheld, then reveal it once the meeting has happened.
CREATE TABLE IF NOT EXISTS puzzles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  prompt     TEXT    NOT NULL,
  answer     TEXT    NOT NULL DEFAULT '',
  source     TEXT    NOT NULL DEFAULT 'club',
  posted_at  TEXT    NOT NULL DEFAULT (date('now')),
  revealed   INTEGER NOT NULL DEFAULT 1,
  -- Problem of the Week. Hints are newline-separated and revealed one at a
  -- time; `revealed` still gates the full solution. Exactly one puzzle may be
  -- is_current at a time (the admin route clears the others when setting one).
  hints      TEXT    NOT NULL DEFAULT '',
  difficulty TEXT    NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0
);

-- Who gets the weekly club email.
--
-- Nobody signs in to this site, so a subscription is proven by email instead:
-- a row starts unconfirmed, and the address becomes a recipient only after its
-- owner clicks the link we sent it. That is what stops a stranger from signing
-- up someone else. The two tokens are random and independent, so neither can
-- be guessed from the other.
--
-- Addresses are personal (Gmail and the like), never @mypisd.net: the district
-- filters external senders to student accounts, so club mail would vanish.
CREATE TABLE IF NOT EXISTS subscribers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE,
  confirmed         INTEGER NOT NULL DEFAULT 0,
  confirm_token     TEXT    NOT NULL,
  unsubscribe_token TEXT    NOT NULL,
  confirm_sent_at   TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
