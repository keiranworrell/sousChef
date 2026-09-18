import type { FeedActivity } from "@souschef/shared";

/**
 * What a feed row says.
 *
 * Split into three pieces rather than one string because the name and the
 * recipe title are both bold and both tappable, and a pre-joined sentence
 * would have to be picked apart again to do that.
 *
 * The verb is the whole content of the row, so an unrecognised activity type
 * has to degrade to something that still reads as English. A build older than
 * the server will meet types it has never heard of, and "Ada  chicken pie" is
 * worse than a vague but grammatical sentence.
 */

export type FeedSentence = {
  /** Between the person's name and the recipe title. */
  verb: string;
  /** True when this build did not recognise the activity type. */
  unknown: boolean;
};

export function describeActivity(activity: Pick<FeedActivity, "type">): FeedSentence {
  switch (activity.type) {
    case "new_recipe":
      return { verb: "added", unknown: false };
    case "cooked_recipe":
      return { verb: "cooked", unknown: false };
    default:
      return { verb: "was busy with", unknown: true };
  }
}
