import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { recipes } from "./recipes";

export const cookHistory = pgTable(
  "cook_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    /**
     * Defaults to now, but is settable — people log a cook the morning after
     * as often as they do while standing at the hob.
     */
    cookedAt: timestamp("cooked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * 1–5, or null for a bare "I cooked this" log. The range is also enforced
     * by a CHECK constraint; see migration 0014.
     */
    rating: integer("rating"),
    /** What they'd change next time. Null and empty are both "nothing to say". */
    notes: text("notes"),
  },
  (table) => ({
    userRecipeCookedAtIdx: index("cook_history_user_recipe_cooked_at_idx").on(
      table.userId,
      table.recipeId,
      table.cookedAt,
    ),
  }),
);
