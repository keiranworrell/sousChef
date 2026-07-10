import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";

export const recipeLikes = pgTable(
  "recipe_likes",
  {
    id:        uuid("id").primaryKey().defaultRandom().notNull(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipeId:  uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("recipe_likes_unique").on(t.userId, t.recipeId),
  ],
);
