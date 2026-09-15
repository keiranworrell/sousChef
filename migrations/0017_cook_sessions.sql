-- A saved multi-recipe cooking plan.
--
-- Cooking is the worst possible moment to lose state: the phone locks, the
-- screen gets a wet thumb, the tab is closed by accident, and the person is
-- halfway through a timed sequence across three recipes. Regenerating would
-- also mean a second call to the model and a second credit spent for the same
-- meal, and would very likely produce a *different* order — so the step the
-- user was on wouldn't even exist any more.
--
-- The plan is stored as JSON rather than rows. It is written once, read whole,
-- and never queried into; normalising it would buy nothing and would mean a
-- join per step render.
CREATE TABLE IF NOT EXISTS cook_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The recipes this plan was built from, in the order the user picked them.
  -- Kept alongside the plan so a session can still say what it covers even if
  -- a recipe is later edited.
  recipe_ids UUID[] NOT NULL,

  -- The interleaved plan. Every entry references a real step in one of the
  -- recipes above; the agent is not permitted to author step text. See
  -- backend/agents/multi-recipe-cook.ts.
  plan JSONB NOT NULL,

  -- Where the cook has got to. Survives a reload, which is the whole point.
  current_step INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- current_step indexes into the plan array, so a negative value could only come
-- from a bug and would render as an undefined step rather than an error.
ALTER TABLE cook_sessions
  DROP CONSTRAINT IF EXISTS cook_sessions_current_step_non_negative;

ALTER TABLE cook_sessions
  ADD CONSTRAINT cook_sessions_current_step_non_negative
  CHECK (current_step >= 0);

-- A plan built from no recipes is not a plan.
ALTER TABLE cook_sessions
  DROP CONSTRAINT IF EXISTS cook_sessions_has_recipes;

ALTER TABLE cook_sessions
  ADD CONSTRAINT cook_sessions_has_recipes
  CHECK (array_length(recipe_ids, 1) >= 1);

-- "My most recent unfinished session" is the only listing query.
CREATE INDEX IF NOT EXISTS cook_sessions_user_created_idx
  ON cook_sessions (user_id, created_at DESC);
