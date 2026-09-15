import { index, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * One entry in an interleaved plan.
 *
 * Deliberately a *reference*, not a copy. The agent chooses order and timing;
 * it never authors or edits instruction text, so a step shown to the user can
 * always be traced back to the recipe it came from and cannot have had its
 * temperature or timing quietly altered. See backend/agents/multi-recipe-cook.ts
 * for the validation that enforces this.
 */
export type CookPlanStep = {
  /** Which recipe this step belongs to. */
  recipeId: string;
  /** stepNumber within that recipe, as stored. */
  stepNumber: number;
  /**
   * Minutes from the start of the cook at which to begin this step. Advisory —
   * presented as a suggestion, not a countdown, because the model's estimate of
   * how long a human takes to chop an onion is exactly that.
   */
  startOffsetMinutes: number;
  /**
   * Why this step sits here, in the model's words. Optional and advisory, e.g.
   * "start now so it rests while the sauce reduces".
   */
  note?: string | null;
};

export type CookPlan = {
  steps: CookPlanStep[];
  /** The model's estimate of total elapsed time, in minutes. Advisory. */
  totalMinutes: number;
};

export const cookSessions = pgTable(
  "cook_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeIds: uuid("recipe_ids").array().notNull(),
    plan: jsonb("plan").$type<CookPlan>().notNull(),
    currentStep: integer("current_step").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cook_sessions_user_created_idx").on(t.userId, t.createdAt)],
);
