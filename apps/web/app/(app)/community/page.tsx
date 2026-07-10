"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CommunityRecipe, PublicUserListItem } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

type Tab = "recipes" | "people";

// ── People tab ─────────────────────────────────────────────────────────────────

function PeopleTab(): React.JSX.Element {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<PublicUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string, offset: number): Promise<void> => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const api = await getApiClient();
      const res = await api.users.search({ q: query || undefined, limit: 20, offset });
      if ("error" in res) return;
      if (offset === 0) {
        setUsers(res.data.users);
      } else {
        setUsers((prev) => [...prev, ...res.data.users]);
      }
      setTotal(res.data.total);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void search(q, 0); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, search]);

  async function handleToggle(user: PublicUserListItem): Promise<void> {
    setToggling(user.id);
    try {
      const api = await getApiClient();
      if (user.isFollowing) {
        await api.users.unfollow(user.id);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, isFollowing: false, followerCount: Math.max(0, u.followerCount - 1) }
              : u,
          ),
        );
      } else {
        await api.users.follow(user.id);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, isFollowing: true, followerCount: u.followerCount + 1 }
              : u,
          ),
        );
      }
    } catch {
      // silently ignore
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <input
        type="text"
        className="input w-full mb-6"
        placeholder="Search people…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && users.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No people found.</p>
        </div>
      )}

      <div className="grid gap-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <Link href={`/users/${user.id}`} className="shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-11 w-11 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-orange-100 flex items-center justify-center text-base font-bold text-orange-500">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={`/users/${user.id}`}
                className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition"
              >
                {user.displayName}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">
                {user.followerCount.toLocaleString()} {user.followerCount === 1 ? "follower" : "followers"}
              </p>
            </div>

            <button
              onClick={() => { void handleToggle(user); }}
              disabled={toggling === user.id}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                user.isFollowing
                  ? "border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600"
                  : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {toggling === user.id ? "…" : user.isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>

      {users.length < total && (
        <div className="mt-6 text-center">
          <button
            onClick={() => { void search(q, users.length); }}
            disabled={loadingMore}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Recipes tab ────────────────────────────────────────────────────────────────

function RecipesTab(): React.JSX.Element {
  const router = useRouter();

  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [tag, setTag] = useState("");
  const [creator, setCreator] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [forkingId, setForkingId] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (params: { q: string; cuisine: string; tag: string; creator: string; offset: number }): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const api = await getApiClient();
        const res = await api.community.list({
          q: params.q || undefined,
          cuisine: params.cuisine || undefined,
          tag: params.tag || undefined,
          creator: params.creator || undefined,
          limit,
          offset: params.offset,
        });
        if ("error" in res) throw new Error(res.error.message);
        setRecipes(res.data.recipes);
        setTotal(res.data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load community recipes");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      void load({ q, cuisine, tag, creator, offset: 0 });
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, cuisine, tag, creator, load]);

  useEffect(() => {
    void load({ q, cuisine, tag, creator, offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function handleFork(recipeId: string): Promise<void> {
    setForkingId(recipeId);
    setForkError(null);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(recipeId);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/recipes/${res.data.id}`);
    } catch (err) {
      setForkError(err instanceof Error ? err.message : "Fork failed");
      setForkingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Search / filters */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input type="text" className="input flex-1" placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="text" className="input w-full sm:w-36" placeholder="Creator" value={creator} onChange={(e) => setCreator(e.target.value)} />
        <input type="text" className="input w-full sm:w-36" placeholder="Cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
        <input type="text" className="input w-full sm:w-36" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {forkError && <p className="mb-4 text-sm text-red-600">{forkError}</p>}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No public recipes found.</p>
        </div>
      )}

      <div className="grid gap-4">
        {recipes.map((recipe) => {
          const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
          return (
            <div key={recipe.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {recipe.imageUrl && (
                <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/community/${recipe.id}`} className="text-base font-semibold text-gray-900 hover:text-orange-600 leading-snug">
                    {recipe.title}
                  </Link>
                  <Link href={`/users/${recipe.creatorId}`} className="mt-0.5 block text-xs text-gray-400 hover:text-orange-500 transition">
                    by {recipe.creatorName}
                  </Link>
                  {recipe.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>{recipe.servings} servings</span>
                    {totalMins > 0 && <span>{totalMins} min</span>}
                    {recipe.cuisine && <span>{recipe.cuisine}</span>}
                    {recipe.difficulty && (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-600 font-medium">
                        {DIFFICULTY_LABEL[recipe.difficulty]}
                      </span>
                    )}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.tags.map((t) => (
                        <span key={t.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {t.tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { void handleFork(recipe.id); }}
                  disabled={forkingId === recipe.id}
                  className="shrink-0 btn-secondary text-sm disabled:opacity-50"
                >
                  {forkingId === recipe.id ? "Forking…" : "Fork"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="btn-secondary disabled:opacity-40">← Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setOffset(offset + limit)} disabled={currentPage >= totalPages} className="btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CommunityPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("recipes");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover recipes and cooks. Fork recipes to add them to your collection, or follow cooks to see their updates in your feed.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["recipes", "people"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "recipes" ? <RecipesTab /> : <PeopleTab />}
    </div>
  );
}
