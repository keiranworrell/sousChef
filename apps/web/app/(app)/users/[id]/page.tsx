"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { UserProfile, CommunityRecipe, PublicUserListItem } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const PAGE_SIZE = 20;

// ── Follow list panel ──────────────────────────────────────────────────────────

function FollowPanel({
  title,
  userId,
  fetchFn,
  onClose,
  onFollowChange,
}: {
  title: string;
  userId: string;
  fetchFn: (uid: string, params: { limit: number; offset: number }) => Promise<{ users: PublicUserListItem[]; total: number }>;
  onClose: () => void;
  onFollowChange: () => void;
}): React.JSX.Element {
  const [items, setItems] = useState<PublicUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const result = await fetchFn(userId, { limit: PAGE_SIZE, offset: 0 });
        setItems(result.users);
        setTotal(result.total);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId, fetchFn]);

  async function handleLoadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const result = await fetchFn(userId, { limit: PAGE_SIZE, offset: items.length });
      setItems((prev) => [...prev, ...result.users]);
      setTotal(result.total);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleToggle(item: PublicUserListItem): Promise<void> {
    setToggling(item.id);
    try {
      const api = await getApiClient();
      if (item.isFollowing) {
        await api.users.unfollow(item.id);
        setItems((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, isFollowing: false, followerCount: Math.max(0, u.followerCount - 1) }
              : u,
          ),
        );
      } else {
        await api.users.follow(item.id);
        setItems((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, isFollowing: true, followerCount: u.followerCount + 1 }
              : u,
          ),
        );
      }
      onFollowChange();
    } catch {
      // silently ignore
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading && <p className="py-6 text-sm text-center text-gray-400">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="py-6 text-sm text-center text-gray-400">Nobody here yet.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
              <Link href={`/users/${item.id}`} onClick={onClose}>
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt={item.displayName} className="h-9 w-9 rounded-full object-cover border border-gray-200 shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
                    {item.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/users/${item.id}`} onClick={onClose} className="text-sm font-medium text-gray-900 hover:text-orange-600">
                  {item.displayName}
                </Link>
                <p className="text-xs text-gray-400">
                  {item.followerCount.toLocaleString()} {item.followerCount === 1 ? "follower" : "followers"}
                </p>
              </div>
              <button
                onClick={() => { void handleToggle(item); }}
                disabled={toggling === item.id}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  item.isFollowing
                    ? "border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600"
                    : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {toggling === item.id ? "…" : item.isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          ))}

          {items.length < total && (
            <div className="py-4 text-center">
              <button
                onClick={() => { void handleLoadMore(); }}
                disabled={loadingMore}
                className="text-sm text-orange-500 hover:underline disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Public profile page ────────────────────────────────────────────────────────

export default function UserProfilePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [recipesTotal, setRecipesTotal] = useState(0);
  const [recipesOffset, setRecipesOffset] = useState(0);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [panel, setPanel] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const [profileRes, meRes] = await Promise.all([
          api.users.profile(id),
          api.users.me(),
        ]);
        if ("error" in profileRes) throw new Error(profileRes.error.message);
        setProfile(profileRes.data);
        setFollowing(profileRes.data.isFollowing);
        if (!("error" in meRes)) setOwnUserId(meRes.data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const loadRecipes = useCallback(async (offset: number): Promise<void> => {
    setLoadingRecipes(true);
    try {
      const api = await getApiClient();
      const res = await api.community.list({ creatorId: id, limit: PAGE_SIZE, offset });
      if ("error" in res) return;
      if (offset === 0) {
        setRecipes(res.data.recipes);
      } else {
        setRecipes((prev) => [...prev, ...res.data.recipes]);
      }
      setRecipesTotal(res.data.total);
      setRecipesOffset(offset);
    } finally {
      setLoadingRecipes(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRecipes(0);
  }, [loadRecipes]);

  async function handleFollow(): Promise<void> {
    setFollowLoading(true);
    try {
      const api = await getApiClient();
      await api.users.follow(id);
      setFollowing(true);
      setProfile((prev) => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev);
    } catch {
      // silently ignore
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleUnfollow(): Promise<void> {
    setFollowLoading(true);
    try {
      const api = await getApiClient();
      await api.users.unfollow(id);
      setFollowing(false);
      setProfile((prev) => prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev);
    } catch {
      // silently ignore
    } finally {
      setFollowLoading(false);
    }
  }

  async function fetchFollowers(uid: string, params: { limit: number; offset: number }): Promise<{ users: PublicUserListItem[]; total: number }> {
    const api = await getApiClient();
    const res = await api.users.followers(uid, params);
    if ("error" in res) return { users: [], total: 0 };
    return res.data;
  }

  async function fetchFollowing(uid: string, params: { limit: number; offset: number }): Promise<{ users: PublicUserListItem[]; total: number }> {
    const api = await getApiClient();
    const res = await api.users.following(uid, params);
    if ("error" in res) return { users: [], total: 0 };
    return res.data;
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><p className="text-sm text-gray-400">Loading…</p></div>;
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "User not found"}</p>
        <Link href="/community" className="mt-4 inline-block text-sm text-orange-500 hover:underline">← Community</Link>
      </div>
    );
  }

  const isOwnProfile = ownUserId === id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Profile header */}
      <div className="mb-8 flex items-start gap-5">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-20 w-20 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-bold text-orange-500 shrink-0">
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{profile.displayName}</h1>
              {profile.bio && <p className="mt-1 text-sm text-gray-500">{profile.bio}</p>}
            </div>
            {isOwnProfile ? (
              <Link
                href="/profile"
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition"
              >
                Edit profile
              </Link>
            ) : (
              <button
                onClick={() => { void (following ? handleUnfollow() : handleFollow()); }}
                disabled={followLoading}
                className={`shrink-0 rounded-lg border px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  following
                    ? "border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600"
                    : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {followLoading ? "…" : following ? "Following" : "Follow"}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-5">
            <button
              onClick={() => setPanel("followers")}
              className="text-left hover:text-orange-600 transition"
            >
              <span className="text-lg font-bold text-gray-900">{profile.followerCount.toLocaleString()}</span>
              <span className="ml-1 text-sm text-gray-400">followers</span>
            </button>
            <button
              onClick={() => setPanel("following")}
              className="text-left hover:text-orange-600 transition"
            >
              <span className="text-lg font-bold text-gray-900">{profile.followingCount.toLocaleString()}</span>
              <span className="ml-1 text-sm text-gray-400">following</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recipes */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipes</h2>

      {recipes.length === 0 && !loadingRecipes && (
        <div className="rounded-xl border border-dashed border-gray-200 px-8 py-12 text-center">
          <p className="text-sm text-gray-400">No public recipes yet.</p>
        </div>
      )}

      <div className="grid gap-4">
        {recipes.map((recipe) => {
          const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
          return (
            <div
              key={recipe.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden cursor-pointer hover:border-orange-200 transition"
              onClick={() => router.push(`/community/${recipe.id}`)}
            >
              {recipe.imageUrl && (
                <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-36 object-cover" />
              )}
              <div className="p-4">
                <p className="font-semibold text-gray-900 leading-snug">{recipe.title}</p>
                {recipe.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>{recipe.servings} servings</span>
                  {totalMins > 0 && <span>{totalMins} min</span>}
                  {recipe.cuisine && <span>{recipe.cuisine}</span>}
                  {recipe.difficulty && (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-600 font-medium capitalize">
                      {recipe.difficulty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {recipes.length < recipesTotal && (
        <div className="mt-6 text-center">
          <button
            onClick={() => { void loadRecipes(recipesOffset + PAGE_SIZE); }}
            disabled={loadingRecipes}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition disabled:opacity-50"
          >
            {loadingRecipes ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {/* Follow panels */}
      {panel === "followers" && (
        <FollowPanel
          title="Followers"
          userId={id}
          fetchFn={fetchFollowers}
          onClose={() => setPanel(null)}
          onFollowChange={() => {}}
        />
      )}
      {panel === "following" && (
        <FollowPanel
          title="Following"
          userId={id}
          fetchFn={fetchFollowing}
          onClose={() => setPanel(null)}
          onFollowChange={() => {}}
        />
      )}
    </div>
  );
}
