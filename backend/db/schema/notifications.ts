import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const notifications = pgTable(
  "notifications",
  {
    id:          uuid("id").primaryKey().defaultRandom().notNull(),
    userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type:        text("type").notNull(),
    referenceId: uuid("reference_id"),
    data:        jsonb("data"),
    seenAt:      timestamp("seen_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
  ],
);
