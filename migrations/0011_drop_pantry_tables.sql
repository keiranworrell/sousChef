-- Removes pantry tracking.
--
-- IRREVERSIBLE. This destroys all pantry data; there is no recovery path short
-- of a database restore. Apply it only after the code change has deployed, so
-- there is never a window where the running Lambdas query tables that are gone.
--
-- Order matters: pantry_item_notes references pantry_items, so the child goes
-- first. CASCADE would handle it, but naming the dependency makes the intent
-- explicit rather than relying on Postgres to work it out.
DROP TABLE IF EXISTS pantry_item_notes;
DROP TABLE IF EXISTS pantry_items;
