import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { users } from "../schema";

export type CreateUserInput = {
  cognitoId: string;
  email: string;
  displayName: string;
};

export type UserRecord = typeof users.$inferSelect;

/**
 * Creates a new user row. Returns the created record.
 * Throws if a user with the same cognitoId or email already exists.
 */
export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const db = await getDb();
  const [user] = await db.insert(users).values(input).returning();
  if (!user) throw new Error("Insert returned no rows");
  return user;
}

/**
 * Finds a user by their Cognito sub. Returns null if not found.
 */
export async function getUserByCognitoId(
  cognitoId: string,
): Promise<UserRecord | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoId, cognitoId))
    .limit(1);
  return user ?? null;
}

export type UpdateUserInput = {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dietaryPreferences?: string[] | null;
};

/**
 * Brings the stored email into line with the one Cognito has verified.
 *
 * Deliberately separate from updateUser, and deliberately not reachable from
 * PATCH /users/me. Email is the one profile field a user must not be able to
 * set by asserting it: our copy is a cache of a fact Cognito owns, and Cognito
 * only changes it after the user has proved control of the new address by
 * entering a code sent to it. The only trustworthy source is the verified token
 * claim, so that is the only thing that may call this.
 *
 * Returns null when nothing needed changing, so callers can tell a no-op from
 * an update without comparing rows themselves.
 */
export async function syncUserEmail(
  id: string,
  verifiedEmail: string,
): Promise<UserRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({ email: verifiedEmail, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
}

/**
 * Spends one AI import credit.
 *
 * Incremented in SQL rather than read-modify-written, so two imports finishing
 * at the same time can't both write the same value and lose one.
 *
 * Call this only after the import has actually succeeded. A credit burned on a
 * paywalled page or a model failure is the user paying for our problem, and
 * with five of them the difference is very noticeable.
 *
 * The check-then-spend pair is not atomic overall: two requests could both pass
 * assertAiImportAllowed at four used and both succeed, leaving six. That is
 * deliberate. Closing it would mean holding a row lock across a call to the
 * Anthropic API, and the failure it prevents is a user occasionally getting one
 * extra free import — which is the direction you want to be wrong in.
 */
export async function incrementAiImportCount(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(users)
    .set({ aiImportCount: sql`${users.aiImportCount} + 1`, updatedAt: new Date() })
    .where(eq(users.id, id));
}

/**
 * Deletes a user row by internal ID. All related data is removed via CASCADE.
 */
export async function deleteUser(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(users).where(eq(users.id, id));
}

/**
 * Updates a user's profile fields. Returns the updated record or null if not found.
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
}
