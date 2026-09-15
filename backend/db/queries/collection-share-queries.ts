import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  collectionItems,
  collections,
  collectionShares,
  householdMembers,
  households,
  notifications,
  users,
} from "../schema";
import type { CollectionShareRole } from "../schema";

/**
 * What a user may do with a collection.
 *
 * `null` means no access at all, and callers must treat it as not-found rather
 * than forbidden — telling someone a collection exists but isn't theirs leaks
 * the existence of other people's data, which is how the `logCook` hole worked.
 */
export type CollectionAccess = "owner" | "editor" | "viewer" | null;

export type CollectionShareRecord = typeof collectionShares.$inferSelect;

export type CollectionShareDetail = {
  id: string;
  role: CollectionShareRole;
  createdAt: Date;
  /** Exactly one of these is populated, mirroring the row's single target. */
  user: { id: string; displayName: string; avatarUrl: string | null } | null;
  household: { id: string; name: string } | null;
};

/**
 * The access decision, separated from the fetching.
 *
 * Pure on purpose: this is the rule that decides whether one person may read or
 * change another person's collection, and a rule that important should be
 * testable without a database. getCollectionAccess below does the querying and
 * defers every judgement to this.
 *
 * Ownership outranks any share. Among shares, the most permissive wins —
 * someone can be both a household member and individually shared with, and the
 * narrower of two grants was never meant to take something away.
 */
export function resolveAccess(params: {
  ownerId: string | null;
  viewerId: string;
  shareRoles: CollectionShareRole[];
}): CollectionAccess {
  const { ownerId, viewerId, shareRoles } = params;

  // No collection at all. Callers turn this into the same 404 as "not yours",
  // so an id probe learns nothing either way.
  if (ownerId === null) return null;
  if (ownerId === viewerId) return "owner";
  if (shareRoles.length === 0) return null;
  return shareRoles.includes("editor") ? "editor" : "viewer";
}

/**
 * The single authorisation check for collections. Every read and write path
 * goes through this rather than repeating an ownership clause.
 *
 * One function, one place to be wrong. The September authorisation sweep found
 * three separately-written checks that had each drifted, which is the argument
 * against inlining `eq(collections.userId, userId)` at twelve call sites.
 *
 * Resolution order matters: ownership wins over any share, and a direct user
 * share wins over a household share. Someone can be both a household member and
 * individually shared with as an editor, and the more permissive of the two is
 * the one they should get — the narrower grant was clearly deliberate.
 */
export async function getCollectionAccess(
  collectionId: string,
  userId: string,
): Promise<CollectionAccess> {
  const db = await getDb();

  const [collection] = await db
    .select({ userId: collections.userId })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) return resolveAccess({ ownerId: null, viewerId: userId, shareRoles: [] });
  if (collection.userId === userId) {
    return resolveAccess({ ownerId: collection.userId, viewerId: userId, shareRoles: [] });
  }

  // The user's household, if any. A user belongs to at most one, enforced by a
  // unique on household_members.user_id.
  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  const shareRows = await db
    .select({ role: collectionShares.role })
    .from(collectionShares)
    .where(
      and(
        eq(collectionShares.collectionId, collectionId),
        membership
          ? or(
              eq(collectionShares.sharedWithUserId, userId),
              eq(collectionShares.sharedWithHouseholdId, membership.householdId),
            )
          : eq(collectionShares.sharedWithUserId, userId),
      ),
    );

  return resolveAccess({
    ownerId: collection.userId,
    viewerId: userId,
    shareRoles: shareRows.map((r) => r.role),
  });
}

/** True when the access level permits adding and removing recipes. */
export function canEditCollection(access: CollectionAccess): boolean {
  return access === "owner" || access === "editor";
}

/** True when the access level permits reading. */
export function canReadCollection(access: CollectionAccess): boolean {
  return access !== null;
}

/**
 * Shares on a collection, for the owner's management panel.
 *
 * Owner-only at the route, not here — this returns who else can see the
 * collection, which is the owner's business and nobody else's.
 */
export async function listCollectionShares(
  collectionId: string,
): Promise<CollectionShareDetail[]> {
  const db = await getDb();

  const rows = await db
    .select({
      id: collectionShares.id,
      role: collectionShares.role,
      createdAt: collectionShares.createdAt,
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      householdId: households.id,
      householdName: households.name,
    })
    .from(collectionShares)
    .leftJoin(users, eq(collectionShares.sharedWithUserId, users.id))
    .leftJoin(households, eq(collectionShares.sharedWithHouseholdId, households.id))
    .where(eq(collectionShares.collectionId, collectionId))
    .orderBy(collectionShares.createdAt);

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    createdAt: r.createdAt,
    user: r.userId
      ? { id: r.userId, displayName: r.displayName ?? "", avatarUrl: r.avatarUrl ?? null }
      : null,
    household: r.householdId ? { id: r.householdId, name: r.householdName ?? "" } : null,
  }));
}

export type ShareCollectionInput = {
  collectionId: string;
  ownerId: string;
  targetUserId?: string | null;
  targetHouseholdId?: string | null;
  role: CollectionShareRole;
};

/**
 * Create or update a share.
 *
 * Upserts on the partial unique indexes, so re-sharing with someone who already
 * has access changes their role rather than failing. That is what the owner
 * means by picking a different role for a name already in the list.
 */
