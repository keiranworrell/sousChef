CREATE TABLE IF NOT EXISTS "recipe_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_likes_unique" UNIQUE("user_id","recipe_id")
);
