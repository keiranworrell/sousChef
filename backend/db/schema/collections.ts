import { boolean, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("collection_items_unique").on(t.collectionId, t.recipeId),
  ],
);