export async function shareCollection(
  input: ShareCollectionInput,
): Promise<CollectionShareRecord | null> {
  const db = await getDb();

  // Sharing with yourself is a no-op that would otherwise sit in the list
  // looking like it did something.
  if (input.targetUserId && input.targetUserId === input.ownerId) return null;

  const [row] = await db
    .insert(collectionShares)
    .values({
      collectionId: input.collectionId,
      sharedWithUserId: input.targetUserId ?? null,
      sharedWithHouseholdId: input.targetHouseholdId ?? null,
      role: input.role,
      createdBy: input.ownerId,
    })
    .onConflictDoUpdate({
      target: input.targetUserId
        ? [collectionShares.collectionId, collectionShares.sharedWithUserId]
        : [collectionShares.collectionId, collectionShares.sharedWithHouseholdId],
      set: { role: input.role },
      // Drizzle needs the index predicate restated to match a partial unique.
      targetWhere: input.targetUserId
        ? isNull(collectionShares.sharedWithHouseholdId)
        : isNull(collectionShares.sharedWithUserId),
    })
    .returning();

  return row ?? null;
}

/**
 * Remove a share. Scoped to the collection as well as the share id, so an id
 * from another collection matches nothing rather than revoking someone else's
 * access.
 */
export async function revokeCollectionShare(
  collectionId: string,
  shareId: string,
): Promise<boolean> {
  const db = await getDb();
  const removed = await db
    .delete(collectionShares)
    .where(
      and(eq(collectionShares.id, shareId), eq(collectionShares.collectionId, collectionId)),
    )
    .returning({ id: collectionShares.id });
  return removed.length > 0;
}

/**
 * Collection ids shared with this user, directly or via their household.
 *
 * Returned as ids so callers can feed them into an `inArray` alongside their
 * own collections in a single query, rather than issuing a second round trip
 * per collection.
 */
export async function getSharedCollectionIds(
  userId: string,
): Promise<{ collectionId: string; role: CollectionShareRole }[]> {
  const db = await getDb();

  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  const rows = await db
    .select({
      collectionId: collectionShares.collectionId,
      role: collectionShares.role,
    })
    .from(collectionShares)
    .where(
      membership
        ? or(
            eq(collectionShares.sharedWithUserId, userId),
            eq(collectionShares.sharedWithHouseholdId, membership.householdId),
          )
        : eq(collectionShares.sharedWithUserId, userId),
    );

  return collapseShareRoles(rows);
}

/**
 * Collapse duplicate grants per collection, keeping the most permissive.
 *
 * Someone shared with both directly and through their household appears twice.
 * Pure and exported so the same rule as resolveAccess can be tested rather than
 * assumed — the two disagreeing would mean a collection listed as read-only
 * that the user can in fact edit, or worse.
 */
export function collapseShareRoles(
  rows: { collectionId: string; role: CollectionShareRole }[],
): { collectionId: string; role: CollectionShareRole }[] {
  const byCollection = new Map<string, CollectionShareRole>();
  for (const row of rows) {
    if (byCollection.get(row.collectionId) === "editor") continue;
    byCollection.set(row.collectionId, row.role);
  }
  return [...byCollection].map(([collectionId, role]) => ({ collectionId, role }));
}

/**
 * Whether a recipe is reachable by this user through a collection shared with
 * them. Used to widen recipe *reads* only; edit and delete remain scoped to the
 * owner in their own WHERE clauses.
 */
export async function isRecipeInSharedCollection(
  recipeId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();

  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(collectionShares)
    .innerJoin(
      collectionItems,
      eq(collectionItems.collectionId, collectionShares.collectionId),
    )
    .where(
      and(
        eq(collectionItems.recipeId, recipeId),
        membership
          ? or(
              eq(collectionShares.sharedWithUserId, userId),
              eq(collectionShares.sharedWithHouseholdId, membership.householdId),
            )
          : eq(collectionShares.sharedWithUserId, userId),
      ),
    )
    .limit(1);

  return Boolean(row);
}


/**
 * Tell people a collection has been shared with them.
 *
 * Best-effort and deliberately outside the share write: a notification that
 * fails to insert should not undo a share the owner has already been told
 * succeeded. The share is the fact; the notification is a courtesy.
 *
 * For a household share, every current member is notified except the owner.
 * Members who join later inherit access silently — notifying them at join time
 * would mean the household join path knowing about collections, and the
 * collections list already shows them what they have.
 */
export async function notifyCollectionShared(params: {
  collectionId: string;
  collectionName: string;
  ownerId: string;
  ownerName: string;
  targetUserId?: string | null;
  targetHouseholdId?: string | null;
  role: CollectionShareRole;
}): Promise<void> {
  const db = await getDb();

  let recipientIds: string[] = [];
  if (params.targetUserId) {
    recipientIds = [params.targetUserId];
  } else if (params.targetHouseholdId) {
    const members = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, params.targetHouseholdId));
    recipientIds = members.map((m) => m.userId);
  }

  // Never notify the owner about their own share, which happens whenever they
  // share with the household they are themselves in.
  recipientIds = recipientIds.filter((id) => id !== params.ownerId);
  if (recipientIds.length === 0) return;

  await db.insert(notifications).values(
    recipientIds.map((userId) => ({
      userId,
      type: "collection_shared",
      referenceId: params.collectionId,
      data: {
        collectionId: params.collectionId,
        collectionName: params.collectionName,
        sharerId: params.ownerId,
        sharerName: params.ownerName,
        role: params.role,
      },
    })),
  );
}
