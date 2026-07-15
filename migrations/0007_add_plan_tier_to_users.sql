-- Add plan tier to users
-- Existing users are seeded to 'premium' so current testers retain full access
-- while the paid feature set is being built out.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "plan_tier" text NOT NULL DEFAULT 'free';

-- Seed all existing users to premium
UPDATE "users" SET "plan_tier" = 'premium';
