import { describe, it, expect } from "vitest";
import { normaliseIngredientName as n } from "./ingredient-name";

describe("normaliseIngredientName — the reported duplicates", () => {
  it('merges "salt" with "salt, a sprinkle"', () => {
    expect(n("salt")).toBe(n("salt, a sprinkle"));
  });

  it('merges "mince" with "93/7 ground beef"', () => {
    expect(n("mince")).toBe(n("93/7 ground beef"));
  });
});

describe("lexical cleanup", () => {
  it("strips trailing qualifiers after a comma", () => {
    expect(n("onion, finely chopped")).toBe("onion");
    expect(n("butter, melted")).toBe("butter");
    expect(n("flour, plus extra for dusting")).toBe("flour");
  });

  it("strips parentheticals", () => {
    expect(n("flour (plain)")).toBe("flour");
    expect(n("milk (whole)")).toBe("milk");
  });

  it("strips leading numbers, fractions and ratios", () => {
    expect(n("93/7 ground beef")).toBe("beef mince");
    expect(n("00 flour")).toBe("flour");
    expect(n("2% milk")).toBe("milk");
  });

  it("is case and whitespace insensitive", () => {
    expect(n("  Plain  Flour ")).toBe(n("plain flour"));
  });

  it("strips preparation adjectives", () => {
    expect(n("finely chopped onion")).toBe("onion");
    expect(n("grated cheddar")).toBe("cheddar");
    expect(n("large eggs")).toBe("egg");
  });

  it("returns empty for input with no usable name", () => {
    expect(n("")).toBe("");
    expect(n("   ")).toBe("");
    expect(n("123")).toBe("");
  });
});

describe("plurals", () => {
  it("singularises regular plurals", () => {
    expect(n("onions")).toBe("onion");
    expect(n("carrots")).toBe("carrot");
    expect(n("eggs")).toBe("egg");
  });

  it("handles -oes and -ies", () => {
    expect(n("tomatoes")).toBe("tomato");
    expect(n("potatoes")).toBe("potato");
    expect(n("cherries")).toBe("cherry");
  });

  it("leaves singular words that end in s alone", () => {
    // These would become "molasse", "hummu", "asparagu" under a naive rule —
    // and worse, would then fail to match themselves.
    expect(n("molasses")).toBe("molasses");
    expect(n("hummus")).toBe("hummus");
    expect(n("asparagus")).toBe("asparagus");
    expect(n("couscous")).toBe("couscous");
    expect(n("watercress")).toBe("watercress");
  });

  it("leaves plural-only foods alone", () => {
    expect(n("oats")).toBe("oats");
    expect(n("chives")).toBe("chives");
    expect(n("capers")).toBe("capers");
  });
});

describe("synonyms — UK/US pairs", () => {
  it.each([
    ["cilantro", "coriander"],
    ["eggplant", "aubergine"],
    ["zucchini", "courgette"],
    ["arugula", "rocket"],
    ["scallion", "spring onion"],
    ["all purpose flour", "plain flour"],
    ["confectioners sugar", "icing sugar"],
    ["baking soda", "bicarbonate of soda"],
    ["cornstarch", "cornflour"],
    ["heavy cream", "double cream"],
  ])("%s → %s", (input, expected) => {
    expect(n(input)).toBe(expected);
  });

  it("matches synonyms through plurals and preparation words", () => {
    expect(n("chopped scallions")).toBe("spring onion");
    expect(n("garbanzo beans, drained")).toBe("chickpea");
  });

  it("maps every ground-meat variant to the same key", () => {
    const beef = n("beef mince");
    expect(n("ground beef")).toBe(beef);
    expect(n("minced beef")).toBe(beef);
    expect(n("hamburger meat")).toBe(beef);
  });
});

describe("does not over-merge", () => {
  // The failure that matters most: merging two things you'd buy separately is
  // worse than leaving a duplicate on the list.
  it("keeps ground beef distinct from beef", () => {
    expect(n("ground beef")).not.toBe(n("beef"));
  });

  it("keeps dried and fresh herbs distinct", () => {
    expect(n("dried basil")).not.toBe(n("fresh basil"));
  });

  it("keeps smoked and unsmoked distinct", () => {
    expect(n("smoked paprika")).not.toBe(n("paprika"));
  });

  it("keeps sun-dried tomatoes distinct from tomatoes", () => {
    expect(n("sun-dried tomatoes")).not.toBe(n("tomatoes"));
  });

  it("keeps different flours distinct", () => {
    expect(n("plain flour")).not.toBe(n("strong bread flour"));
  });
});
