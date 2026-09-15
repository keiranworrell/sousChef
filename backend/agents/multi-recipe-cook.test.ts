import { describe, expect, it } from "vitest";
import {
  sequentialPlan,
  validatePlan,
  type PlannableRecipe,
} from "./multi-recipe-cook";

const CURRY = "11111111-1111-1111-1111-111111111111";
const RICE = "22222222-2222-2222-2222-222222222222";

const recipes: PlannableRecipe[] = [
  {
    id: CURRY,
    title: "Chicken curry",
    servings: 4,
    steps: [
      { stepNumber: 1, instruction: "Fry the onions", timerSeconds: 600 },
      { stepNumber: 2, instruction: "Add spices", timerSeconds: null },
      { stepNumber: 3, instruction: "Simmer", timerSeconds: 1800 },
    ],
  },
  {
    id: RICE,
    title: "Basmati rice",
    servings: 4,
    steps: [
      { stepNumber: 1, instruction: "Rinse the rice", timerSeconds: null },
      { stepNumber: 2, instruction: "Boil", timerSeconds: 600 },
    ],
  },
];

/** Every step, correctly interleaved. */
const validPlan = [
  { recipeId: CURRY, stepNumber: 1 },
  { recipeId: RICE, stepNumber: 1 },
  { recipeId: CURRY, stepNumber: 2 },
  { recipeId: CURRY, stepNumber: 3 },
  { recipeId: RICE, stepNumber: 2 },
];

describe("a plan that matches the recipes is accepted", () => {
  it("accepts a correct interleaving", () => {
    expect(validatePlan(validPlan, recipes)).toEqual([]);
  });

  it("accepts steps of different recipes in any relative order", () => {
    // Interleaving between recipes is the entire point; only a recipe's own
    // internal order is fixed.
    const reshuffled = [
      { recipeId: RICE, stepNumber: 1 },
      { recipeId: RICE, stepNumber: 2 },
      { recipeId: CURRY, stepNumber: 1 },
      { recipeId: CURRY, stepNumber: 2 },
      { recipeId: CURRY, stepNumber: 3 },
    ];
    expect(validatePlan(reshuffled, recipes)).toEqual([]);
  });
});

describe("a plan that invents things is rejected", () => {
  it("rejects a step number that does not exist", () => {
    // The shape of a hallucination: plausible, and wrong.
    const failures = validatePlan(
      [...validPlan, { recipeId: CURRY, stepNumber: 9 }],
      recipes,
    );
    expect(failures).toContainEqual({
      kind: "unknown-step",
      recipeId: CURRY,
      stepNumber: 9,
    });
  });

  it("rejects a recipe id that was never supplied", () => {
    const failures = validatePlan(
      [...validPlan, { recipeId: "99999999-9999-9999-9999-999999999999", stepNumber: 1 }],
      recipes,
    );
    expect(failures).toContainEqual({
      kind: "unknown-recipe",
      recipeId: "99999999-9999-9999-9999-999999999999",
    });
  });
});

describe("a plan that loses or repeats work is rejected", () => {
  it("rejects a dropped step", () => {
    // The dangerous failure: nothing on screen looks wrong, the user simply
    // never seasons the sauce.
    const missing = validPlan.filter(
      (s) => !(s.recipeId === CURRY && s.stepNumber === 2),
    );
    expect(validatePlan(missing, recipes)).toContainEqual({
      kind: "missing-steps",
      count: 1,
    });
  });

  it("reports how many steps went missing", () => {
    expect(validatePlan([{ recipeId: CURRY, stepNumber: 1 }], recipes)).toContainEqual({
      kind: "missing-steps",
      count: 4,
    });
  });

  it("rejects a repeated step", () => {
    const failures = validatePlan(
      [...validPlan, { recipeId: RICE, stepNumber: 2 }],
      recipes,
    );
    expect(failures).toContainEqual({
      kind: "duplicate-step",
      recipeId: RICE,
      stepNumber: 2,
    });
  });

  it("rejects an empty plan", () => {
    expect(validatePlan([], recipes)).toContainEqual({ kind: "missing-steps", count: 5 });
  });
});

describe("a recipe's own steps may not be reordered", () => {
  it("rejects step 3 coming before step 2 of the same recipe", () => {
    // Interleaving is allowed; rearranging somebody's procedure is not. Adding
    // spices after simmering is a different dish.
    const reordered = [
      { recipeId: CURRY, stepNumber: 1 },
      { recipeId: CURRY, stepNumber: 3 },
      { recipeId: CURRY, stepNumber: 2 },
      { recipeId: RICE, stepNumber: 1 },
      { recipeId: RICE, stepNumber: 2 },
    ];
    expect(validatePlan(reordered, recipes)).toContainEqual({
      kind: "out-of-order",
      recipeId: CURRY,
      stepNumber: 2,
    });
  });
});

describe("the fallback plan", () => {
  it("includes every step exactly once", () => {
    const plan = sequentialPlan(recipes);
    expect(validatePlan(plan.steps, recipes)).toEqual([]);
  });

  it("keeps each recipe's steps together and in order", () => {
    const plan = sequentialPlan(recipes);
    expect(plan.steps.map((s) => `${s.recipeId}:${s.stepNumber}`)).toEqual([
      `${CURRY}:1`,
      `${CURRY}:2`,
      `${CURRY}:3`,
      `${RICE}:1`,
      `${RICE}:2`,
    ]);
  });

  it("only counts time it can actually know about", () => {
    // 10 min + 30 min of timers on the curry, 10 on the rice. Hands-on time is
    // deliberately not guessed at.
    expect(sequentialPlan(recipes).totalMinutes).toBe(50);
  });

  it("never moves backwards in time", () => {
    const offsets = sequentialPlan(recipes).steps.map((s) => s.startOffsetMinutes);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });
});
