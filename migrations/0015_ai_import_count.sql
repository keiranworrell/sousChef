-- Counts AI imports a user has spent, so free users can have a few rather than
-- none at all.
--
-- The three AI import routes were gated with a flat premium check, which meant a
-- free user hit a 402 on the flagship feature without ever seeing it work. The
-- agreed pricing gives them five lifetime imports, and that needs somewhere to
-- record how many they have used.
--
-- Lifetime, not monthly: there is no reset job, and adding one would mean a
-- scheduled task whose failure silently denies people credits they are owed. A
-- single monotonic counter has no such failure mode.
--
-- Existing users start at 0. Anyone who was already premium is unaffected
-- either way, since premium is not counted against.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_import_count INTEGER NOT NULL DEFAULT 0;

-- The count is only ever incremented and only ever compared against a small
-- constant, so a negative value could only come from a bug. Catch it at the
-- boundary rather than discovering it as a free user with unlimited credits.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_ai_import_count_non_negative;

ALTER TABLE users
  ADD CONSTRAINT users_ai_import_count_non_negative
  CHECK (ai_import_count >= 0);
