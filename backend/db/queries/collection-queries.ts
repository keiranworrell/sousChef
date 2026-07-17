import { and, eq, desc, inArray } from "drizzle-orm";
import { getDb } from "../client";
import { collections, collectionItems, recipes, recipeTags, users } from "../schema";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CollectionRecord = typeof collections.$inferSelect;

export type CollectionRecipeItem = {
  recipeId: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cookTimeMinutes: number | null;
  isPublic: boolean;
  tags: string[];
  addedAt: Date;
};

export type CollectionWithItems = CollectionRecord & {
  items: CollectionRecipeItem[];
  recipeCount: number;
};

export type CollectionSummary = CollectionRecord & {
  recipeCount: number;
  /** Cover image — first recipe image in the collection, if any. */
  coverImageUrl: string | null;
};

export type PublicCollectionSummary = CollectionSummary & {
  ownerName: string;
  ownerId: string;
};

export type CreateCollectionInput = {
  userId: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
};

export type UpdateCollectionInput = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function enrichWithItems(
  collectionRows: CollectionRecord[],
): Promise<CollectionWithItems[]> {
  if (collectionRows.length === 0) return [];
  const db = await getDb();

  const ids = collectionRows.map((c) => c.id);

  // Fetch all items for these collections in one query
  const itemRows = await db
    .select({
      collectionId: collectionItems.collectionId,
      recipeId: collectionItems.recipeId,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      cuisine: recipes.cuisine,
      difficulty: recipes.difficulty,
      cookTimeMinutes: recipes.cookTimeMinutes,
      isPublic: recipes.isPublic,
      addedAt: collectionItems.addedAt,
    })
    .from(collectionItems)
    .innerJoin(recipes, eq(collectionItems.recipeId, recipes.id))
    .where(inArray(collectionItems.collectionId, ids))
    .orderBy(desc(collectionItems.addedAt));

  // Fetch tags for all those recipes
  const recipeIds = [...new Set(itemRows.map((r) => r.recipeId))];
  const tagRows = recipeIds.length > 0
    ? await db
        .select({ recipeId: recipeTags.recipeId, tag: recipeTags.tag })
        .from(recipeTags)
        .where(inArray(recipeTags.recipeId, recipeIds))
    : [];

  const tagsByRecipe = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = tagsByRecipe.get(t.recipeId) ?? [];
    list.push(t.tag);
    tagsByRecipe.set(t.recipeId, list);
  }

  // Group items by collection
  const itemsByCollection = new Map<string, CollectionRecipeItem[]>();
  for (const row of itemRows) {
    const list = itemsByCollection.get(row.collectionId) ?? [];
    list.push({
      recipeId: row.recipeId,
      title: row.title,
      imageUrl: row.imageUrl,
      cuisine: row.cuisine,
      difficulty: row.difficulty,
      cookTimeMinutes: row.cookTimeMinutes,
      isPublic: row.isPublic,
      tags: tagsByRecipe.get(row.recipeId) ?? [],
      addedAt: row.addedAt,
    });
    itemsByCollection.set(row.collectionId, list);
  }

  return collectionRows.map((c) => {
    const items = itemsByCollection.get(c.id) ?? [];
    return { ...c, items, recipeCount: items.length };
  });
}

async function toSummaries(collectionRows: CollectionRecord[]): Promise<CollectionSummary[]> {
  if (collectionRows.length === 0) return [];
  const db = await getDb();

  const ids = collectionRows.map((c) => c.id);

  // One item per collection is enough for the cover image and count
  const itemRows = await db
    .select({
      collectionId: collectionItems.collectionId,
      imageUrl: recipes.imageUrl,
    })
    .from(collectionItems)
    .innerJoin(recipes, eq(collectionItems.recipeId, recipes.id))
    .where(inArray(collectionItems.collectionId, ids))
    .orderBy(desc(collectionItems.addedAt));

  const countByCollection = new Map<string, number>();
  const coverByCollection = new Map<string, string | null>();
  for (const row of itemRows) {
    countByCollection.set(row.collectionId, (countByCollection.get(row.collectionId) ?? 0) + 1);
    if (!coverByCollection.has(row.collectionId)) {
      coverByCollection.set(row.collectionId, row.imageUrl ?? null);
    }
  }

  return collectionRows.map((c) => ({
    ...c,
    recipeCount: countByCollection.get(c.id) ?? 0,
    coverImageUrl: coverByCollection.get(c.id) ?? null,
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function listCollections(userId: string): Promise<CollectionSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.updatedAt));
  return toSummaries(rows);
}

export async function getCollectionById(
  collectionId: string,
  userId: string,
): Promise<CollectionWithItems | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!row) return null;
  const [enriched] = await enrichWithItems([row]);
  return enriched ?? null;
}

