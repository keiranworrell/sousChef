import { boolean, index, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";
import { households } from "./households";

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

/** 'viewer' can read; 'editor' can also add and remove recipes. */
export type CollectionShareRole = "viewer" | "editor";

/**
 * One grant of access to a collection.
 *
 * Exactly one of sharedWithUserId / sharedWithHouseholdId is set — enforced by
 * a CHECK constraint, because a row with both or neither would make the access
 * query's answer depend on which column it happened to test first.
 *
 * Neither role can rename, delete, re-share, or change who else has access.
 * A share can never widen itself; only the owner can widen it.
 */
export const collectionShares = pgTable(
  "collection_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    sharedWithUserId: uuid("shared_with_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sharedWithHouseholdId: uuid("shared_with_household_id").references(
      () => households.id,
      { onDelete: "cascade" },
    ),
    role: text("role").$type<CollectionShareRole>().notNull().default("viewer"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("collection_shares_user_idx").on(t.sharedWithUserId),
    index("collection_shares_household_idx").on(t.sharedWithHouseholdId),
  ],
);
