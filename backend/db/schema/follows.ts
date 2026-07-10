import { pgTable, uuid, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const follows = pgTable(
  "follows",
  {
    id:         uuid("id").primaryKey().defaultRandom().notNull(),
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("follows_unique").on(t.followerId, t.followeeId),
    check("follows_no_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);
