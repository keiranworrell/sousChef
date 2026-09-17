import { describe, expect, it } from "vitest";
import type { OnboardingState } from "@souschef/shared";
import { completedCount, nextStep, presentSteps } from "./onboarding-steps";

function state(done: Partial<Record<string, boolean>>): OnboardingState {
  const steps = (["add-recipe", "plan-meals", "shopping-list", "cook"] as const).map((id) => ({
    id,
    done: done[id] ?? false,
  }));
  return { steps, complete: steps.every((s) => s.done), fresh: !done["add-recipe"] };
}

describe("onboarding step presentation", () => {
  it("gives every step a label, a hint, a destination and a button", () => {
    // A step with no href is a checklist item the user cannot act on, which is
    // just a reminder that they haven't done something.
    for (const step of presentSteps(state({}))) {
      expect(step.label, step.id).toBeTruthy();
      expect(step.hint, step.id).toBeTruthy();
      expect(step.cta, step.id).toBeTruthy();
      expect(step.href, step.id).toMatch(/^\//);
    }
  });

  it("carries the done flag through from the server", () => {
    const presented = presentSteps(state({ "add-recipe": true }));
    expect(presented.find((s) => s.id === "add-recipe")?.done).toBe(true);
    expect(presented.find((s) => s.id === "cook")?.done).toBe(false);
  });

  it("counts what's done", () => {
    expect(completedCount(state({}))).toBe(0);
    expect(completedCount(state({ "add-recipe": true, cook: true }))).toBe(2);
  });
});

describe("nextStep", () => {
  it("points at the first outstanding step, not the one after the last done", () => {
    // Someone who cooked a recipe without ever planning a week should still be
    // nudged towards the planner rather than skipped past it.
    const skipped = state({ "add-recipe": true, cook: true });
    expect(nextStep(skipped)?.id).toBe("plan-meals");
  });

  it("starts at the beginning for a new account", () => {
    expect(nextStep(state({}))?.id).toBe("add-recipe");
  });

  it("is null once everything is done", () => {
    const all = state({
      "add-recipe": true,
      "plan-meals": true,
      "shopping-list": true,
      cook: true,
    });
    expect(nextStep(all)).toBeNull();
  });
});
