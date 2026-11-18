-- Sign-in codes: the sign-in email carries a 6-digit code next to the link, so a
-- member can finish on the device they started on. The code is stored only as a
-- keyed hash, and `tries` caps wrong guesses. Run before worker/schema.sql on an
-- existing database.
ALTER TABLE login_tokens ADD COLUMN code_hash TEXT;
ALTER TABLE login_tokens ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;
