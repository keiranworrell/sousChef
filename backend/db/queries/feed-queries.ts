import { desc, eq, inArray, and } from "drizzle-orm";
import { getDb } from "../client";
import { cookHistory, follows, recipes, users } from "../schema";

export type FeedActivityType = "new_recipe" | "cooked_recipe";

export type FeedActivity = {
  id: string;
  type: FeedActivityType;
  occurredAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  recipe: {
    id: string;
    title: string;
    imageUrl: string | null;
  };
};

export type GetFeedOptions = {
  limit: number;
  offset: number;
};

// How many rows to fetch from each source before merging.
// Generous to ensure we have enough to fill any requested page.
const FETCH_PER_SOURCE = 200;

/**
 * Returns a merged activity feed of new public recipes and cook logs
 * from users that userId follows, sorted by most recent first.
 */
export async function getFeed(
  userId: string,
  { limit, offset }: GetFeedOptions,
): Promise<{ activities: FeedActivity[]; total: number }> {
  const db = await getDb();

  // Resolve who this user follows
  const followRows = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  if (followRows.length === 0) {
    return { activities: [], total: 0 };
  }

  const followeeIds = followRows.map((f) => f.followeeId);

  // ── New public recipes ────────────────────────────────────────────────────

  const newRecipeRows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      occurredAt: recipes.createdAt,
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(recipes)
    .innerJoin(users, eq(recipes.userId, users.id))
    .where(and(inArray(recipes.userId, followeeIds), eq(recipes.isPublic, true)))
    .orderBy(desc(recipes.createdAt))
    .limit(FETCH_PER_SOURCE);

  const newRecipeActivities: FeedActivity[] = newRecipeRows.map((r) => ({
    id: `recipe-${r.id}`,
    type: "new_recipe",
    occurredAt: r.occurredAt.toISOString(),
    user: { id: r.userId, displayName: r.displayName, avatarUrl: r.avatarUrl },
    recipe: { id: r.id, title: r.title, imageUrl: r.imageUrl },
  }));

  // ── Cook logs ─────────────────────────────────────────────────────────────

  const cookRows = await db
    .select({
      id: cookHistory.id,
      occurredAt: cookHistory.cookedAt,
      recipeId: recipes.id,
      recipeTitle: recipes.title,
      recipeImageUrl: recipes.imageUrl,
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(cookHistory)
    .innerJoin(recipes, eq(cookHistory.recipeId, recipes.id))
    .innerJoin(users, eq(cookHistory.userId, users.id))
    .where(and(inArray(cookHistory.userId, followeeIds), eq(recipes.isPublic, true)))
    .orderBy(desc(cookHistory.cookedAt))
    .limit(FETCH_PER_SOURCE);

  const cookActivities: FeedActivity[] = cookRows.map((r) => ({
    id: `cook-${r.id}`,
    type: "cooked_recipe",
    occurredAt: r.occurredAt.toISOString(),
    user: { id: r.userId, displayName: r.displayName, avatarUrl: r.avatarUrl },
    recipe: { id: r.recipeId, title: r.recipeTitle, imageUrl: r.recipeImageUrl },
  }));

  // ── Merge, sort, paginate ─────────────────────────────────────────────────

  const all = [...newRecipeActivities, ...cookActivities].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return {
    activities: all.slice(offset, offset + limit),
    total: all.length,
  };
}
