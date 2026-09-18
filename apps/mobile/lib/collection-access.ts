import type { CollectionAccess } from "@souschef/shared";

/**
 * What each level of access may actually do.
 *
 * Kept in one place rather than as `access === "owner"` checks scattered
 * through the screens. Those drift: one control asks for owner, the next
 * accidentally accepts editor, and the difference only shows up when somebody
 * taps a button that fails. Collections can be shared with people outside the
 * household, so getting this wrong shows a stranger a control over a thing they
 * do not own.
 *
 * The server enforces all of this regardless. These flags decide what is
 * *offered* — a control that cannot succeed should not be on screen, because a
 * button that does nothing is worse than an absent one.
 */
export type CollectionPermissions = {
  /** Add recipes to it, or take them out. */
  canEditRecipes: boolean;
  /** Rename it, change its description, make it public. */
  canEditCollection: boolean;
  /** Share it with someone, change a role, revoke access. */
  canShare: boolean;
  /** Delete the whole thing. */
  canDelete: boolean;
};

export function permissionsFor(access: CollectionAccess): CollectionPermissions {
  const isOwner = access === "owner";
  return {
    // An editor was given the collection to work on, so they may change what is
    // in it.
    canEditRecipes: isOwner || access === "editor",
    // But not what it is. Renaming someone else's collection, or making it
    // public, changes the thing itself rather than its contents — and making it
    // public would publish the owner's private recipes, which is not a decision
    // an invited editor gets to make.
    canEditCollection: isOwner,
    // Passing access on belongs to whoever owns the thing.
    canShare: isOwner,
    canDelete: isOwner,
  };
}
