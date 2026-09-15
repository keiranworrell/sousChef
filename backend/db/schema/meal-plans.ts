import { integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";
import { households } from "./households";

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
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
  weekStartDate: timestamp("week_start_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealPlanId: uuid("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  /**
   * Optional label, not a slot. A day holds any number of entries; tagging one
   * as breakfast or dinner is a convenience for grouping, not a requirement.
   */
  mealType: mealTypeEnum("meal_type"),
  /**
   * How many people this entry is being cooked for. Null means "as written",
   * i.e. use the recipe's own serving count and don't scale.
   */
  servings: integer("servings"),
});
