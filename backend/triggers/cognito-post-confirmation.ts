import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { createUser, getUserByCognitoId } from "../db/queries/user-queries";

/**
 * Cognito post-confirmation Lambda trigger.
 *
 * Fires after a user successfully verifies their email address.
 * Creates the corresponding row in our users table so the rest of
 * the app can reference users by their internal UUID.
 *
 * Cognito requires this handler to return the event unchanged.
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  const { sub, email, name } = event.request.userAttributes;

  if (!sub || !email) {
    console.error("post-confirmation trigger missing sub or email", {
      sub,
      email,
    });
    return event;
  }

  // Guard against duplicate triggers — Cognito can fire this more than once
  // in rare cases (e.g. if the Lambda times out and Cognito retries).
  const existing = await getUserByCognitoId(sub);
  if (existing) {
    console.info("user already exists, skipping insert", { cognitoId: sub });
    return event;
  }

  // Use the Cognito `name` attribute if present, fall back to the email prefix.
  const displayName = name ?? email.split("@")[0] ?? email;

  await createUser({ cognitoId: sub, email, displayName });
  console.info("created user record", { cognitoId: sub, email });

  return event;
};
