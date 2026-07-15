import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import { shoppingLists, shoppingListItems, pantryItems } from "../schema";

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
 * Upserts all checked shopping list items into the pantry, then deletes the list.
 * Matching is by name (case-insensitive) + unit (case-insensitive).
 * If a pantry item already exists, quantities are summed (when both are numeric).
 * Returns the number of pantry items created or updated.
 */
export async function completeShoppingList(
  listId: string,
  userId: string,
  householdId: string | null,
): Promise<{ pantryItemsAffected: number } | null> {
  const db = await getDb();

  const listWhere = householdId
    ? and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, householdId))
    : and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId));

  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(listWhere);
  if (!list) return null;

  const checkedItems = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.isChecked, true)));

  let affected = 0;

  const pantryOwnerWhere = householdId
    ? eq(pantryItems.householdId, householdId)
    : and(eq(pantryItems.userId, userId), isNull(pantryItems.householdId));

  for (const item of checkedItems) {
    const normName = item.name.trim();
    const normUnit = (item.unit ?? "").trim();

    const [existing] = await db
      .select()
      .from(pantryItems)
      .where(
        and(
          pantryOwnerWhere,
          sql`lower(trim(${pantryItems.name})) = lower(${normName})`,
          sql`lower(trim(coalesce(${pantryItems.unit}, ''))) = lower(${normUnit})`,
        ),
      );

    if (existing) {
      const newQty =
        existing.quantity !== null && item.quantity !== null
          ? existing.quantity + item.quantity
          : (existing.quantity ?? item.quantity ?? null);
      await db
        .update(pantryItems)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(pantryItems.id, existing.id));
    } else {
      await db.insert(pantryItems).values({
        userId,
        householdId: householdId ?? null,
        name: normName,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
      });
    }

    affected += 1;
  }

  await db.delete(shoppingLists).where(listWhere);

  return { pantryItemsAffected: affected };
}
