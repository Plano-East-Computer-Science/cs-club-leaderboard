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
  last_seen  TEXT,
  role       TEXT    NOT NULL DEFAULT 'member',  -- member | officer | lead (A7)
  -- E1 compass: the answers (JSON), the path they lead to, and when it was
  -- answered or skipped. compass_at NULL means Today sends them to /compass once.
  compass    TEXT,
  path       TEXT,                               -- contest | builder | ai | data | cyber | explorer
  compass_at TEXT,
  cf_handle     TEXT,                           -- C4: verified Codeforces handle
  cf_verified_at TEXT,
  cf_trusted     INTEGER NOT NULL DEFAULT 0,      -- 1 only when the club server saw the challenge
  session_ver    INTEGER NOT NULL DEFAULT 0,      -- bumped on sign-out; ends every session of the account
  cf_rating      INTEGER,
  cf_synced_at   INTEGER,                        -- ms, last sync attempt (round-robin order)
  cf_last_error  TEXT,
  -- G5: full name on public pages is opt-in; deletion is soft (deleted_at) and
  -- purged later; keep_history is the member's choice about their points.
  show_full_name INTEGER NOT NULL DEFAULT 0,
  deleted_at     TEXT,
  keep_history   INTEGER NOT NULL DEFAULT 0
);

-- One-time sign-in links. Single use, short-lived.
CREATE TABLE IF NOT EXISTS login_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,           -- ms since epoch
  used       INTEGER NOT NULL DEFAULT 0,
  code_hash  TEXT,                       -- keyed hash of the 6-digit code in the same email
  tries      INTEGER NOT NULL DEFAULT 0  -- wrong code guesses; the code dies at CODE_TRIES
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
  closed_at  TEXT,
  kind       TEXT NOT NULL DEFAULT 'meeting',  -- B10: meeting | dropin
  template   TEXT NOT NULL DEFAULT '',         -- B1: shared/session-templates.js id
  takeaways  TEXT NOT NULL DEFAULT '',         -- B8: the speaker block's takeaways pad
  minutes    INTEGER                           -- V3-A: 60 or 120, which length of the template (migration 013); NULL = 60
);
-- A row exists only for a check-in with a current rotating token (B4). Every row is
-- paid attendance when the room closes; exit_kind set (the member did one thing that
-- counts) adds the `active` bonus (V3-A).
CREATE TABLE IF NOT EXISTS room_checkins (
  code      TEXT    NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
  exit_kind TEXT,                                -- poll | lab | duel | contest | show | help | note
  exit_note TEXT,                                -- the one-line "what I did", when given
  PRIMARY KEY (code, user_id)
);

