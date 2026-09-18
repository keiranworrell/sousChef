/**
 * Optimistic follow and unfollow.
 *
 * The tap has to land immediately — a follow button that waits for a round
 * trip before changing feels broken on a phone — so the count is adjusted
 * locally and reverted if the request fails. That means the arithmetic happens
 * twice, in opposite directions, which is exactly the sort of thing that ends
 * up off by one and shows someone "-1 followers".
 */

export type Followable = {
  isFollowing: boolean;
  followerCount: number;
};

/**
 * The state after toggling, assuming the request will succeed.
 *
 * Counts are clamped at zero. A stale `followerCount` of 0 on a profile the
 * user is somehow already following is reachable — the profile was fetched at
 * one moment and tapped at another — and a negative follower count is a
 * visibly wrong number in a way that "0" is not.
 */
export function toggleFollow<T extends Followable>(subject: T): T {
  return subject.isFollowing
    ? { ...subject, isFollowing: false, followerCount: Math.max(0, subject.followerCount - 1) }
    : { ...subject, isFollowing: true, followerCount: subject.followerCount + 1 };
}

/**
 * Apply a toggle to one entry in a list, leaving the rest untouched.
 *
 * Used by the followers and following sheets, where several people are on
 * screen and only the tapped one should move.
 */
export function toggleFollowIn<T extends Followable & { id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.map((item) => (item.id === id ? toggleFollow(item) : item));
}

/**
 * Whether a follow button should be shown at all.
 *
 * You cannot follow yourself, and the server would reject it. Offering the
 * button on your own profile and letting it fail is worse than not drawing it,
 * and `ownId` is null while the current user is still loading — in which case
 * we also draw nothing rather than flashing a button that may vanish.
 */
export function canFollow(profileId: string, ownId: string | null): boolean {
  return ownId !== null && ownId !== profileId;
}
