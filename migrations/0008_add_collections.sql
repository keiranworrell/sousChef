-- Migration: add collections and collection_items tables

CREATE TABLE IF NOT EXISTS "collections" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "description" text,
  "is_public"   boolean NOT NULL DEFAULT false,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "collection_items" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "recipe_id"     uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "added_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "collection_items_unique" UNIQUE ("collection_id", "recipe_id")
);

CREATE INDEX IF NOT EXISTS "collections_user_id_idx" ON "collections"("user_id");
CREATE INDEX IF NOT EXISTS "collection_items_collection_id_idx" ON "collection_items"("collection_id");
CREATE INDEX IF NOT EXISTS "collection_items_recipe_id_idx" ON "collection_items"("recipe_id");
