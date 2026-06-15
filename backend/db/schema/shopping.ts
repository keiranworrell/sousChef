import { boolean, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  shoppingListId: uuid("shopping_list_id").notNull().references(() => shoppingLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  category: text("category"),
  isChecked: boolean("is_checked").notNull().default(false),
  orderIndex: integer("order_index").notNull(),
});
