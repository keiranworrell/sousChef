import { describe, expect, it } from "vitest";
import { permissionsFor } from "./collection-access";

/**
 * Collections can be shared with people outside the household, so every one of
 * these is the difference between offering a stranger a control over something
 * they don't own and not. The server enforces all of it anyway — these decide
 * what appears on screen, and a control that cannot succeed shouldn't.
 */

describe("permissionsFor", () => {
  it("lets an owner do everything", () => {
    expect(permissionsFor("owner")).toEqual({
      canEditRecipes: true,
      canEditCollection: true,
      canShare: true,
      canDelete: true,
    });
  });

  it("lets an editor change the contents but not the collection", () => {
    // An editor was invited to work on it, so recipes are fair game. Renaming
    // it, or making it public, changes the thing itself — and making it public
    // would publish the owner's private recipes, which is not an invited
    // editor's decision.
    const p = permissionsFor("editor");
    expect(p.canEditRecipes).toBe(true);
    expect(p.canEditCollection).toBe(false);
    expect(p.canShare).toBe(false);
    expect(p.canDelete).toBe(false);
  });

  it("lets a viewer do nothing at all", () => {
    expect(permissionsFor("viewer")).toEqual({
      canEditRecipes: false,
      canEditCollection: false,
      canShare: false,
      canDelete: false,
    });
  });

  it("never lets anyone but the owner share or delete", () => {
    // The two that pass access on or destroy the thing, checked together
    // because they are the ones with consequences beyond the current screen.
    for (const access of ["editor", "viewer"] as const) {
      expect(permissionsFor(access).canShare, access).toBe(false);
      expect(permissionsFor(access).canDelete, access).toBe(false);
    }
  });
});
