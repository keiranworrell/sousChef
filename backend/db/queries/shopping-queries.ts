import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import { shoppingLists, shoppingListItems } from "../schema";
import { combineQuantities, extrasSuffix } from "./unit-math";

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

export type MergeableItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  orderIndex: number;
};

export type MergePlan = {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  orderIndex: number;
};

/**
 * Works out what the merged row should contain. Pure, so the decisions below
 * can be tested without a list to merge.
 *
 * The automatic aggregation catches predictable pairs via the synonym table.
 * This is for the long tail it cannot know about — "scallions" and "spring
 * onions", or two brands of the same thing — where the user is the only one
 * who can say they are one purchase. They pick the surviving name themselves,
 * because they are reaching for this precisely when the automatic naming rule
 * got it wrong, and applying that same rule again would be no help.
 */
export function planItemMerge(items: MergeableItem[], chosenName: string): MergePlan {
  const combined = combineQuantities(items);

  return {
    // The suffix carries amounts that could not be added to the primary unit,
    // matching how the automatic path writes them. Dropping them would lose
    // information the user never asked to lose.
    name: chosenName.trim() + extrasSuffix(combined.extras),
    quantity: combined.quantity,
    unit: combined.unit,
    // First category anything had. They are nearly always identical — these are
    // the same purchase — and a null would drop the row out of its aisle.
    category: items.find((i) => i.category !== null)?.category ?? null,
    // Checked only if every part was. Merging something bought with something
    // still needed gives a line you still need, and marking it done would quietly
    // remove it from the list while you are standing in the shop.
    isChecked: items.every((i) => i.isChecked),
    // Sits where the earliest of them sat, rather than jumping to the bottom.
    orderIndex: Math.min(...items.map((i) => i.orderIndex)),
  };
}

/**
 * Merges two or more items on a list into one.
 *
 * Returns null when the ids do not all belong to this list, or when fewer than
 * two survive that check — the same answer as "not found", because a caller
 * passing another list's item id should learn nothing about whether it exists.
 */
export async function mergeShoppingListItems(
  listId: string,
  itemIds: string[],
  chosenName: string,
): Promise<ShoppingListItemRecord | null> {
  if (itemIds.length < 2) return null;

  const db = await getDb();

  // Scoped to the list, so ids belonging elsewhere simply do not come back.
  const items = await db
    .select()
    .from(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.shoppingListId, listId),
        inArray(shoppingListItems.id, itemIds),
      ),
    );

  // Every id has to resolve. A partial match means the caller sent something
  // that is not theirs, and merging the remainder would be a surprising
  // interpretation of a request that was wrong.
  if (items.length !== new Set(itemIds).size) return null;

  const plan = planItemMerge(items, chosenName);

  // The lowest-ordered row survives so the merged line keeps its place; the
  // rest go. Updating one and deleting the others, rather than deleting all and
  // inserting fresh, means the survivor keeps its id — so anything holding a
  // reference to it still resolves.
  const survivor = items.reduce((a, b) => (a.orderIndex <= b.orderIndex ? a : b));
  const doomed = items.filter((i) => i.id !== survivor.id).map((i) => i.id);

  const [updated] = await db
    .update(shoppingListItems)
    .set(plan)
    .where(eq(shoppingListItems.id, survivor.id))
    .returning();

  if (!updated) return null;

  await db.delete(shoppingListItems).where(inArray(shoppingListItems.id, doomed));

  return updated;
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
