-- Composite indexes supporting keyset pagination.
--
-- Each index matches the exact ORDER BY of a sort mode, including the id
-- tiebreaker and its direction. The direction has to match: a DESC keyset scan
-- cannot use an ASC-ordered index for the row-value comparison without an extra
-- sort step, which is the cost we are trying to remove.
--
-- The leading userId / isPublic column matches the equality filter that every
-- query applies, so Postgres can seek straight to the relevant range.

-- listRecipes, sort=newest (default)
CREATE INDEX IF NOT EXISTS recipes_user_updated_at_id_desc_idx
  ON recipes (user_id, updated_at DESC, id DESC);

-- listRecipes, sort=oldest
CREATE INDEX IF NOT EXISTS recipes_user_updated_at_id_asc_idx
  ON recipes (user_id, updated_at ASC, id ASC);

-- listRecipes, sort=title
CREATE INDEX IF NOT EXISTS recipes_user_title_id_asc_idx
  ON recipes (user_id, title ASC, id ASC);

-- listPublicRecipes, default (newest) sort. Partial index — the community feed
-- only ever reads public rows, so excluding private ones keeps the index small.
CREATE INDEX IF NOT EXISTS recipes_public_updated_at_id_desc_idx
  ON recipes (updated_at DESC, id DESC)
  WHERE is_public = true;

-- Supports the like-count aggregate that the popular sort groups by.
CREATE INDEX IF NOT EXISTS recipe_likes_recipe_id_idx
  ON recipe_likes (recipe_id);
