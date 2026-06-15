import { pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const pantryItems = pgTable("pantry_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  lowStockThreshold: real("low_stock_threshold"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pantryItemNotes = pgTable("pantry_item_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  pantryItemId: uuid("pantry_item_id").notNull().references(() => pantryItems.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
