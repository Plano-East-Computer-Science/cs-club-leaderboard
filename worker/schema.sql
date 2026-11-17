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

/* ============================ club hub (accounts, learn, rooms, gateway, projects) ============================ */

-- Student accounts. Sign-in is a magic link sent to a PERSONAL address (the
-- district filters club mail to @mypisd.net). Nothing else is collected.
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT
);

-- One-time sign-in links. Single use, short-lived.
CREATE TABLE IF NOT EXISTS login_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,           -- ms since epoch
  used       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_email ON login_tokens(email, created_at);

-- Course content lives in shared/courses.js (versioned in git). This table
-- only records what each student has passed.
CREATE TABLE IF NOT EXISTS step_progress (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course    TEXT    NOT NULL,
  step      TEXT    NOT NULL,
  passed_at TEXT,
  attempts  INTEGER NOT NULL DEFAULT 0,
  code      TEXT    NOT NULL DEFAULT '',   -- last code submitted, so a reload keeps work
  PRIMARY KEY (user_id, course, step)
);

-- Live meeting rooms. The realtime state lives in a Durable Object; this row
-- is the durable record (and the code lookup).
CREATE TABLE IF NOT EXISTS rooms (
  code       TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at  TEXT
);
CREATE TABLE IF NOT EXISTS room_checkins (
  code      TEXT    NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (code, user_id)
);

-- Gateway access codes. An officer mints one for a meeting; it expires.
CREATE TABLE IF NOT EXISTS gateway_codes (
  code       TEXT PRIMARY KEY,
  label      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);
-- Minimal audit trail: which allowlisted host, when. No paths, no queries, no headers.
CREATE TABLE IF NOT EXISTS gateway_log (
  ts     INTEGER NOT NULL,
  code   TEXT    NOT NULL,
  host   TEXT    NOT NULL,
  status INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gwlog_code_ts ON gateway_log(code, ts);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  track       TEXT    NOT NULL DEFAULT '',
  repo_url    TEXT    NOT NULL DEFAULT '',
  demo_url    TEXT    NOT NULL DEFAULT '',
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- A student asks to connect their account to a leaderboard entry; an officer
-- approves (sets users.student_id) or rejects. One open request per account.
CREATE TABLE IF NOT EXISTS link_requests (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Ideas board: what members want the club to teach, build or host. Anyone can
-- read it; posting and voting need an account. Officers set the status.
CREATE TABLE IF NOT EXISTS ideas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'lesson',
  body       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open',   -- open | planned | done | hidden
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS idea_votes (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, user_id)
);

-- C2. Problem bank. One bank feeds duels, the daily problem, labs and contests.
-- `solution` never leaves the server except to officers (publicProblem strips it).
-- Judging runs in the browser, so `cases` ships with the problem.
CREATE TABLE IF NOT EXISTS problems (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL UNIQUE,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',          -- markdown
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  tags       TEXT    NOT NULL DEFAULT '',          -- comma list
  starter    TEXT    NOT NULL DEFAULT '',
  cases      TEXT    NOT NULL DEFAULT '[]',        -- JSON [{stdin, stdout}]
  solution   TEXT    NOT NULL DEFAULT '',
  source_url TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'draft',     -- draft | live | retired
  created_by TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status, difficulty);
