import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { sql } from "drizzle-orm";

export const households = pgTable("households", {
  id:        uuid("id").primaryKey().defaultRandom().notNull(),
  name:      text("name").notNull(),
  ownerId:   uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id:          uuid("id").primaryKey().defaultRandom().notNull(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique("household_members_user_unique"),
    joinedAt:    timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const householdInvites = pgTable(
  "household_invites",
  {
    id:          uuid("id").primaryKey().defaultRandom().notNull(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    inviterId:   uuid("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    inviteeId:   uuid("invitee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status:      text("status").notNull().default("pending"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("household_invites_pending_unique")
      .on(t.householdId, t.inviteeId)
      .where(sql`status = 'pending'`),
  ],
);
