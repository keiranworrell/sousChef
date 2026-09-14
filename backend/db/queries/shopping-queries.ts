import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import { shoppingLists, shoppingListItems } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShoppingListRecord = typeof shoppingLists.$inferSelect;
export type ShoppingListItemRecord = typeof shoppingListItems.$inferSelect;

export type CreateShoppingListInput = {
  userId: string;
  householdId?: string | null;
  name: string;
};

export type UpdateShoppingListInput = {
  name?: string;
};

export type CreateShoppingListItemInput = {
  shoppingListId: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  orderIndex: number;
};

export type UpdateShoppingListItemInput = Partial<
  Omit<CreateShoppingListItemInput, "shoppingListId">
> & { isChecked?: boolean };

export type ShoppingListWithItems = ShoppingListRecord & {
  items: ShoppingListItemRecord[];
};

// ── Ownership helper ──────────────────────────────────────────────────────────

function ownerWhere(userId: string, householdId: string | null) {
  return householdId
    ? eq(shoppingLists.householdId, householdId)
    : and(eq(shoppingLists.userId, userId), isNull(shoppingLists.householdId));
}

// ── Lists ─────────────────────────────────────────────────────────────────────

export async function listShoppingLists(
  userId: string,
  householdId: string | null,
): Promise<ShoppingListRecord[]> {
  const db = await getDb();
  return db
    .select()
    .from(shoppingLists)
    .where(ownerWhere(userId, householdId))
    .orderBy(asc(shoppingLists.createdAt));
}

export async function getShoppingListWithItems(
  id: string,
  userId: string,
  householdId: string | null,
): Promise<ShoppingListWithItems | null> {
  const db = await getDb();
  const where = householdId
    ? and(eq(shoppingLists.id, id), eq(shoppingLists.householdId, householdId))
    : and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId));

  const [list] = await db.select().from(shoppingLists).where(where);
  if (!list) return null;

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, id))
    .orderBy(asc(shoppingListItems.orderIndex));

  return { ...list, items };
}

export async function createShoppingList(
  input: CreateShoppingListInput,
): Promise<ShoppingListRecord> {
  const db = await getDb();
  const [list] = await db.insert(shoppingLists).values(input).returning();
  if (!list) throw new Error("Insert returned no rows");
  return list;
}

export async function updateShoppingList(
  id: string,
  userId: string,
  householdId: string | null,
  input: UpdateShoppingListInput,
): Promise<ShoppingListRecord | null> {
  const db = await getDb();
  const where = householdId
    ? and(eq(shoppingLists.id, id), eq(shoppingLists.householdId, householdId))
    : and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId));
  const [updated] = await db
    .update(shoppingLists)
    .set({ ...input, updatedAt: new Date() })
    .where(where)
    .returning();
  return updated ?? null;
}

export async function deleteShoppingList(
  id: string,
  userId: string,
  householdId: string | null,
): Promise<boolean> {
  const db = await getDb();
  const where = householdId
    ? and(eq(shoppingLists.id, id), eq(shoppingLists.householdId, householdId))
    : and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId));
  const result = await db
    .delete(shoppingLists)
    .where(where)
    .returning({ id: shoppingLists.id });
  return result.length > 0;
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function createShoppingListItem(
  input: CreateShoppingListItemInput,
): Promise<ShoppingListItemRecord> {
  const db = await getDb();
  const [item] = await db.insert(shoppingListItems).values(input).returning();
  if (!item) throw new Error("Insert returned no rows");
  return item;
}

export async function updateShoppingListItem(
  id: string,
  listId: string,
  input: UpdateShoppingListItemInput,
): Promise<ShoppingListItemRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(shoppingListItems)
    .set(input)
    .where(
      and(
        eq(shoppingListItems.id, id),
        eq(shoppingListItems.shoppingListId, listId),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function deleteShoppingListItem(
  id: string,
  listId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.id, id),
        eq(shoppingListItems.shoppingListId, listId),
      ),
    )
    .returning({ id: shoppingListItems.id });
  return result.length > 0;
}

export async function getNextOrderIndex(listId: string): Promise<number> {
  const db = await getDb();
  const items = await db
    .select({ orderIndex: shoppingListItems.orderIndex })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, listId))
    .orderBy(asc(shoppingListItems.orderIndex));
  if (items.length === 0) return 0;
  return (items[items.length - 1]?.orderIndex ?? -1) + 1;
}

export async function bulkAddShoppingListItems(
  listId: string,
  items: Array<{ name: string; quantity?: number | null; unit?: string | null }>,
  startOrderIndex: number,
): Promise<ShoppingListItemRecord[]> {
  const db = await getDb();
  return db
    .insert(shoppingListItems)
    .values(
      items.map((item, i) => ({
        shoppingListId: listId,
        name: item.name,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        orderIndex: startOrderIndex + i,
      })),
    )
    .returning();
}

export type BulkCreateShoppingListInput = {
  userId: string;
  householdId?: string | null;
  name: string;
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
  }>;
};

/**
 * Creates a shopping list and bulk-inserts all items.
 */
export async function createShoppingListWithItems(
  input: BulkCreateShoppingListInput,
): Promise<ShoppingListWithItems> {
  const db = await getDb();

  const [list] = await db
    .insert(shoppingLists)
    .values({ userId: input.userId, householdId: input.householdId ?? null, name: input.name })
    .returning();

  if (!list) throw new Error("Failed to create shopping list");

  if (input.items.length === 0) {
    return { ...list, items: [] };
  }

  const items = await db
    .insert(shoppingListItems)
    .values(
      input.items.map((item, i) => ({
        shoppingListId: list.id,
        name: item.name,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        orderIndex: i,
      })),
    )
    .returning();

  return { ...list, items };
}

/**
 * Marks a shopping list finished by deleting it.
 *
 * This previously upserted every checked item into the pantry before deleting.
 * With pantry tracking removed, completing a list simply closes it — there is
 * nowhere for the bought items to go, and inventing a destination would be
 * guessing at a workflow the user hasn't asked for.
 *
 * Returns the number of checked items so the caller can confirm what was
 * completed; null when the list isn't the caller's.
 */
export async function completeShoppingList(
  listId: string,
  userId: string,
  householdId: string | null,
): Promise<{ itemsCompleted: number } | null> {
  const db = await getDb();

  const listWhere = householdId
    ? and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, householdId))
    : and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId));

  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(listWhere);
  if (!list) return null;

  const [checked] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(shoppingListItems)
    .where(
      and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.isChecked, true)),
    );

  // Items cascade with the list
  await db.delete(shoppingLists).where(listWhere);

  return { itemsCompleted: checked?.count ?? 0 };
}
