-- Turns cook history from a bare timestamp into a cooking journal.
--
-- Logging a cook previously recorded only "this happened", which is enough to
-- drive rediscover but tells the user nothing when they come back to a recipe
-- six months later. Rating and notes are the two things people actually want to
-- remember: whether it was any good, and what they'd change next time.
--
-- Both are nullable. An existing row has no rating and no notes, and that is a
-- legitimate state rather than missing data — a quick "I cooked this" log should
-- stay a single tap.
--
-- The rating range is enforced in the database as well as in Zod. Validation at
-- the edge is the first line, not the only one: a bad rating written by a future
-- code path is a value that can never be displayed correctly and can never be
-- distinguished from a real one after the fact.
ALTER TABLE cook_history
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE cook_history
  DROP CONSTRAINT IF EXISTS cook_history_rating_range;

ALTER TABLE cook_history
  ADD CONSTRAINT cook_history_rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- The recipe page reads one user's log for one recipe on every view, which is
-- the only new access pattern here and the only one without an index.
CREATE INDEX IF NOT EXISTS cook_history_user_recipe_cooked_at_idx
  ON cook_history (user_id, recipe_id, cooked_at DESC);
