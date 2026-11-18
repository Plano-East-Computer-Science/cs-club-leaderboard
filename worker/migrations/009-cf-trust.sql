-- Migration 009: Codeforces handles linked from the member's browser are untrusted.
--
--   npx wrangler d1 execute cs-club --local  --file worker/migrations/009-cf-trust.sql
--   npx wrangler d1 execute cs-club --remote --file worker/migrations/009-cf-trust.sql
--
-- Run it once. A rerun fails with "duplicate column name", which is harmless.
--
-- cf_trusted is 1 only when the club server itself saw the ownership challenge.
-- Handles linked through the browser fallback show their solves but earn no
-- points until the member verifies again while the server can reach Codeforces.
-- Existing links start untrusted; members can verify again from their account.

ALTER TABLE users ADD COLUMN cf_trusted INTEGER NOT NULL DEFAULT 0;
