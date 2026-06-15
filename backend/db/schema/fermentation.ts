import { pgEnum, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";

export const fermentationStatusEnum = pgEnum("fermentation_status", [
  "active",
  "complete",
  "abandoned",
]);

export const fermentationBatches = pgTable("fermentation_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  targetEndDate: timestamp("target_end_date", { withTimezone: true }),
  status: fermentationStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fermentationLogs = pgTable("fermentation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => fermentationBatches.id, { onDelete: "cascade" }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  ph: real("ph"),
  saltPercent: real("salt_percent"),
  temperatureCelsius: real("temperature_celsius"),
  weightGrams: real("weight_grams"),
  notes: text("notes"),
  imageUrl: text("image_url"),
});