-- Gateway access codes. An officer mints one for a meeting; it expires.
CREATE TABLE IF NOT EXISTS gateway_codes (
  code       TEXT PRIMARY KEY,
  label      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  room_code  TEXT,                                 -- H1: set for a meeting room's own code
  presets    TEXT                                  -- H1: JSON preset ids; NULL = the whole approved list
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

/* ================================ A7: officer accounts and roles ================================ */

-- Who did what as an officer. officer_user_id is NULL for the shared
-- break-glass password, which is logged as 'shared login'.
CREATE TABLE IF NOT EXISTS officer_log (
  ts              INTEGER NOT NULL,          -- ms since epoch
  officer_user_id INTEGER,
  officer_name    TEXT    NOT NULL,
  action          TEXT    NOT NULL,          -- login | role | write
  detail          TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_officer_log_ts ON officer_log(ts);
/* ============================ A2/A3: activity ledger and claims ============================ */

-- One row per thing a member did. Points come from the rules in
-- shared/points.js, never typed in: approving a row writes exactly one
-- point_events row and records its id here, so every automatic award traces
-- back to its activity. (student_id, kind, ref) is unique, which makes
-- recording idempotent: closing the same room twice cannot pay twice.
CREATE TABLE IF NOT EXISTS activity (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL,                   -- KINDS in shared/points.js
  ref            TEXT    NOT NULL,                   -- e.g. room:ABCD, opp:12, comp:3
  meta           TEXT    NOT NULL DEFAULT '{}',      -- JSON: title, proof_url, note, ...
  status         TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  points         INTEGER NOT NULL DEFAULT 0,
  point_event_id INTEGER,                            -- no FK: a backup restores point_events on its own
  decided_by     INTEGER,                            -- officer's users.id, NULL for the shared login
  decided_name   TEXT,
  decided_at     TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  hidden         INTEGER NOT NULL DEFAULT 0,                -- G5: an officer hid it from the public feed
  UNIQUE (student_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS idx_activity_status ON activity(status, decided_at);

-- "I'm doing this" on an opportunity; the dashboard later asks "did you compete?".
CREATE TABLE IF NOT EXISTS opportunity_interest (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, opportunity_id)
);
-- C3. Daily problem. A pin overrides the deterministic pick for one date;
-- a result is saved once per member per day (first solve wins).
CREATE TABLE IF NOT EXISTS daily_pins (
  date       TEXT    PRIMARY KEY,                  -- YYYY-MM-DD, club timezone
  problem_id INTEGER NOT NULL REFERENCES problems(id)
);
CREATE TABLE IF NOT EXISTS daily_results (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      TEXT    NOT NULL,
  attempts  INTEGER NOT NULL,
  solved_at TEXT    NOT NULL DEFAULT (datetime('now')),
  ms        INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_results_date ON daily_results(date);
-- C1. The Board: ladders of rungs per track, most pointing at outside sites.
-- `answer_hash` is SHA-256 of the normalised answer and never leaves the server.
CREATE TABLE IF NOT EXISTS rungs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  track       TEXT    NOT NULL,                     -- contest | build | ai | data | cyber
  tier        TEXT    NOT NULL,                     -- per track, see shared/board.js
  ord         INTEGER NOT NULL DEFAULT 0,           -- order within the tier
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,                     -- https://... or /p/<slug> or /learn/<course>
  hint        TEXT    NOT NULL DEFAULT '',
  difficulty  INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  tags        TEXT    NOT NULL DEFAULT '',
  verify      TEXT    NOT NULL DEFAULT 'checkbox',  -- checkbox | answer | codeforces | internal
  answer_hash TEXT    NOT NULL DEFAULT '',
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (track, url)
);
CREATE INDEX IF NOT EXISTS idx_rungs_track ON rungs(track, tier, ord);

CREATE TABLE IF NOT EXISTS rung_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rung_id INTEGER NOT NULL REFERENCES rungs(id) ON DELETE CASCADE,
  status  TEXT    NOT NULL DEFAULT 'started',       -- started | done
  done_at TEXT,
  method  TEXT    NOT NULL DEFAULT '',              -- self | answer | judge | codeforces
  PRIMARY KEY (user_id, rung_id)
);

-- Where the placement questions dropped a member: starting difficulty per track.
CREATE TABLE IF NOT EXISTS board_placement (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers    TEXT NOT NULL DEFAULT '{}',
  start      TEXT NOT NULL DEFAULT '{}',            -- JSON { track: difficulty }
  focus      TEXT NOT NULL DEFAULT 'contest',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- B2. Duel results, written by the room's Durable Object as each round ends.
-- `code` is the last submitted code, kept so officers can spot-check honour-system
-- judging; it is never shown on the projector or to other students.
CREATE TABLE IF NOT EXISTS duel_results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code  TEXT    NOT NULL,
  round      INTEGER NOT NULL,
  division   TEXT    NOT NULL,                     -- new | comfortable | contest
  match_no   INTEGER NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT    NOT NULL,                     -- problems.slug
  attempts   INTEGER NOT NULL DEFAULT 0,
  solved_ms  INTEGER,                              -- null when not solved
  won        INTEGER NOT NULL DEFAULT 0,
  code       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_code, round, user_id)
);
CREATE INDEX IF NOT EXISTS idx_duel_results_slug ON duel_results(slug, solved_ms);

/* ================================ F2: kudos on the club feed ================================ */

-- One tap of recognition on an approved activity. Worth no points; the
-- primary key makes a second tap a no-op.
CREATE TABLE IF NOT EXISTS kudos (
  activity_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, user_id)
);

