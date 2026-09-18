import type { Household } from "@souschef/shared";

/**
 * What leaving a household actually does, which is three different things.
 *
 * `POST /households/me/leave` is one endpoint with one button, and the outcome
 * depends on facts the user cannot see from the button: the last member out
 * dissolves the household and everything shared through it, and an owner who
 * leaves hands ownership to whoever joined earliest. Both are irreversible and
 * neither is guessable, so the confirmation has to say which one is about to
 * happen.
 *
 * Kept out of the screen because it is the part worth testing — getting the
 * owner and last-member cases the wrong way round would delete someone's data
 * behind a message promising it wouldn't.
 */

export type LeaveConsequence = {
  title: string;
  message: string;
  /** True when leaving destroys shared data rather than just removing you. */
  destructive: boolean;
};

export function leaveConsequence(
  household: Household,
  currentUserId: string,
): LeaveConsequence {
  const isOwner = household.ownerId === currentUserId;

  // Checked before ownership: a sole member is always the owner, and "you are
  // the last one out" is the more important of the two facts.
  if (household.members.length <= 1) {
    return {
      title: `Leave and delete ${household.name}?`,
      message:
        "You're the only member, so the household will be deleted along with everything shared through it. This can't be undone.",
      destructive: true,
    };
  }

  if (isOwner) {
    return {
      title: `Leave ${household.name}?`,
      message:
        "You own this household. Ownership passes to whoever joined earliest, and you'll lose access to anything shared through it.",
      destructive: false,
    };
  }

  return {
    title: `Leave ${household.name}?`,
    message: "You'll lose access to anything shared through this household.",
    destructive: false,
  };
}

/**
 * Whether the current user may rename or delete the household.
 *
 * The server enforces both; this only decides whether to draw the control. An
 * owner-only action offered to a member is a button that fails, which is worse
 * than an absent one — the same reasoning as the collection permission rules.
 */
export function isOwner(household: Household, currentUserId: string): boolean {
  return household.ownerId === currentUserId;
}
