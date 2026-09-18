import { describe, expect, it } from "vitest";
import { FREE_TIER_AI_IMPORTS } from "@souschef/shared";
import { aiCreditStatus, cookPlanNotice } from "./ai-credits";

describe("aiCreditStatus", () => {
  it("is unknown before the user has loaded", () => {
    // Not exhausted. Treating "not loaded" as "out of credits" would disable
    // the button for everyone for the first second of the screen.
    expect(aiCreditStatus(undefined).kind).toBe("unknown");
    expect(aiCreditStatus(null).kind).toBe("unknown");
  });

  it("is unlimited on premium", () => {
    expect(aiCreditStatus({ planTier: "premium", aiImportsRemaining: null }).kind)
      .toBe("unlimited");
  });

  it("treats a null remaining as unlimited whatever the tier says", () => {
    // The field's own contract is "null means no limit". If the two ever
    // disagree, drawing a counter with nothing to count is the worse failure.
    expect(aiCreditStatus({ planTier: "free", aiImportsRemaining: null }).kind)
      .toBe("unlimited");
  });

  it("reports what is left on a free account", () => {
    expect(aiCreditStatus({ planTier: "free", aiImportsRemaining: 3 }))
      .toEqual({ kind: "available", remaining: 3 });
  });

  it("is exhausted at zero", () => {
    expect(aiCreditStatus({ planTier: "free", aiImportsRemaining: 0 }).kind)
      .toBe("exhausted");
  });

  it("is exhausted below zero too", () => {
    // The check-then-spend pair is deliberately not atomic server-side, so a
    // negative remainder is reachable. It is still just "out".
    expect(aiCreditStatus({ planTier: "free", aiImportsRemaining: -1 }).kind)
      .toBe("exhausted");
  });
});

describe("cookPlanNotice", () => {
  it("says nothing to a premium user or before loading", () => {
    expect(cookPlanNotice({ kind: "unlimited" })).toBeNull();
    expect(cookPlanNotice({ kind: "unknown" })).toBeNull();
  });

  it("names the cost without blocking when credits remain", () => {
    const notice = cookPlanNotice({ kind: "available", remaining: 3 });
    expect(notice?.blocking).toBe(false);
    expect(notice?.text).toContain("3");
  });

  it("does not say '1 remaining credits'", () => {
    expect(cookPlanNotice({ kind: "available", remaining: 1 })?.text)
      .toBe("Planning uses your last free AI credit.");
  });

  it("blocks when exhausted, and does not promise a fallback", () => {
    // The whole reason this module exists. The server throws before the
    // sequential fallback is reached, so telling the user the recipes will
    // still be laid out in order would be a lie the request then disproves.
    const notice = cookPlanNotice({ kind: "exhausted" });
    expect(notice?.blocking).toBe(true);
    expect(notice?.text).toContain(String(FREE_TIER_AI_IMPORTS));
    expect(notice?.text).not.toMatch(/one after another|in order|sequential/i);
  });

  it("offers a way forward when blocking", () => {
    // Cooking each recipe on its own still works and costs nothing. A dead end
    // with no alternative is what makes a quota feel punitive.
    expect(cookPlanNotice({ kind: "exhausted" })?.text).toMatch(/one at a time/i);
  });
});