-- C4. Codeforces link. A pending ownership challenge per member (issued_at in ms),
-- and the problems a verified handle has solved.
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
  solved_at  INTEGER NOT NULL,                  -- unix seconds
  UNIQUE (user_id, contest_id, idx)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cf_handle ON users(lower(cf_handle)) WHERE cf_handle IS NOT NULL;

-- D3. Cached GitHub repo stats, refreshed by the hourly cron at most every 6 hours per repo.
CREATE TABLE IF NOT EXISTS repo_stats (
  repo        TEXT PRIMARY KEY,                 -- lowercase owner/name
  stars       INTEGER NOT NULL DEFAULT 0,
  pushed_at   TEXT,
  language    TEXT,
  open_issues INTEGER NOT NULL DEFAULT 0,
  error       TEXT    NOT NULL DEFAULT '',
  checked_at  INTEGER NOT NULL DEFAULT 0        -- ms
);

/* ============================ A5: squads ============================ */

-- Mixed-skill groups of 4-6, assigned by officers and reshuffled each season.
-- A squad's score is the MEDIAN member's season points, computed on read, so
-- helping the weakest member is the winning move.
CREATE TABLE IF NOT EXISTS squads (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT    NOT NULL,                     -- "2026-fall", see shared/points.js
  name   TEXT    NOT NULL,
  color  TEXT    NOT NULL DEFAULT '#ffc20e'
);
CREATE INDEX IF NOT EXISTS idx_squads_season ON squads(season);
-- One squad per member per season: (student_id, season) is the key.
CREATE TABLE IF NOT EXISTS squad_members (
  squad_id   INTEGER NOT NULL REFERENCES squads(id)   ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  season     TEXT    NOT NULL,
  PRIMARY KEY (student_id, season)
);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);

/* ============================ A6: season raffle ============================ */

