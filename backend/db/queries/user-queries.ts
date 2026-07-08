import { eq } from "drizzle-orm";
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
  const db = getDb();
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
  const db = getDb();
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
 * Updates a user's profile fields. Returns the updated record or null if not found.
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserRecord | null> {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
}
