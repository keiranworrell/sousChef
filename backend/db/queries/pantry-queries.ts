import { and, eq, desc, isNull, or } from "drizzle-orm";
import { getDb } from "../client";
import { pantryItems } from "../schema";

export type PantryItemRecord = typeof pantryItems.$inferSelect;

export type CreatePantryItemInput = {
  userId: string;
  householdId?: string | null;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  expiryDate?: Date | null;
  lowStockThreshold?: number | null;
};

export type UpdatePantryItemInput = Partial<
  Omit<CreatePantryItemInput, "userId" | "householdId">
>;

/**
 * Lists pantry items.
 * When householdId is provided, returns items belonging to the household.
 * Otherwise returns the user's personal items (no household_id).
 */
export async function listPantryItems(
  userId: string,
  householdId: string | null,
): Promise<PantryItemRecord[]> {
  const db = await getDb();
  const where = householdId
    ? eq(pantryItems.householdId, householdId)
    : and(eq(pantryItems.userId, userId), isNull(pantryItems.householdId));
  return db
    .select()
    .from(pantryItems)
    .where(where)
    .orderBy(desc(pantryItems.updatedAt));
}

export async function createPantryItem(
  input: CreatePantryItemInput,
): Promise<PantryItemRecord> {
  const db = await getDb();
  const [item] = await db.insert(pantryItems).values(input).returning();
  if (!item) throw new Error("Insert returned no rows");
  return item;
}

/**
 * Updates a pantry item.
 * Authorises by household membership when householdId is set, otherwise by userId.
 */
export async function updatePantryItem(
  id: string,
  userId: string,
  householdId: string | null,
  input: UpdatePantryItemInput,
): Promise<PantryItemRecord | null> {
  const db = await getDb();
  const where = householdId
    ? and(eq(pantryItems.id, id), eq(pantryItems.householdId, householdId))
    : and(eq(pantryItems.id, id), eq(pantryItems.userId, userId));
  const [updated] = await db
    .update(pantryItems)
    .set({ ...input, updatedAt: new Date() })
    .where(where)
    .returning();
  return updated ?? null;
}

/**
 * Deletes a pantry item.
 * Authorises by household membership when householdId is set, otherwise by userId.
 */
export async function deletePantryItem(
  id: string,
  userId: string,
  householdId: string | null,
): Promise<boolean> {
  const db = await getDb();
  const where = householdId
    ? and(eq(pantryItems.id, id), eq(pantryItems.householdId, householdId))
    : and(eq(pantryItems.id, id), eq(pantryItems.userId, userId));
  const result = await db
    .delete(pantryItems)
    .where(where)
    .returning({ id: pantryItems.id });
  return result.length > 0;
}

/**
 * Returns pantry items matching any of the given ingredient names (case-insensitive).
 * Used by shopping-list generation to deduct items already in the pantry.
 */
export async function getPantryItemsByNames(
  userId: string,
  householdId: string | null,
  names: string[],
): Promise<PantryItemRecord[]> {
  if (names.length === 0) return [];
  const db = await getDb();
  const ownerWhere = householdId
    ? eq(pantryItems.householdId, householdId)
    : and(eq(pantryItems.userId, userId), isNull(pantryItems.householdId));
  return db
    .select()
    .from(pantryItems)
    .where(ownerWhere);
}