-- Every draw is kept, redraws included, so a result can be audited: who won,
-- with how many of how many tickets, who drew it and why a redraw happened.
CREATE TABLE IF NOT EXISTS raffle_draws (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  season        TEXT    NOT NULL,
  student_id    INTEGER NOT NULL,                -- no FK: the record outlives a deleted member
  student_name  TEXT    NOT NULL,
  tickets       INTEGER NOT NULL,                -- the winner's tickets
  total_tickets INTEGER NOT NULL,
  entrants      INTEGER NOT NULL,
  reason        TEXT    NOT NULL DEFAULT '',     -- required for a redraw
  drawn_by      INTEGER,                         -- officer's users.id, NULL for the shared login
  drawn_name    TEXT    NOT NULL,
  drawn_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_raffle_season ON raffle_draws(season, id);

/* ============================ G5 safety and privacy, E7 verified record ============================ */

-- Sliding-window rate limits (sign-in, officer password, reports, verify lookups).
CREATE TABLE IF NOT EXISTS rate_hits (
  key TEXT    NOT NULL,
  ts  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits ON rate_hits(key, ts);

-- A member flags someone's content. Officers hide it or dismiss the report.
-- kind: idea | project | feed (feed = an activity id).
CREATE TABLE IF NOT EXISTS reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind             TEXT    NOT NULL,
  target_id        INTEGER NOT NULL,
  reason           TEXT    NOT NULL DEFAULT '',
  status           TEXT    NOT NULL DEFAULT 'open',   -- open | hidden | dismissed
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_name     TEXT,
  decided_at       TEXT,
  UNIQUE (reporter_user_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

-- E7: random, unguessable codes an officer issues for a member's verified
-- record. Revoking sets revoked_at; a revoked code answers like an unknown one.
CREATE TABLE IF NOT EXISTS record_codes (
  code           TEXT PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by_name TEXT    NOT NULL,
  created_at     INTEGER NOT NULL,
  revoked_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_record_codes_user ON record_codes(user_id);
-- D1. Ship cycles: a themed run of a few weeks. Members enter with a project and a
-- one-line pitch, post devlogs, demo on the last meeting, vote, and shipped projects
-- earn a ship activity when an officer closes the cycle.
CREATE TABLE IF NOT EXISTS cycles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL UNIQUE,
  title      TEXT    NOT NULL,
  theme      TEXT    NOT NULL DEFAULT '',
  rubric     TEXT    NOT NULL DEFAULT '',
  starts_on  TEXT,                                   -- YYYY-MM-DD
  demo_on    TEXT,                                   -- YYYY-MM-DD
  status     TEXT    NOT NULL DEFAULT 'draft',       -- draft | open | demo | closed
  idea_id    INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cycle_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id   INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pitch      TEXT    NOT NULL,
  demoed     INTEGER NOT NULL DEFAULT 0,             -- an officer ticks this at the demo
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cycle_id, project_id)
);
-- The team, owner included. cycle_id is repeated so one person is on one entry per cycle.
CREATE TABLE IF NOT EXISTS cycle_members (
  entry_id INTEGER NOT NULL REFERENCES cycle_entries(id) ON DELETE CASCADE,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_owner INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, user_id),
  UNIQUE (cycle_id, user_id)
);
CREATE TABLE IF NOT EXISTS devlogs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   INTEGER NOT NULL REFERENCES cycle_entries(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  url        TEXT    NOT NULL DEFAULT '',            -- optional https link or image
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devlogs_entry ON devlogs(entry_id, id);
CREATE TABLE IF NOT EXISTS cycle_votes (
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES cycle_entries(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT    NOT NULL DEFAULT 'best',
  PRIMARY KEY (cycle_id, user_id, category)
);

-- D4. "Looking for a teammate" posts, on a ship cycle or an opportunity.
CREATE TABLE IF NOT EXISTS team_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL,                      -- cycle | opp
  target_id   INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  skills      TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'open',       -- open | closed
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_team_posts_target ON team_posts(target_type, target_id, status);

/* ================================ E4: competition pages ================================ */
-- Members sign up for a competition; results fill in `participated` and `placement`.
CREATE TABLE IF NOT EXISTS competition_roster (
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  participated   INTEGER NOT NULL DEFAULT 0,
  placement      INTEGER,                              -- NULL = did not place
  PRIMARY KEY (competition_id, user_id)
);
-- Prep plan: Arena rungs and bank problems an officer picked, in order.
CREATE TABLE IF NOT EXISTS competition_prep (
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN ('rung', 'problem')),
  ref_id         INTEGER NOT NULL,                     -- rungs.id or problems.id
  ord            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (competition_id, kind, ref_id)
);
-- B6. Show-block artifacts: a link or a result from the meeting, plus one line.
-- One per member per room; they appear on the member's portfolio. No points:
-- attendance already pays for the meeting.
CREATE TABLE IF NOT EXISTS artifacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code  TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,                   -- link | lab | duel
  url        TEXT    NOT NULL DEFAULT '',        -- https only, for kind link
  line       TEXT    NOT NULL,
  result     TEXT    NOT NULL DEFAULT '',        -- "Passed 3 checkpoints in ...", for lab and duel
  kudos      INTEGER NOT NULL DEFAULT 0,
  shown      INTEGER NOT NULL DEFAULT 0,         -- put on the projector by the host
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_code, user_id)
);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON artifacts(user_id, created_at);

/* ================================ D2: workspace ================================ */
-- A member's own multi-file projects, saved to the account. Limits (files,
-- bytes, workspaces per member) are checked in shared/workspace.js.
CREATE TABLE IF NOT EXISTS workspaces (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  kind       TEXT    NOT NULL,                      -- python | web
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id, updated_at);
CREATE TABLE IF NOT EXISTS workspace_files (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  path         TEXT    NOT NULL,
  content      TEXT    NOT NULL,
  PRIMARY KEY (workspace_id, path)
);

