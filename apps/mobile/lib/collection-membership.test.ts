import { describe, expect, it } from "vitest";
import { membershipChanges } from "./collection-membership";

const RECIPE = "r1";

describe("membershipChanges", () => {
  it("sends nothing when nothing changed", () => {
    // Opening the picker and closing it again should write to nothing at all.
    expect(membershipChanges(RECIPE, ["a", "b"], ["a", "b"])).toEqual([]);
    expect(membershipChanges(RECIPE, [], [])).toEqual([]);
  });

  it("adds to newly ticked collections", () => {
    expect(membershipChanges(RECIPE, [], ["a"])).toEqual([
      { collectionId: "a", add: [RECIPE], remove: [] },
    ]);
  });

  it("removes from newly unticked collections", () => {
    expect(membershipChanges(RECIPE, ["a"], [])).toEqual([
      { collectionId: "a", add: [], remove: [RECIPE] },
    ]);
  });

  it("handles adds and removes in the same edit", () => {
    const changes = membershipChanges(RECIPE, ["a", "b"], ["b", "c"]);
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ collectionId: "c", add: [RECIPE], remove: [] });
    expect(changes).toContainEqual({ collectionId: "a", add: [], remove: [RECIPE] });
  });

  it("never touches a collection the user left alone", () => {
    // The one that matters: "b" was ticked before and after, so it must not
    // appear. Writing to it would be a request against something untouched.
    const changes = membershipChanges(RECIPE, ["a", "b"], ["b", "c"]);
    expect(changes.map((c) => c.collectionId)).not.toContain("b");
  });

  it("is not confused by duplicate ids", () => {
    // Defensive: the list comes from the server and from local toggling, and a
    // duplicate would otherwise produce two calls for one collection.
    expect(membershipChanges(RECIPE, ["a", "a"], [])).toEqual([
      { collectionId: "a", add: [], remove: [RECIPE] },
    ]);
  });
});
