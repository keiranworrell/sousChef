import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type PlanTier = "free" | "premium";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  cognitoId: text("cognito_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  dietaryPreferences: text("dietary_preferences").array(),
  planTier: text("plan_tier").$type<PlanTier>().notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
