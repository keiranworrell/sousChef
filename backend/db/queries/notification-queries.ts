import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../client";
import { notifications } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationRecord = typeof notifications.$inferSelect;

export type NotificationData = {
  inviteId?:      string;
  householdId?:   string;
  householdName?: string;
  inviterId?:     string;
  inviterName?:   string;
  [key: string]:  unknown;
};

export type NotificationWithData = Omit<NotificationRecord, "data"> & {
  data: NotificationData | null;
};

export type NotificationListResult = {
  notifications: NotificationWithData[];
  unreadCount: number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listNotifications(userId: string): Promise<NotificationListResult> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((n) => !n.seenAt).length;

  return {
    notifications: rows as NotificationWithData[],
    unreadCount,
  };
}

export async function markNotificationSeen(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .update(notifications)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.seenAt),
      ),
    )
    .returning({ id: notifications.id });

  return result.length > 0;
}

export async function markAllNotificationsSeen(userId: string): Promise<void> {
  const db = await getDb();

  await db
    .update(notifications)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.seenAt),
      ),
    );
}