/* ================================ C11: CTF board ================================ */
-- Challenges are inline text (no live servers). Only the SHA-256 of the normalised
-- flag is stored and it never leaves the Worker. Member-written ones start
-- 'pending' and need an officer other than the author; starters have no author.
CREATE TABLE IF NOT EXISTS ctf_challenges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  title          TEXT    NOT NULL,
  category       TEXT    NOT NULL,              -- crypto | web | forensics | reversing | misc
  difficulty     INTEGER NOT NULL DEFAULT 1,   -- 1-3
  points         INTEGER NOT NULL DEFAULT 50,   -- scoreboard points, from difficulty
  body           TEXT    NOT NULL DEFAULT '',
  file_name      TEXT    NOT NULL DEFAULT '',
  file_data      TEXT    NOT NULL DEFAULT '',
  hint           TEXT    NOT NULL DEFAULT '',
  flag_hash      TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending',  -- pending | live | rejected | retired
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name    TEXT    NOT NULL DEFAULT '',
  decided_name   TEXT,
  decided_at     TEXT,
  reject_reason  TEXT    NOT NULL DEFAULT '',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ctf_status ON ctf_challenges(status, category);
CREATE TABLE IF NOT EXISTS ctf_solves (
  challenge_id INTEGER NOT NULL REFERENCES ctf_challenges(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  solved_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ctf_solves_user ON ctf_solves(user_id);

/* ================================ C12: data arena ================================ */
-- A challenge is a dataset plus hidden answers. answers_csv is read only by the
-- scorer; no route returns it. Submissions keep scores, not the uploaded files.
CREATE TABLE IF NOT EXISTS data_challenges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  summary     TEXT    NOT NULL DEFAULT '',
  metric      TEXT    NOT NULL,                       -- accuracy | rmse | mae
  id_col      TEXT    NOT NULL,
  target_col  TEXT    NOT NULL,
  train_csv   TEXT    NOT NULL,
  test_csv    TEXT    NOT NULL,
  answers_csv TEXT    NOT NULL,
  rows        INTEGER NOT NULL DEFAULT 0,             -- rows to predict
  status      TEXT    NOT NULL DEFAULT 'open',        -- open | closed (closed shows final scores)
  created_by  TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS data_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES data_challenges(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_score REAL    NOT NULL,
  final_score  REAL    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_data_sub ON data_submissions(challenge_id, user_id);


-- G1. Meeting planner. Planned sessions belong to the club, not a member, so
-- account export and deletion do not touch them. room_code is set when a room
-- is opened for the plan: that is what "held" means. blocks is a JSON list that
-- goes through cleanBlocks (shared/session-templates.js) on every write.
CREATE TABLE IF NOT EXISTS planned_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,                       -- YYYY-MM-DD
  title      TEXT    NOT NULL,
  template   TEXT    NOT NULL,                       -- shared/session-templates.js id
  blocks     TEXT    NOT NULL DEFAULT '[]',
  idea_id    INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  room_code  TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planned_date ON planned_sessions(date);

/* ================================ C6: editorials by members ================================ */
-- A member's honour-system solve of a bank problem (daily, problem page). Duel
-- solves live in duel_results; editorial access and ghost times read both.
CREATE TABLE IF NOT EXISTS problem_solves (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug      TEXT    NOT NULL,
  ms        INTEGER NOT NULL,
  solved_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_problem_solves_slug ON problem_solves(slug);

-- One short explanation per member per problem. Readers see only 'accepted' ones;
-- 'hidden' is a report an officer upheld.
CREATE TABLE IF NOT EXISTS editorials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL,
  code         TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'pending',   -- pending | accepted | rejected | hidden
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_name TEXT,
  decided_at   TEXT,
  UNIQUE (slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_editorials_slug ON editorials(slug, status);

/* ================================ C7: ghost races ================================ */
-- Your own race history. The ghost is stored as a first name and a time, never an id or code.
CREATE TABLE IF NOT EXISTS ghost_races (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT    NOT NULL,
  ghost_name TEXT    NOT NULL,                       -- first name, or 'the club median'
  ghost_ms   INTEGER NOT NULL,
  ms         INTEGER NOT NULL,
  won        INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ghost_races_user ON ghost_races(user_id, id);

/* ================================ B5: mock contest attempts ================================ */

-- Every judged attempt in a team contest, with the submitted code, so officers
-- can spot-check. Judging happens in the browser (honour system, like duels).
-- No points are paid from here: attendance is the only ledger effect.
CREATE TABLE IF NOT EXISTS contest_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code  TEXT    NOT NULL,
  team_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT    NOT NULL,                     -- problems.slug
  ok         INTEGER NOT NULL DEFAULT 0,
  ms         INTEGER NOT NULL,                     -- since the contest started, by the server clock
  code       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contest_attempts_room ON contest_attempts(room_code, team_id);
CREATE INDEX IF NOT EXISTS idx_contest_attempts_user ON contest_attempts(user_id);

/* ================================ H1: room gateway codes ================================ */
CREATE INDEX IF NOT EXISTS idx_gateway_codes_room ON gateway_codes(room_code);

/* ================================ D5: code review requests ================================ */
-- A request points at a public GitHub repo, or carries a read-only copy of one workspace file
-- (snapshot, taken at request time and wiped when the request closes). Reviews hold their comments
-- as JSON [{ line, text }]. Accepting a review ("helpful") is the asker's call and pays `mentor`.
CREATE TABLE IF NOT EXISTS review_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,                       -- repo | file
  repo_url   TEXT    NOT NULL DEFAULT '',
  file_name  TEXT    NOT NULL DEFAULT '',
  snapshot   TEXT    NOT NULL DEFAULT '',
  ask        TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open',        -- open | closed | hidden
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_requests_open ON review_requests(status, id);
CREATE INDEX IF NOT EXISTS idx_review_requests_user ON review_requests(user_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- the reviewer
  comments    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'posted',     -- posted | accepted | hidden
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  UNIQUE (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, status);
/* ============================ D6: portfolio v2 ============================ */

-- A portfolio is private until its owner turns it on: a row here means public.
-- Members are minors, so the default is "nobody but you".
CREATE TABLE IF NOT EXISTS portfolio_public (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
-- One sentence from an officer, shown on the member's portfolio with the
-- officer's name and the date. officer_id is NULL for the shared login.
CREATE TABLE IF NOT EXISTS portfolio_signoffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line         TEXT    NOT NULL,
  officer_id   INTEGER,
  officer_name TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_portfolio_signoffs_user ON portfolio_signoffs(user_id);

/* ============================ G4: handoff ============================ */

-- A member's officer application for one school year (shared/handoff.js
-- schoolYearOf). Private to the member and officers. One per member per year;
-- the member may edit it while it is still 'new' and the window is open.
CREATE TABLE IF NOT EXISTS officer_applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year         TEXT    NOT NULL,
  answers      TEXT    NOT NULL DEFAULT '{}',   -- JSON keyed by QUESTIONS ids
  status       TEXT    NOT NULL DEFAULT 'new',  -- new | accepted | declined
  note         TEXT    NOT NULL DEFAULT '',     -- the officers' note, not shown to the member
  decided_name TEXT,
  decided_at   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, year)
);
CREATE INDEX IF NOT EXISTS idx_officer_apps_year ON officer_applications(year, status);
-- The short written summary an officer adds to a year's archive page.
CREATE TABLE IF NOT EXISTS year_summaries (
  year       TEXT PRIMARY KEY,
  body       TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);


/* ================================ C15: research track ================================ */
-- The latest row is the current paper of the month. Officers write it; the link is https only.
CREATE TABLE IF NOT EXISTS research_papers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  why        TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- A short annotation: a quote or section reference plus a comment. Reportable (kind paper_note).
CREATE TABLE IF NOT EXISTS paper_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id   INTEGER NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote      TEXT NOT NULL DEFAULT '',
  comment    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'posted',   -- posted | hidden
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_paper_notes_paper ON paper_notes(paper_id, status);
-- One science-fair project card per member. Private to the member and officers.
CREATE TABLE IF NOT EXISTS science_projects (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  question   TEXT NOT NULL DEFAULT '',
  mentor     TEXT NOT NULL DEFAULT '',
  data_plan  TEXT NOT NULL DEFAULT '',
  writeup    TEXT NOT NULL DEFAULT '',
  deadline   TEXT,                              -- YYYY-MM-DD
  stage      TEXT NOT NULL DEFAULT 'question',  -- question | mentor | data | writeup | done
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ================================ E6: alumni and mentors ================================ */
-- Graduates are adults and members are minors: `contact` is for officers only and is
-- never selected by a member route. Members send a question through the club instead.
CREATE TABLE IF NOT EXISTS alumni (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  grad_year  INTEGER,
  doing      TEXT NOT NULL DEFAULT '',
  topics     TEXT NOT NULL DEFAULT '',
  contact    TEXT NOT NULL DEFAULT '',          -- officers only
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- A member's question for a graduate. Officers read it and forward it by hand.
CREATE TABLE IF NOT EXISTS alumni_questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alumni_id  INTEGER NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',       -- new | forwarded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alumni_q_status ON alumni_questions(status, created_at);
/* ================================ E5: pathways ================================ */
-- Pathway content lives in shared/pathways.js. These hold only what a member
-- chose: which pathways they follow (at most two) and the steps they ticked by
-- hand. Steps the data already proves (a rung done, a cycle shipped) are
-- worked out on read, never stored. Ticks are private and earn no points.
CREATE TABLE IF NOT EXISTS pathway_follows (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway    TEXT    NOT NULL,                       -- PATHWAYS id
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, pathway)
);
CREATE TABLE IF NOT EXISTS pathway_ticks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway    TEXT    NOT NULL,
  step       TEXT    NOT NULL,                       -- step id within the pathway
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, pathway, step)
);


/* ================================ C14: quant sandbox ================================ */
-- A round of the trading game on synthetic prices. The seed re-creates the series
-- (shared/quant.js); no route shows it until the round closes, so the future stays
-- hidden. `week` is set on the automatic weekly round and keeps it to one per week.
CREATE TABLE IF NOT EXISTS quant_rounds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  seed       INTEGER NOT NULL,
  days       INTEGER NOT NULL DEFAULT 60,        -- played days, a multiple of step
  step       INTEGER NOT NULL DEFAULT 5,         -- days each decision holds
  short_cap  REAL NOT NULL DEFAULT 0,            -- 0 = no shorting, else the largest short
  status     TEXT NOT NULL DEFAULT 'open',       -- open | closed
  closes_at  INTEGER NOT NULL,                   -- ms; past it the round counts as closed
  week       TEXT UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'weekly',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- One member's decisions in a round. The score columns are computed by the server
-- from the seed; nothing a browser reports about returns is stored. No points.
CREATE TABLE IF NOT EXISTS quant_entries (
  round_id     INTEGER NOT NULL REFERENCES quant_rounds(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  positions    TEXT NOT NULL DEFAULT '[]',       -- JSON, one number per step
  score        REAL,
  sharpe       REAL,
  max_drawdown REAL,
  total_return REAL,
  ranked       INTEGER NOT NULL DEFAULT 0,
  finished_at  TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, user_id)
);

/* ================================ V3-B: problem sets ================================ */
-- Duel packs and contest sets: a fixed choice of bank problems that a meeting
-- block runs in one tap. Owned by worker/hub/sets.js.
-- Duel body:    { practice, new: [3 slugs], comfortable: [3], contest: [3], final }
-- Contest body: { problems: [slug, ...] } in play order
CREATE TABLE IF NOT EXISTS problem_sets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL UNIQUE,
  kind       TEXT    NOT NULL CHECK (kind IN ('duel', 'contest')),
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '{}',        -- JSON, shape set by kind
  status     TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_by TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ============================ Wave 6: speaker questions, early ============================ */
-- Members ask (and upvote) questions for a planned speaker night on Today,
-- from openEarlyHours before the meeting until its room opens. The room's
-- Durable Object loads them, with their votes, when it opens. Anonymous to
-- members; officers see who asked. Reports go to the reports table as kind
-- 'question'. Owned by worker/hub/live.js.
CREATE TABLE IF NOT EXISTS early_questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL REFERENCES planned_sessions(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0,             -- an officer hid it
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_early_questions_plan ON early_questions(plan_id);
CREATE TABLE IF NOT EXISTS early_question_marks (
  question_id INTEGER NOT NULL REFERENCES early_questions(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL DEFAULT 'up' CHECK (kind IN ('up')),
  PRIMARY KEY (question_id, user_id, kind)
);
