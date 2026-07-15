-- ── Households ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "households" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "owner_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One user → one household enforced by unique on user_id
CREATE TABLE IF NOT EXISTS "household_members" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at"    timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "household_members_user_unique" UNIQUE("user_id")
);

-- Pending invites: prevent duplicate pending invite to same user from same household
CREATE TABLE IF NOT EXISTS "household_invites" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "inviter_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invitee_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"       text NOT NULL DEFAULT 'pending',
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "household_invites_pending_unique"
  ON "household_invites"("household_id", "invitee_id")
  WHERE status = 'pending';

-- ── Notifications ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"         text NOT NULL,
  "reference_id" uuid,
  "data"         jsonb,
  "seen_at"      timestamp with time zone,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");

-- ── household_id columns on shared resources ───────────────────────────────────

ALTER TABLE "pantry_items"   ADD COLUMN IF NOT EXISTS "household_id" uuid REFERENCES "households"("id") ON DELETE CASCADE;
ALTER TABLE "shopping_lists" ADD COLUMN IF NOT EXISTS "household_id" uuid REFERENCES "households"("id") ON DELETE CASCADE;
ALTER TABLE "meal_plans"     ADD COLUMN IF NOT EXISTS "household_id" uuid REFERENCES "households"("id") ON DELETE CASCADE;
