import { describe, expect, it } from "vitest";
import type { OnboardingState, OnboardingStepId } from "@souschef/shared";
import {
  RETIRED_VALUE,
  parseRetired,
  shouldRetire,
  shouldShowChecklist,
} from "./onboarding-retirement";

const IDS: OnboardingStepId[] = ["add-recipe", "plan-meals", "shopping-list", "cook"];

function state(done: Partial<Record<OnboardingStepId, boolean>>): OnboardingState {
  const steps = IDS.map((id) => ({ id, done: done[id] ?? false }));
  return { steps, complete: steps.every((s) => s.done), fresh: !done["add-recipe"] };
}

const allDone = state({ "add-recipe": true, "plan-meals": true, "shopping-list": true, cook: true });
const partway = state({ "add-recipe": true, "plan-meals": true, cook: true });

describe("shouldShowChecklist", () => {
  it("shows while the loop is unfinished and not retired", () => {
    expect(shouldShowChecklist(partway, false)).toBe(true);
  });

  it("hides once everything is done", () => {
    expect(shouldShowChecklist(allDone, false)).toBe(false);
  });

  it("stays hidden once retired, even if a step un-completes", () => {
    // The bug. Steps come from live data, so deleting your last shopping list
    // un-ticks that step and `complete` flips back to false — and a checklist
    // finished weeks ago reappears telling you to get started.
    expect(shouldShowChecklist(partway, true)).toBe(false);
  });

  it("hides while storage has not answered yet", () => {
    // Undefined means "still reading". Showing it for that one frame to
    // someone who finished months ago is the exact flash being prevented.
    expect(shouldShowChecklist(partway, undefined)).toBe(false);
  });

  it("hides when progress has not loaded", () => {
    expect(shouldShowChecklist(null, false)).toBe(false);
  });
});

describe("shouldRetire", () => {
  it("retires on completion", () => {
    expect(shouldRetire(allDone, false)).toBe(true);
  });

  it("does not retire a half-finished checklist", () => {
    expect(shouldRetire(partway, false)).toBe(false);
  });

  it("does not write again once already retired", () => {
    expect(shouldRetire(allDone, true)).toBe(false);
  });

  it("waits for storage before deciding", () => {
    expect(shouldRetire(allDone, undefined)).toBe(false);
  });

  it("does nothing without progress", () => {
    expect(shouldRetire(null, false)).toBe(false);
  });
});

describe("parseRetired", () => {
  it("only treats the written value as retired", () => {
    expect(parseRetired(RETIRED_VALUE)).toBe(true);
  });

  it("treats anything else as not retired", () => {
    // Including whatever an older build or a half-finished write left behind.
    for (const v of [null, undefined, "", "0", "true", "yes", "{}"]) {
      expect(parseRetired(v), String(v)).toBe(false);
    }
  });
});
