import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  canMerge,
  toggleMergeSelection,
  type MergeCandidate,
} from "./merge-selection";

const all: MergeCandidate[] = [
  { id: "1", name: "spring onions" },
  { id: "2", name: "scallions" },
  { id: "3", name: "salad onions" },
];

const pick = (sel: typeof EMPTY_SELECTION, id: string) =>
  toggleMergeSelection(sel, all.find((c) => c.id === id)!, all);

describe("toggleMergeSelection", () => {
  it("takes the first pick's name, so the merge button works straight away", () => {
    expect(pick(EMPTY_SELECTION, "1")).toEqual({ ids: ["1"], name: "spring onions" });
  });

  it("keeps that name when more are added", () => {
    const two = pick(pick(EMPTY_SELECTION, "1"), "2");
    expect(two.ids).toEqual(["1", "2"]);
    expect(two.name).toBe("spring onions");
  });

  it("does not overwrite a name the user typed", () => {
    const typed = { ...pick(EMPTY_SELECTION, "1"), name: "Spring onions (2 bunches)" };
    expect(pick(typed, "2").name).toBe("Spring onions (2 bunches)");
  });

  it("recovers a name when the one in use is deselected", () => {
    // Otherwise the merged line keeps the name of a row that is no longer part
    // of the merge, which is a confusing thing to have to notice and undo.
    const two = pick(pick(EMPTY_SELECTION, "1"), "2");
    const afterRemoval = pick(two, "1");
    expect(afterRemoval.ids).toEqual(["2"]);
    expect(afterRemoval.name).toBe("scallions");
  });

  it("leaves a typed name alone even when a row is deselected", () => {
    const two = { ...pick(pick(EMPTY_SELECTION, "1"), "2"), name: "Onions" };
    expect(pick(two, "1").name).toBe("Onions");
  });

  it("clears everything when the last item is deselected", () => {
    const one = pick(EMPTY_SELECTION, "1");
    expect(pick(one, "1")).toEqual(EMPTY_SELECTION);
  });

  it("toggles the same item off rather than adding it twice", () => {
    const twice = pick(pick(pick(EMPTY_SELECTION, "1"), "2"), "2");
    expect(twice.ids).toEqual(["1"]);
  });
});

describe("canMerge", () => {
  it("needs two lines", () => {
    expect(canMerge({ ids: ["1"], name: "spring onions" })).toBe(false);
    expect(canMerge({ ids: ["1", "2"], name: "spring onions" })).toBe(true);
  });

  it("needs a name that is not just whitespace", () => {
    expect(canMerge({ ids: ["1", "2"], name: "" })).toBe(false);
    expect(canMerge({ ids: ["1", "2"], name: "   " })).toBe(false);
  });
});
