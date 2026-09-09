-- Tracks whether a recipe with an external source has been edited since it
-- arrived, so attribution can read "Adapted from" rather than "Imported from".
--
-- A derived check (updated_at > created_at) would be wrong: updated_at is also
-- bumped by changes that aren't edits to the recipe's content — adding a recipe
-- to a public collection flips is_public and touches the timestamp, which would
-- mark an untouched recipe as adapted.
--
-- Defaults to false. Existing imported recipes will therefore read as "Imported
-- from" until their next edit, which is the safer of the two wrong answers:
-- understating adaptation credits the original source more, not less.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_modified boolean NOT NULL DEFAULT false;
