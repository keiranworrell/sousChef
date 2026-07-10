CREATE TABLE "follows" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_id" uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "followee_id" uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "follows_unique" UNIQUE ("follower_id", "followee_id"),
  CONSTRAINT "follows_no_self" CHECK ("follower_id" <> "followee_id")
);

CREATE INDEX ON "follows" ("follower_id");
CREATE INDEX ON "follows" ("followee_id");
