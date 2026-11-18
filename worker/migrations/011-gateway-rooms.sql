-- H1: each meeting room gets its own gateway code, limited to the presets the
-- host turns on. Run before worker/schema.sql on an existing database (the
-- index in schema.sql needs room_code).
ALTER TABLE gateway_codes ADD COLUMN room_code TEXT;
ALTER TABLE gateway_codes ADD COLUMN presets TEXT;
