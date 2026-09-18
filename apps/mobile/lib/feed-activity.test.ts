import { describe, expect, it } from "vitest";
import type { FeedActivityType } from "@souschef/shared";
import { describeActivity } from "./feed-activity";

describe("describeActivity", () => {
  it("reads as a sentence for every type the server can send", () => {
    const types: FeedActivityType[] = ["new_recipe", "cooked_recipe"];
    for (const type of types) {
      const { verb, unknown } = describeActivity({ type });
      expect(verb, type).toBeTruthy();
      expect(unknown, type).toBe(false);
    }
  });

  it("distinguishes adding from cooking", () => {
    expect(describeActivity({ type: "new_recipe" }).verb).toBe("added");
    expect(describeActivity({ type: "cooked_recipe" }).verb).toBe("cooked");
  });

  it("degrades to something grammatical for a type it does not know", () => {
    // An installed build outlives the server it was written against. A row
    // reading "Ada  chicken pie" is worse than a vague but complete sentence.
    const future = describeActivity({ type: "invented_later" as FeedActivityType });
    expect(future.verb).toBeTruthy();
    expect(future.unknown).toBe(true);
  });
});
