CREATE TABLE "cook_history" (
  "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipe_id"  uuid        NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "cooked_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON "cook_history" ("user_id", "cooked_at" DESC);