export async function getPublicCollectionById(
  collectionId: string,
): Promise<(CollectionWithItems & { ownerName: string; ownerId: string }) | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      id: collections.id,
      userId: collections.userId,
      name: collections.name,
      description: collections.description,
      isPublic: collections.isPublic,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      ownerName: users.displayName,
    })
    .from(collections)
    .innerJoin(users, eq(collections.userId, users.id))
    .where(and(eq(collections.id, collectionId), eq(collections.isPublic, true)));
  if (!row) return null;

  const [enriched] = await enrichWithItems([{
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }]);
  if (!enriched) return null;
  return { ...enriched, ownerName: row.ownerName, ownerId: row.userId };
}

export async function listPublicCollections(params: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<{ collections: PublicCollectionSummary[]; total: number }> {
  const { limit = 20, offset = 0 } = params;
  const db = await getDb();

  const rows = await db
    .select({
      id: collections.id,
      userId: collections.userId,
      name: collections.name,
      description: collections.description,
      isPublic: collections.isPublic,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      ownerName: users.displayName,
      ownerId: users.id,
    })
    .from(collections)
    .innerJoin(users, eq(collections.userId, users.id))
    .where(eq(collections.isPublic, true))
    .orderBy(desc(collections.updatedAt))
    .limit(limit)
    .offset(offset);

  // Total count
  const countRows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.isPublic, true));
  const total = countRows.length;

  const collectionRecords: CollectionRecord[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description,
    isPublic: r.isPublic,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const summaries = await toSummaries(collectionRecords);

  return {
    total,
    collections: summaries.map((s, i) => ({
      ...s,
      ownerName: rows[i]!.ownerName,
      ownerId: rows[i]!.ownerId,
    })),
  };
}

export async function createCollection(
  input: CreateCollectionInput,
): Promise<CollectionRecord> {
  const db = await getDb();
  const [row] = await db
    .insert(collections)
    .values({
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
    })
    .returning();
  if (!row) throw new Error("Insert returned no rows");
  return row;
}

export async function updateCollection(
  collectionId: string,
  userId: string,
  input: UpdateCollectionInput,
): Promise<CollectionRecord | null> {
  const db = await getDb();

  // If making public, flip all recipes in this collection to is_public = true
  if (input.isPublic === true) {
    const items = await db
      .select({ recipeId: collectionItems.recipeId })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    if (items.length > 0) {
      const recipeIds = items.map((i) => i.recipeId);
      await db
        .update(recipes)
        .set({ isPublic: true, updatedAt: new Date() })
        .where(inArray(recipes.id, recipeIds));
    }
  }

  const [updated] = await db
    .update(collections)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteCollection(
  collectionId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .returning({ id: collections.id });
  return result.length > 0;
}

export async function addRecipeToCollection(
  collectionId: string,
  recipeId: string,
  userId: string,
): Promise<{ added: boolean }> {
  const db = await getDb();

  // Verify the collection belongs to this user
  const [col] = await db
    .select({ isPublic: collections.isPublic })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return { added: false };

  // If the collection is public, make the recipe public too
  if (col.isPublic) {
    await db
      .update(recipes)
      .set({ isPublic: true, updatedAt: new Date() })
      .where(eq(recipes.id, recipeId));
  }

  // Upsert — ignore duplicate (unique constraint)
  await db
    .insert(collectionItems)
    .values({ collectionId, recipeId })
    .onConflictDoNothing();

  return { added: true };
}

export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();

  // Verify ownership
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return false;

  const result = await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.recipeId, recipeId),
      ),
    )
    .returning({ id: collectionItems.id });
  return result.length > 0;
}

/** Returns which collection IDs a given recipe belongs to (for the current user). */
export async function getCollectionsForRecipe(
  recipeId: string,
  userId: string,
): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ collectionId: collectionItems.collectionId })
    .from(collectionItems)
    .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
    .where(
      and(eq(collectionItems.recipeId, recipeId), eq(collections.userId, userId)),
    );
  return rows.map((r) => r.collectionId);
}
