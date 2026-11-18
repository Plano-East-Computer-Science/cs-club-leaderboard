-- Migration 009: Codeforces trust and revocable member sessions.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/009-trust.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/009-trust.sql
--
-- Run it once. A rerun fails with "duplicate column name", which is harmless.
--
-- cf_trusted is 1 only when the club server itself saw the Codeforces
-- ownership challenge. Handles linked through the browser fallback show their
-- solves but earn no points until the member verifies again while the server
-- can reach Codeforces. Existing links start untrusted.
--
-- session_ver is part of every member cookie. Signing out bumps it, which ends
-- every session of that account, including a cookie copied off a shared
-- computer. Existing cookies carry no version and read as 0, so nobody is
-- signed out by the migration itself.

ALTER TABLE users ADD COLUMN cf_trusted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0;
