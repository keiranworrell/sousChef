import { count, eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../client";
import { follows, users } from "../schema";

export type FollowCounts = {
  followerCount: number;
  followingCount: number;
};

export type PublicUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

/**
 * Follow a user. No-ops if already following (unique constraint).
 */
export async function followUser(followerId: string, followeeId: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(follows)
    .values({ followerId, followeeId })
    .onConflictDoNothing();
}

/**
 * Unfollow a user. No-ops if not following.
 */
export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

/**
 * Check whether followerId is currently following followeeId.
 */
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return row !== undefined;
}

/**
 * Get follower and following counts for a user.
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const db = await getDb();

  const [followerRow] = await db
    .select({ value: count() })
    .from(follows)
    .where(eq(follows.followeeId, userId));

  const [followingRow] = await db
    .select({ value: count() })
    .from(follows)
    .where(eq(follows.followerId, userId));

  return {
    followerCount: followerRow?.value ?? 0,
    followingCount: followingRow?.value ?? 0,
  };
}

export type FollowListItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
  isFollowing: boolean;
};

export type FollowListResult = {
  users: FollowListItem[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * Get a paginated list of users who follow userId.
 */
export async function getFollowers(
  userId: string,
  requestingUserId: string,
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<FollowListResult> {
  const db = await getDb();

  const [rows, [countRow]] = await Promise.all([
    db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followeeId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(follows).where(eq(follows.followeeId, userId)),
  ]);

  return buildFollowList(rows, requestingUserId, countRow?.value ?? 0, limit, offset);
}

/**
 * Get a paginated list of users that userId is following.
 */
export async function getFollowing(
  userId: string,
  requestingUserId: string,
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<FollowListResult> {
  const db = await getDb();

  const [rows, [countRow]] = await Promise.all([
    db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(follows)
      .innerJoin(users, eq(follows.followeeId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(follows).where(eq(follows.followerId, userId)),
  ]);

  return buildFollowList(rows, requestingUserId, countRow?.value ?? 0, limit, offset);
}

/**
 * Shared helper: enrich a list of user rows with follower counts and isFollowing.
 */
async function buildFollowList(
  rows: Array<{ id: string; displayName: string; avatarUrl: string | null }>,
  requestingUserId: string,
  total: number,
  limit: number,
  offset: number,
): Promise<FollowListResult> {
  if (rows.length === 0) return { users: [], total, limit, offset };

  const db = await getDb();
  const ids = rows.map((r) => r.id);

  const [followerCountRows, followingRows] = await Promise.all([
    db
      .select({ followeeId: follows.followeeId, cnt: count() })
      .from(follows)
      .where(inArray(follows.followeeId, ids))
      .groupBy(follows.followeeId),
    db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(and(eq(follows.followerId, requestingUserId), inArray(follows.followeeId, ids))),
  ]);

  const countMap = new Map(followerCountRows.map((r) => [r.followeeId, r.cnt]));
  const followingSet = new Set(followingRows.map((r) => r.followeeId));

  return {
    users: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      followerCount: countMap.get(r.id) ?? 0,
      isFollowing: followingSet.has(r.id),
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Get a public user profile by ID, including follow counts and whether
 * the requesting user is following them.
 */
export async function getPublicUser(
  userId: string,
  requestingUserId: string,
): Promise<PublicUser | null> {
  const db = await getDb();

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const [counts, following] = await Promise.all([
    getFollowCounts(userId),
    isFollowing(requestingUserId, userId),
  ]);

  return {
    ...user,
    ...counts,
    isFollowing: following,
  };
}
