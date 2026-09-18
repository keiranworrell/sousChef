import { describe, expect, it } from "vitest";
import type { Household, HouseholdMember } from "@souschef/shared";
import { isOwner, leaveConsequence } from "./household-actions";

function member(userId: string, joinedAt: string): HouseholdMember {
  return {
    id: `m-${userId}`,
    userId,
    displayName: userId,
    avatarUrl: null,
    joinedAt,
  };
}

function household(ownerId: string, memberIds: string[]): Household {
  return {
    id: "h1",
    name: "Worrells",
    ownerId,
    createdAt: "2026-01-01T00:00:00.000Z",
    members: memberIds.map((id, i) => member(id, `2026-0${i + 1}-01T00:00:00.000Z`)),
  };
}

describe("leaveConsequence", () => {
  it("warns the sole member that the household goes with them", () => {
    const result = leaveConsequence(household("u1", ["u1"]), "u1");
    expect(result.destructive).toBe(true);
    expect(result.message).toContain("deleted");
  });

  it("treats last-member-out as destructive even before ownership", () => {
    // The ordering matters. An owner alone matches both branches, and the
    // ownership-transfer message would promise a transfer to nobody while the
    // server quietly dissolves the household.
    const result = leaveConsequence(household("u1", ["u1"]), "u1");
    expect(result.message).not.toContain("Ownership");
    expect(result.message).not.toContain("joined earliest");
  });

  it("tells an owner with company that ownership moves on", () => {
    const result = leaveConsequence(household("u1", ["u1", "u2"]), "u1");
    expect(result.destructive).toBe(false);
    expect(result.message).toContain("joined earliest");
  });

  it("keeps it simple for an ordinary member", () => {
    const result = leaveConsequence(household("u1", ["u1", "u2"]), "u2");
    expect(result.destructive).toBe(false);
    expect(result.message).not.toContain("Ownership");
    expect(result.message).not.toContain("deleted");
  });

  it("names the household in every case, so the alert is unambiguous", () => {
    expect(leaveConsequence(household("u1", ["u1"]), "u1").title).toContain("Worrells");
    expect(leaveConsequence(household("u1", ["u1", "u2"]), "u1").title).toContain("Worrells");
    expect(leaveConsequence(household("u1", ["u1", "u2"]), "u2").title).toContain("Worrells");
  });
});

describe("isOwner", () => {
  it("is true only for the owner", () => {
    const h = household("u1", ["u1", "u2"]);
    expect(isOwner(h, "u1")).toBe(true);
    expect(isOwner(h, "u2")).toBe(false);
  });
});
