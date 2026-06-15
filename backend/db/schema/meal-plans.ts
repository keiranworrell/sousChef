import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "0", "1", "2", "3", "4", "5", "6",
]);

export const mealTypeEnum = pgEnum("meal_type", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

export const mealPlans = pgTable("meal_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStartDate: timestamp("week_start_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealPlanId: uuid("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  mealType: mealTypeEnum("meal_type").notNull(),
});
