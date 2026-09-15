import { and, eq, desc, inArray, or } from "drizzle-orm";
import { getDb } from "../client";
import { collections, collectionItems, recipes, recipeTags, users } from "../schema";
import {
  canEditCollection,
  getCollectionAccess,
  getSharedCollectionIds,
  type CollectionAccess,
} from "./collection-share-queries";

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
  access: Exclude<CollectionAccess, null>;
  ownerName?: string;
};

export type CollectionSummary = CollectionRecord & {
  recipeCount: number;
  /** Cover image — first recipe image in the collection, if any. */
  coverImageUrl: string | null;
  /**
   * This viewer's relationship to the collection. Present on every summary so
   * the UI never has to infer it by comparing userId, which is the kind of
   * client-side authorisation that drifts.
   */
  access: Exclude<CollectionAccess, null>;
  /** Populated only for collections shared with the viewer. */
  ownerName?: string;
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
    return { ...c, items, recipeCount: items.length, access: "owner" as const };
  });
}

async function toSummaries(
  collectionRows: CollectionRecord[],
  accessFor?: Map<string, Exclude<CollectionAccess, null>>,
  ownerNames?: Map<string, string>,
): Promise<CollectionSummary[]> {
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
    access: accessFor?.get(c.id) ?? "owner",
    ...(ownerNames?.get(c.userId) ? { ownerName: ownerNames.get(c.userId)! } : {}),
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Collections this user can see: their own, plus anything shared with them
 * directly or through their household.
 *
 * One query over both sets rather than two round trips, and every row carries
 * an `access` field so the client never decides permissions by comparing ids.
 */
export async function listCollections(userId: string): Promise<CollectionSummary[]> {
  const db = await getDb();

  const shared = await getSharedCollectionIds(userId);
  const sharedIds = shared.map((s) => s.collectionId);

  const rows = await db
    .select()
    .from(collections)
    .where(
      sharedIds.length > 0
        ? or(eq(collections.userId, userId), inArray(collections.id, sharedIds))
        : eq(collections.userId, userId),
    )
    .orderBy(desc(collections.updatedAt));

  const accessFor = new Map<string, Exclude<CollectionAccess, null>>();
  for (const s of shared) accessFor.set(s.collectionId, s.role);
  // Ownership outranks any share, and a user can be shared a collection they
  // own if a household share was created before they became the owner.
  for (const row of rows) {
    if (row.userId === userId) accessFor.set(row.id, "owner");
  }

  // Owner names, but only for collections the viewer doesn't own — "shared by
  // Priya" is the whole point of the shared section, and looking up your own
  // name to not display it is wasted work.
  const foreignOwnerIds = [
    ...new Set(rows.filter((r) => r.userId !== userId).map((r) => r.userId)),
  ];
  const ownerNames = new Map<string, string>();
  if (foreignOwnerIds.length > 0) {
    const ownerRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, foreignOwnerIds));
    for (const o of ownerRows) ownerNames.set(o.id, o.displayName);
  }

  return toSummaries(rows, accessFor, ownerNames);
}

/**
 * A collection the user can read, with the viewer's access level attached.
 *
 * Returns null for no access rather than distinguishing "doesn't exist" from
 * "not yours" — the caller turns both into a 404. Confirming that a collection
 * exists but isn't yours leaks the existence of other people's data, which is
 * precisely how the logCook disclosure worked.
 */
export async function getCollectionById(
  collectionId: string,
  userId: string,
): Promise<CollectionWithItems | null> {
  const db = await getDb();

  const access = await getCollectionAccess(collectionId, userId);
  if (access === null) return null;

  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!row) return null;

  const [enriched] = await enrichWithItems([row]);
  if (!enriched) return null;

  let ownerName: string | undefined;
  if (row.userId !== userId) {
    const [owner] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    ownerName = owner?.displayName;
  }

  return { ...enriched, access, ...(ownerName ? { ownerName } : {}) };
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

export type AddToCollectionResult =
  | { added: true }
  | { added: false; reason: "no-access" | "not-your-recipe" | "editor-cannot-publish" };

