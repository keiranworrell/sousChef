import { and, eq, desc } from "drizzle-orm";
import { getDb } from "../client";
import { pantryItems } from "../schema";

export type PantryItemRecord = typeof pantryItems.$inferSelect;

export type CreatePantryItemInput = {
  userId: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  expiryDate?: Date | null;
  lowStockThreshold?: number | null;
};

export type UpdatePantryItemInput = Partial<
  Omit<CreatePantryItemInput, "userId">
>;

export async function listPantryItems(userId: string): Promise<PantryItemRecord[]> {
  const db = await getDb();
  return db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId))
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

export async function updatePantryItem(
  id: string,
  userId: string,
  input: UpdatePantryItemInput,
): Promise<PantryItemRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(pantryItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deletePantryItem(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .returning({ id: pantryItems.id });
  return result.length > 0;
}
