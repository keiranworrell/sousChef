import { count, eq, and } from "drizzle-orm";
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