export async function addRecipeToCollection(
  collectionId: string,
  recipeId: string,
  userId: string,
): Promise<AddToCollectionResult> {
  const db = await getDb();

  const access = await getCollectionAccess(collectionId, userId);
  if (!canEditCollection(access)) return { added: false, reason: "no-access" };

  const [col] = await db
    .select({ isPublic: collections.isPublic })
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!col) return { added: false, reason: "no-access" };

  // An editor may not add to a *public* collection.
  //
  // Adding to a public collection publishes the recipe (below). For the owner
  // that is their own collection and their own choice. For an editor it would
  // mean a setting on somebody else's collection silently publishing their
  // private recipe — the same shape as the hole the September sweep found,
  // where a public collection could be used to publish another user's recipe.
  // Refusing is the conservative answer, and the owner can still add it.
  if (access !== "owner" && col.isPublic) {
    return { added: false, reason: "editor-cannot-publish" };
  }

  // Verify the *recipe* belongs to this user too.
  //
  // Without this, any recipe id could be added to a caller's own collection —
  // and because a public collection publishes its contents, that meant anyone
  // could make another user's private recipe public simply by adding it to a
  // public collection of their own. The collection check alone is not enough:
  // owning the collection says nothing about owning what goes in it.
  const [ownsRecipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));
  if (!ownsRecipe) return { added: false, reason: "not-your-recipe" };

  // If the collection is public, make the recipe public too
  if (col.isPublic) {
    await db
      .update(recipes)
      .set({ isPublic: true, updatedAt: new Date() })
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));
  }

  // Upsert — ignore duplicate (unique constraint)
  await db
    .insert(collectionItems)
    .values({ collectionId, recipeId })
    .onConflictDoNothing();

  return { added: true };
}

export type UpdateCollectionRecipesResult = {
  added: number;
  removed: number;
};

/**
 * Applies a batch of membership changes to a collection in one transaction.
 *
 * The multi-select picker diffs against server state and sends only what
 * changed, so this takes add and remove lists rather than a full membership
 * set. A full set would race: two devices editing the same collection would
 * each overwrite the other's changes wholesale, where a diff only conflicts on
 * the specific recipes both touched.
 *
 * Transactional because a partial apply is worse than a failure — the user is
 * shown one confirmation, and half-applied membership would silently disagree
 * with what they saw.
 */
export async function updateCollectionRecipes(
  collectionId: string,
  userId: string,
  changes: { add: string[]; remove: string[] },
): Promise<UpdateCollectionRecipesResult | null> {
  const db = await getDb();

  const access = await getCollectionAccess(collectionId, userId);
  if (!canEditCollection(access)) return null;

  const [col] = await db
    .select({ isPublic: collections.isPublic })
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!col) return null;

  // Same reasoning as addRecipeToCollection: only the owner may add to a
  // collection whose public flag would publish what goes in.
  if (access !== "owner" && col.isPublic && changes.add.length > 0) return null;

  // Reduce the requested additions to recipes the caller actually owns. Silently
  // dropping the rest rather than erroring: the ids come from a picker that only
  // ever lists the user's own recipes, so anything else is either a stale client
  // or someone probing, and neither deserves a detailed answer.
  const ownedToAdd = changes.add.length
    ? (
        await db
          .select({ id: recipes.id })
          .from(recipes)
          .where(and(inArray(recipes.id, changes.add), eq(recipes.userId, userId)))
      ).map((r) => r.id)
    : [];

  return db.transaction(async (tx) => {
    if (ownedToAdd.length > 0) {
      await tx
        .insert(collectionItems)
        .values(ownedToAdd.map((recipeId) => ({ collectionId, recipeId })))
        .onConflictDoNothing();

      // A public collection publishes what it contains
      if (col.isPublic) {
        await tx
          .update(recipes)
          .set({ isPublic: true, updatedAt: new Date() })
          .where(and(inArray(recipes.id, ownedToAdd), eq(recipes.userId, userId)));
      }
    }

    if (changes.remove.length > 0) {
      // Scoped to this collection, so removal can't touch another user's rows
      // even if an id from elsewhere is submitted.
      await tx
        .delete(collectionItems)
        .where(
          and(
            eq(collectionItems.collectionId, collectionId),
            inArray(collectionItems.recipeId, changes.remove),
          ),
        );
    }

    return { added: ownedToAdd.length, removed: changes.remove.length };
  });
}

export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();

  // Owner or editor. Removing does not publish anything, so unlike adding there
  // is no public-collection carve-out here.
  const access = await getCollectionAccess(collectionId, userId);
  if (!canEditCollection(access)) return false;

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
