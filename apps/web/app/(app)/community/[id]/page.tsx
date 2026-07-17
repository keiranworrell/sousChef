"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CommunityRecipe, UserProfile } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import CollectionPickerModal from "@/components/CollectionPickerModal";

function HeartIcon({ filled }: { filled: boolean }): React.JSX.Element {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

export default function CommunityRecipePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [recipe, setRecipe] = useState<CommunityRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  // Like state — initialised from recipe once loaded
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);

  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const recipeRes = await api.community.get(id);
        if ("error" in recipeRes) throw new Error(recipeRes.error.message);
        const r = recipeRes.data;
        setRecipe(r);
        setIsLiked(r.isLiked);
        setLikeCount(r.likeCount);

        // Fetch creator profile and own user in parallel
        const [profileRes, meRes] = await Promise.all([
          api.users.profile(r.userId),
          api.users.me(),
        ]);
        if (!("error" in profileRes)) {
          setCreatorProfile(profileRes.data);
          setFollowing(profileRes.data.isFollowing);
        }
        if (!("error" in meRes)) {
          setOwnUserId(meRes.data.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleLike(): Promise<void> {
    setLiking(true);
    const wasLiked = isLiked;
    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    try {
      const api = await getApiClient();
      if (wasLiked) {
        await api.community.unlike(id);
      } else {
        await api.community.like(id);
      }
    } catch {
      // Revert on failure
      setIsLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLiking(false);
    }
  }

  async function handleFollow(): Promise<void> {
    if (!recipe) return;
    // Optimistic update
    setFollowing(true);
    setCreatorProfile((prev) =>
      prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev,
    );
    try {
      const api = await getApiClient();
      await api.users.follow(recipe.userId);
    } catch {
      // Revert on failure
      setFollowing(false);
      setCreatorProfile((prev) =>
        prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev,
      );
    }
  }

  async function handleUnfollow(): Promise<void> {
    if (!recipe) return;
    // Optimistic update
    setFollowing(false);
    setCreatorProfile((prev) =>
      prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev,
    );
    try {
      const api = await getApiClient();
      await api.users.unfollow(recipe.userId);
    } catch {
      // Revert on failure
      setFollowing(true);
      setCreatorProfile((prev) =>
        prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev,
      );
    }
  }

  function handleShare(): void {
    const url = `${window.location.origin}/r/${id}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleFork(): Promise<void> {
    setForking(true);
    setForkError(null);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(id);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/recipes/${res.data.id}`);
    } catch (err) {
      setForkError(err instanceof Error ? err.message : "Fork failed");
      setForking(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Recipe not found"}</p>
        <Link href="/community" className="mt-4 inline-block text-sm text-orange-500 hover:underline">
          ← Back to community
        </Link>
      </div>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const isOwnRecipe = ownUserId !== null && ownUserId === recipe.userId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {showCollectionPicker && (
        <CollectionPickerModal recipeId={id} onClose={() => setShowCollectionPicker(false)} />
      )}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/community" className="text-sm text-orange-500 hover:underline">
            ← Community
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{recipe.title}</h1>
          {recipe.description && (
            <p className="mt-2 text-gray-500 dark:text-gray-400">{recipe.description}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Like button */}
            <button
              onClick={() => { void handleLike(); }}
              disabled={liking}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                isLiked
                  ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <HeartIcon filled={isLiked} />
              {likeCount.toLocaleString()}
            </button>
            {/* Save to collection */}
            <button
              onClick={() => setShowCollectionPicker(true)}
              className="btn-secondary"
            >
              Save
            </button>
            {/* Share button */}
            <button
              onClick={handleShare}
              className="btn-secondary"
            >
              {copied ? "✓ Copied!" : "Share"}
            </button>
            {/* Fork button */}
            <button
              onClick={() => { void handleFork(); }}
              disabled={forking}
              className="btn-primary disabled:opacity-50"
            >
              {forking ? "Forking…" : "Fork recipe"}
            </button>
          </div>
          {forkError && (
            <p className="text-sm text-red-600">{forkError}</p>
          )}
        </div>
      </div>

      {/* Creator strip */}
      {creatorProfile && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
          {creatorProfile.avatarUrl ? (
            <img
              src={creatorProfile.avatarUrl}
              alt={creatorProfile.displayName}
              className="h-8 w-8 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
              {creatorProfile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link href={`/users/${recipe.userId}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-orange-600 transition">
              {creatorProfile.displayName}
            </Link>
            <p className="text-xs text-gray-400">
              {creatorProfile.followerCount.toLocaleString()} {creatorProfile.followerCount === 1 ? "follower" : "followers"}
            </p>
          </div>
          {!isOwnRecipe && (
            <button
              onClick={() => { void (following ? handleUnfollow() : handleFollow()); }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                following
                  ? "border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600"
                  : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
          )}
          {isOwnRecipe && (
            <span className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400">
              Your recipe
            </span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-6">
        <span>{recipe.servings} servings</span>
        {totalMins > 0 && <span>{totalMins} min total</span>}
        {recipe.prepTimeMinutes && <span>{recipe.prepTimeMinutes} min prep</span>}
        {recipe.cookTimeMinutes && <span>{recipe.cookTimeMinutes} min cook</span>}
        {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
        {recipe.forkCount > 0 && (
          <span>{recipe.forkCount.toLocaleString()} {recipe.forkCount === 1 ? "fork" : "forks"}</span>
        )}
      </div>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1">
          {recipe.tags.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-sm text-gray-500 dark:text-gray-400"
            >
              {t.tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                {ing.quantity != null && (
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                )}
                <span>{ing.name}</span>
                {ing.notes && <span className="text-gray-400">({ing.notes})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Method</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  {step.stepNumber}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{step.instruction}</p>
                  {step.timerSeconds && (
                    <p className="mt-1 text-xs text-gray-400">
                      Timer: {Math.round(step.timerSeconds / 60)} min
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Fork CTA at bottom for long recipes */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Like this recipe? Fork it to add it to your own collection and make it your own.
        </p>
        <button
          onClick={() => { void handleFork(); }}
          disabled={forking}
          className="btn-primary disabled:opacity-50"
        >
          {forking ? "Forking…" : "Fork recipe"}
        </button>
      </div>
    </div>
  );
}
