-- Migration 008 (B1, B4, B6, B8, B10): meeting run-of-show, real check-in,
-- show artifacts, speaker takeaways, drop-in rooms.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/008-sessions.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/008-sessions.sql
--
-- Run it once. A second run stops at the first ALTER TABLE with "duplicate
-- column name", which is harmless: the columns are already there.
--
-- After this, closing a room pays attendance only to members who checked in
-- with the rotating token AND left an exit artifact. Rooms opened before the
-- migration have no exit artifacts recorded, so close them before migrating.

CREATE TABLE IF NOT EXISTS artifacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code  TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  url        TEXT    NOT NULL DEFAULT '',
  line       TEXT    NOT NULL,
  result     TEXT    NOT NULL DEFAULT '',
  kudos      INTEGER NOT NULL DEFAULT 0,
  shown      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_code, user_id)
);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON artifacts(user_id, created_at);

ALTER TABLE rooms ADD COLUMN kind TEXT NOT NULL DEFAULT 'meeting';
ALTER TABLE rooms ADD COLUMN template TEXT NOT NULL DEFAULT '';
ALTER TABLE rooms ADD COLUMN takeaways TEXT NOT NULL DEFAULT '';
ALTER TABLE room_checkins ADD COLUMN exit_kind TEXT;
ALTER TABLE room_checkins ADD COLUMN exit_note TEXT;
