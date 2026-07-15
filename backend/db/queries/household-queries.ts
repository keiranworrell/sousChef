import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { households, householdMembers, householdInvites, notifications, users } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HouseholdMemberWithUser = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: Date;
};

export type HouseholdWithMembers = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  members: HouseholdMemberWithUser[];
};

export type HouseholdInviteRecord = typeof householdInvites.$inferSelect;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the user's current household (with members), or null. */
export async function getUserHousehold(userId: string): Promise<HouseholdWithMembers | null> {
  const db = await getDb();

  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));

  if (!membership) return null;

  return getHouseholdById(membership.householdId);
}

/** Returns a household with its members, or null. */
export async function getHouseholdById(householdId: string): Promise<HouseholdWithMembers | null> {
  const db = await getDb();

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));

  if (!household) return null;

  const memberRows = await db
    .select({
      id:          householdMembers.id,
      userId:      householdMembers.userId,
      displayName: users.displayName,
      avatarUrl:   users.avatarUrl,
      joinedAt:    householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId));

  return { ...household, members: memberRows };
}

/** Returns just the household ID for a user, or null — cheap lookup for query routing. */
export async function getUserHouseholdId(userId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));
  return row?.householdId ?? null;
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a household and adds the creator as the first member.
 * Throws if the creator is already in a household.
 */
export async function createHousehold(
  userId: string,
  name: string,
): Promise<HouseholdWithMembers> {
  const db = await getDb();

  // Check not already in a household
  const existing = await getUserHouseholdId(userId);
  if (existing) throw new Error("USER_ALREADY_IN_HOUSEHOLD");

  const [household] = await db
    .insert(households)
    .values({ name: name.trim(), ownerId: userId })
    .returning();

  if (!household) throw new Error("Failed to create household");

  await db.insert(householdMembers).values({ householdId: household.id, userId });

  return getHouseholdById(household.id) as Promise<HouseholdWithMembers>;
}

// ── Invite ────────────────────────────────────────────────────────────────────

/**
 * Sends a household invite and creates a notification for the invitee.
 * Throws if:
 *  - inviter is not in a household
 *  - invitee is already in a household
 *  - a pending invite from this household to this user already exists
 */
export async function inviteToHousehold(
  inviterId: string,
  inviteeId: string,
): Promise<HouseholdInviteRecord> {
  const db = await getDb();

  const householdId = await getUserHouseholdId(inviterId);
  if (!householdId) throw new Error("INVITER_NOT_IN_HOUSEHOLD");

  const inviteeHouseholdId = await getUserHouseholdId(inviteeId);
  if (inviteeHouseholdId) throw new Error("INVITEE_ALREADY_IN_HOUSEHOLD");

  // Fetch names for the notification payload
  const [inviter] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, inviterId));

  const [household] = await db
    .select({ name: households.name })
    .from(households)
    .where(eq(households.id, householdId));

  if (!inviter || !household) throw new Error("Inviter or household not found");

  const [invite] = await db
    .insert(householdInvites)
    .values({ householdId, inviterId, inviteeId })
    .returning();

  if (!invite) throw new Error("Failed to create invite");

  // Create notification for the invitee
  await db.insert(notifications).values({
    userId: inviteeId,
    type: "household_invite",
    referenceId: invite.id,
    data: {
      inviteId:      invite.id,
      householdId,
      householdName: household.name,
      inviterId,
      inviterName:   inviter.displayName,
    },
  });

  return invite;
}

// ── Accept ────────────────────────────────────────────────────────────────────

/**
 * Accepts a household invite.
 * If the user is already in a household, they leave it first (with ownership transfer).
 * Returns the household they just joined.
 */
export async function acceptHouseholdInvite(
  inviteId: string,
  userId: string,
): Promise<HouseholdWithMembers> {
  const db = await getDb();

  const [invite] = await db
    .select()
    .from(householdInvites)
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.inviteeId, userId),
        eq(householdInvites.status, "pending"),
      ),
    );

  if (!invite) throw new Error("INVITE_NOT_FOUND");

  // Leave current household if any
  const currentHouseholdId = await getUserHouseholdId(userId);
  if (currentHouseholdId) {
    await leaveHousehold(userId);
  }

  // Join the new household
  await db.insert(householdMembers).values({ householdId: invite.householdId, userId });

  // Mark invite accepted
  await db
    .update(householdInvites)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(householdInvites.id, inviteId));

  return getHouseholdById(invite.householdId) as Promise<HouseholdWithMembers>;
}

// ── Decline ───────────────────────────────────────────────────────────────────

export async function declineHouseholdInvite(
  inviteId: string,
  userId: string,
): Promise<void> {
  const db = await getDb();

  const result = await db
    .update(householdInvites)
    .set({ status: "declined", updatedAt: new Date() })
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.inviteeId, userId),
        eq(householdInvites.status, "pending"),
      ),
    )
    .returning({ id: householdInvites.id });

  if (result.length === 0) throw new Error("INVITE_NOT_FOUND");
}

// ── Rename ────────────────────────────────────────────────────────────────────

/**
 * Renames a household. Only the owner may rename.
 * Throws if the user is not in a household or is not the owner.
 */
export async function renameHousehold(
  userId: string,
  name: string,
): Promise<HouseholdWithMembers> {
  const db = await getDb();

  const householdId = await getUserHouseholdId(userId);
  if (!householdId) throw new Error("NOT_IN_HOUSEHOLD");

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));

  if (!household) throw new Error("NOT_IN_HOUSEHOLD");
  if (household.ownerId !== userId) throw new Error("NOT_OWNER");

  await db
    .update(households)
    .set({ name: name.trim() })
    .where(eq(households.id, householdId));

  return getHouseholdById(householdId) as Promise<HouseholdWithMembers>;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a household. Only the owner may delete.
 * Cascade deletes all household_members, household_invites, notifications,
 * and any pantry/shopping/meal-plan items scoped to the household.
 */
export async function deleteHousehold(userId: string): Promise<void> {
  const db = await getDb();

  const householdId = await getUserHouseholdId(userId);
  if (!householdId) throw new Error("NOT_IN_HOUSEHOLD");

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));

  if (!household) throw new Error("NOT_IN_HOUSEHOLD");
  if (household.ownerId !== userId) throw new Error("NOT_OWNER");

  await db.delete(households).where(eq(households.id, householdId));
}

// ── Leave ─────────────────────────────────────────────────────────────────────

/**
 * Removes a user from their household.
 * If they are the owner and others remain, transfers ownership to the longest-standing member.
 * If they are the last member, dissolves the household.
 */
export async function leaveHousehold(userId: string): Promise<void> {
  const db = await getDb();

  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));

  if (!membership) return; // not in a household, nothing to do

  const { householdId } = membership;

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));

  if (!household) return;

  // Remove the member first
  await db
    .delete(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
      ),
    );

  // Check remaining members
  const remaining = await db
    .select({ userId: householdMembers.userId, joinedAt: householdMembers.joinedAt })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));

  if (remaining.length === 0) {
    // Last member left — dissolve the household
    await db.delete(households).where(eq(households.id, householdId));
    return;
  }

  // Transfer ownership if the leaver was the owner
  if (household.ownerId === userId) {
    // Pick the member who has been in the household the longest
    const newOwner = remaining.sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    )[0]!;

    await db
      .update(households)
      .set({ ownerId: newOwner.userId })
      .where(eq(households.id, householdId));
  }
}
