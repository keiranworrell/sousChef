-- Makes meal type optional, so a day can hold any number of recipes rather than
-- one per breakfast/lunch/dinner/snack slot.
--
-- The slot model forced a choice that doesn't match how people cook: a single
-- meal often comes from several recipes — a main, a side, a sauce — and there
-- was nowhere to put the second and third. Days now hold a list, and meal type
-- becomes a label you may apply rather than a slot you must fill.
--
-- Existing rows keep whatever meal type they already have, so current plans
-- look the same after this runs; only new entries can omit it.
--
-- Deliberately not dropping the enum type: the values are still used, just no
-- longer mandatory.
ALTER TABLE meal_plan_entries
  ALTER COLUMN meal_type DROP NOT NULL;
