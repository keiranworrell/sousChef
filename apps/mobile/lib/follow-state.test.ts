import { describe, expect, it } from "vitest";
import { canFollow, toggleFollow, toggleFollowIn } from "./follow-state";

describe("toggleFollow", () => {
  it("follows and increments", () => {
    expect(toggleFollow({ isFollowing: false, followerCount: 4 }))
      .toEqual({ isFollowing: true, followerCount: 5 });
  });

  it("unfollows and decrements", () => {
    expect(toggleFollow({ isFollowing: true, followerCount: 4 }))
      .toEqual({ isFollowing: false, followerCount: 3 });
  });

  it("never goes below zero", () => {
    // Reachable from a stale profile: fetched at one moment, tapped at another.
    // "0 followers" is wrong but unremarkable; "-1 followers" is visibly broken.
    expect(toggleFollow({ isFollowing: true, followerCount: 0 }).followerCount).toBe(0);
  });

  it("round-trips back to where it started", () => {
    // The revert path on a failed request is this function applied again, so
    // the two directions have to cancel exactly.
    const start = { isFollowing: false, followerCount: 12 };
    expect(toggleFollow(toggleFollow(start))).toEqual(start);
  });

  it("keeps other fields", () => {
    const withName = { isFollowing: false, followerCount: 1, displayName: "Ada" };
    expect(toggleFollow(withName).displayName).toBe("Ada");
  });
});

describe("toggleFollowIn", () => {
  const items = [
    { id: "a", isFollowing: false, followerCount: 1 },
    { id: "b", isFollowing: true, followerCount: 9 },
  ];

  it("moves only the person tapped", () => {
    const next = toggleFollowIn(items, "a");
    expect(next[0]).toEqual({ id: "a", isFollowing: true, followerCount: 2 });
    expect(next[1]).toEqual(items[1]);
  });

  it("leaves the list alone when the id is not in it", () => {
    expect(toggleFollowIn(items, "missing")).toEqual(items);
  });
});

describe("canFollow", () => {
  it("is false for yourself", () => {
    expect(canFollow("u1", "u1")).toBe(false);
  });

  it("is true for anyone else", () => {
    expect(canFollow("u2", "u1")).toBe(true);
  });

  it("is false while the current user is still loading", () => {
    // Better no button than one that appears and then disappears.
    expect(canFollow("u2", null)).toBe(false);
  });
});
