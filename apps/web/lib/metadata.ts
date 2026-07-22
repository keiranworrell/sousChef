/**
 * Server-side helpers for fetching minimal recipe/collection data needed for
 * generateMetadata calls. These use an unauthenticated fetch against the public
 * API endpoints so they work at build / request time without a Cognito token.
 */

const API_URL = (process.env["NEXT_PUBLIC_API_URL"] ?? "").replace(/\/$/, "");

export type RecipeMeta = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  cuisine: string | null;
  creatorName: string | null;
};

export type CollectionMeta = {
  name: string;
  description: string | null;
  ownerName: string;
  recipeCount: number;
};

export async function fetchRecipeMeta(id: string): Promise<RecipeMeta | null> {
  try {
    const res = await fetch(`${API_URL}/public/recipes/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        title: string;
        description: string | null;
        imageUrl: string | null;
        cuisine: string | null;
        creatorName: string | null;
      };
    };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchCollectionMeta(id: string): Promise<CollectionMeta | null> {
  try {
    const res = await fetch(`${API_URL}/collections/public/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        name: string;
        description: string | null;
        ownerName: string;
        recipeCount: number;
      };
    };
    return json.data ?? null;
  } catch {
    return null;
  }
}
