import { describe, expect, it } from "vitest";
import {
  canEditCollection,
  canReadCollection,
  collapseShareRoles,
  resolveAccess,
} from "./collection-share-queries";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("who gets access to a collection", () => {
  it("gives the owner owner access", () => {
    expect(
      resolveAccess({ ownerId: OWNER, viewerId: OWNER, shareRoles: [] }),
    ).toBe("owner");
  });

  it("gives a stranger nothing", () => {
    expect(
      resolveAccess({ ownerId: OWNER, viewerId: OTHER, shareRoles: [] }),
    ).toBeNull();
  });

  it("gives a viewer share viewer access", () => {
    expect(
      resolveAccess({ ownerId: OWNER, viewerId: OTHER, shareRoles: ["viewer"] }),
    ).toBe("viewer");
  });

  it("gives an editor share editor access", () => {
    expect(
      resolveAccess({ ownerId: OWNER, viewerId: OTHER, shareRoles: ["editor"] }),
    ).toBe("editor");
  });

  it("returns null for a collection that does not exist", () => {
    // Same answer as "not yours", so probing ids tells an attacker nothing
    // about what exists.
    expect(
      resolveAccess({ ownerId: null, viewerId: OTHER, shareRoles: [] }),
    ).toBeNull();
  });

  it("does not let a share downgrade the owner", () => {
    // Reachable: a household share created before the collection changed hands,
    // or the owner being a member of a household the collection is shared with.
    expect(
      resolveAccess({ ownerId: OWNER, viewerId: OWNER, shareRoles: ["viewer"] }),
    ).toBe("owner");
  });
});

describe("overlapping grants take the most permissive", () => {
  it("prefers editor when both an editor and a viewer share exist", () => {
    // Someone individually shared with as editor who is also in a household
    // that has viewer access. The editor grant was the deliberate one.
    expect(
      resolveAccess({
        ownerId: OWNER,
        viewerId: OTHER,
        shareRoles: ["viewer", "editor"],
      }),
    ).toBe("editor");
  });

  it("does not depend on the order the grants came back in", () => {
    // The query has no ORDER BY, so a rule that depended on row order would
    // work until Postgres decided otherwise.
    expect(
      resolveAccess({
        ownerId: OWNER,
        viewerId: OTHER,
        shareRoles: ["editor", "viewer"],
      }),
    ).toBe("editor");
  });
});

describe("the role capabilities agree with the access levels", () => {
  it("lets owners and editors change a collection's recipes", () => {
    expect(canEditCollection("owner")).toBe(true);
    expect(canEditCollection("editor")).toBe(true);
  });

  it("does not let viewers change a collection", () => {
    expect(canEditCollection("viewer")).toBe(false);
  });

  it("does not let no-access change a collection", () => {
    expect(canEditCollection(null)).toBe(false);
  });

  it("lets every access level read, and no-access read nothing", () => {
    expect(canReadCollection("owner")).toBe(true);
    expect(canReadCollection("editor")).toBe(true);
    expect(canReadCollection("viewer")).toBe(true);
    expect(canReadCollection(null)).toBe(false);
  });
});

describe("collapsing duplicate grants", () => {
  const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("keeps one row per collection", () => {
    const result = collapseShareRoles([
      { collectionId: A, role: "viewer" },
      { collectionId: A, role: "viewer" },
    ]);
    expect(result).toEqual([{ collectionId: A, role: "viewer" }]);
  });

  it("keeps editor when editor comes first", () => {
    expect(
      collapseShareRoles([
        { collectionId: A, role: "editor" },
        { collectionId: A, role: "viewer" },
      ]),
    ).toEqual([{ collectionId: A, role: "editor" }]);
  });

  it("keeps editor when editor comes second", () => {
    // The same order-independence resolveAccess needs, for the same reason.
    expect(
      collapseShareRoles([
        { collectionId: A, role: "viewer" },
        { collectionId: A, role: "editor" },
      ]),
    ).toEqual([{ collectionId: A, role: "editor" }]);
  });

  it("keeps collections separate", () => {
    const result = collapseShareRoles([
      { collectionId: A, role: "viewer" },
      { collectionId: B, role: "editor" },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ collectionId: A, role: "viewer" });
    expect(result).toContainEqual({ collectionId: B, role: "editor" });
  });

  it("returns nothing for no grants", () => {
    expect(collapseShareRoles([])).toEqual([]);
  });
});

describe("the two rules agree with each other", () => {
  it("collapse and resolve reach the same verdict on the same grants", () => {
    // These are separate implementations of "most permissive wins". If they
    // ever disagree, a collection shows as read-only in the list but turns out
    // to be editable when opened, or the reverse — which is the sort of
    // inconsistency that becomes a security bug rather than a display bug.
    const cases: ("viewer" | "editor")[][] = [
      ["viewer"],
      ["editor"],
      ["viewer", "editor"],
      ["editor", "viewer"],
      ["viewer", "viewer"],
      ["editor", "editor"],
    ];

    for (const roles of cases) {
      const viaResolve = resolveAccess({
        ownerId: OWNER,
        viewerId: OTHER,
        shareRoles: roles,
      });
      const [collapsed] = collapseShareRoles(
        roles.map((role) => ({ collectionId: "c", role })),
      );
      expect(collapsed?.role).toBe(viaResolve);
    }
  });
});
