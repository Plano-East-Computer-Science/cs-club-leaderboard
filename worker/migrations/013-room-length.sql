-- V3-A: templates come in 60 and 120 minute versions; a room remembers which
-- one the officer picked so its Durable Object builds the right run-of-show.
-- NULL (rooms opened before this) means the default, 120.
ALTER TABLE rooms ADD COLUMN minutes INTEGER;
