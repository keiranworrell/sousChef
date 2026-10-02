import { describe, expect, it } from "vitest";
import { isBareCollectionPath } from "./collection-paths";

const ID = "7b1c9f2e-2f1a-4a3d-9f5a-0c1d2e3f4a5b";

describe("isBareCollectionPath", () => {
  it("matches the bare collection path", () => {
    expect(isBareCollectionPath(`/collections/${ID}`, ID)).toBe(true);
  });

  it("does not match the shares sub-resource", () => {
    // The bug. The generic branch asked `!rawPath.includes("/recipes")`, so
    // this matched it, returned the collection, and the client crashed reading
    // `shares` off something that had none.
    expect(isBareCollectionPath(`/collections/${ID}/shares`, ID)).toBe(false);
  });

  it("does not match any other sub-resource, including ones not written yet", () => {
    for (const sub of ["recipes", "shares", "items", "cover", "anything-at-all"]) {
      expect(isBareCollectionPath(`/collections/${ID}/${sub}`, ID), sub).toBe(false);
    }
  });

  it("does not match a nested sub-resource", () => {
    expect(isBareCollectionPath(`/collections/${ID}/shares/abc`, ID)).toBe(false);
    expect(isBareCollectionPath(`/collections/${ID}/recipes/abc`, ID)).toBe(false);
  });

  it("tolerates a stage prefix", () => {
    expect(isBareCollectionPath(`/prod/collections/${ID}`, ID)).toBe(true);
    expect(isBareCollectionPath(`/prod/collections/${ID}/shares`, ID)).toBe(false);
  });

  it("tolerates a trailing slash", () => {
    expect(isBareCollectionPath(`/collections/${ID}/`, ID)).toBe(true);
  });

  it("is false when there is no id bound", () => {
    // `/collections` and `/collections/for-recipe/{recipeId}` both land here
    // with no `id` path parameter.
    expect(isBareCollectionPath("/collections", undefined)).toBe(false);
    expect(isBareCollectionPath("/collections/for-recipe/abc", undefined)).toBe(false);
  });

  it("does not match when a sub-resource id happens to equal the collection id", () => {
    // Why this matches on the last two segments rather than the suffix: this
    // path also *ends* with the id. Two UUIDs colliding is vanishingly
    // unlikely, but it is a poor thing to rest routing on when the correct
    // check costs nothing.
    expect(isBareCollectionPath(`/collections/${ID}/shares/${ID}`, ID)).toBe(false);
  });

  it("does not match a different resource that ends with the same id", () => {
    expect(isBareCollectionPath(`/recipes/${ID}`, ID)).toBe(false);
  });

  it("keeps the destructive routes apart", () => {
    // The one that mattered most. DELETE /collections/{id}/shares/{shareId}
    // contains no "/recipes", so the old exclusion-list guard matched it and
    // deleted the entire collection — returning 204 as though a share had been
    // revoked. It had not bitten only because the shares panel crashed before
    // anyone could press Remove.
    expect(isBareCollectionPath(`/collections/${ID}`, ID)).toBe(true);
    expect(isBareCollectionPath(`/collections/${ID}/shares/abc`, ID)).toBe(false);
    expect(isBareCollectionPath(`/collections/${ID}/recipes/abc`, ID)).toBe(false);
  });
});
