import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { shoppingLists, shoppingListItems } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShoppingListRecord = typeof shoppingLists.$inferSelect;
export type ShoppingListItemRecord = typeof shoppingListItems.$inferSelect;

export type CreateShoppingListInput = {
  userId: string;
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

// ── Lists ─────────────────────────────────────────────────────────────────────

export async function listShoppingLists(userId: string): Promise<ShoppingListRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .orderBy(asc(shoppingLists.createdAt));
}

export async function getShoppingListWithItems(
  id: string,
  userId: string,
): Promise<ShoppingListWithItems | null> {
  const db = getDb();
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId)));
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
  const db = getDb();
  const [list] = await db.insert(shoppingLists).values(input).returning();
  if (!list) throw new Error("Insert returned no rows");
  return list;
}

export async function updateShoppingList(
  id: string,
  userId: string,
  input: UpdateShoppingListInput,
): Promise<ShoppingListRecord | null> {
  const db = getDb();
  const [updated] = await db
    .update(shoppingLists)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteShoppingList(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(shoppingLists)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId)))
    .returning({ id: shoppingLists.id });
  return result.length > 0;
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function createShoppingListItem(
  input: CreateShoppingListItemInput,
): Promise<ShoppingListItemRecord> {
  const db = getDb();
  const [item] = await db.insert(shoppingListItems).values(input).returning();
  if (!item) throw new Error("Insert returned no rows");
  return item;
}

export async function updateShoppingListItem(
  id: string,
  listId: string,
  input: UpdateShoppingListItemInput,
): Promise<ShoppingListItemRecord | null> {
  const db = getDb();
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
  const db = getDb();
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
  const db = getDb();
  const items = await db
    .select({ orderIndex: shoppingListItems.orderIndex })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, listId))
    .orderBy(asc(shoppingListItems.orderIndex));
  if (items.length === 0) return 0;
  return (items[items.length - 1]?.orderIndex ?? -1) + 1;
}

export type BulkCreateShoppingListInput = {
  userId: string;
  name: string;
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
  }>;
};

/**
 * Creates a shopping list and bulk-inserts all items in a single transaction.
 */
export async function createShoppingListWithItems(
  input: BulkCreateShoppingListInput,
): Promise<ShoppingListWithItems> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [list] = await tx
      .insert(shoppingLists)
      .values({ userId: input.userId, name: input.name })
      .returning();

    if (!list) throw new Error("Failed to create shopping list");

    if (input.items.length === 0) {
      return { ...list, items: [] };
    }

    const items = await tx
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
  });
}
