-- Per-entry servings, so a recipe written for 8 can be planned for 2.
--
-- Without this, the generated shopping list uses each recipe's own serving
-- count regardless of how many people the plan is for — an 8-serving recipe in
-- a plan for two produces quantities four times too large, which makes the
-- whole feature untrustworthy.
--
-- Nullable rather than defaulted: null means "cook it as written", which is
-- distinct from "cook it for N people" even when N happens to equal the
-- recipe's own servings. Existing entries become null and therefore keep
-- behaving exactly as they do today.
ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS servings integer;

-- A plan entry for zero or negative servings is meaningless, and a negative
-- value would flip quantities negative in the shopping list.
ALTER TABLE meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_servings_positive
  CHECK (servings IS NULL OR servings > 0);
