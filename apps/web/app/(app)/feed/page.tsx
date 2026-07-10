"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { FeedActivity } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const PAGE_SIZE = 20;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ActivityCard({ activity }: { activity: FeedActivity }): React.JSX.Element {
  const { user, recipe, type, occurredAt } = activity;

  const actionText =
    type === "new_recipe" ? "shared a new recipe" : "cooked";

  return (
    <div className="flex gap-4 py-5 border-b border-gray-100 last:border-0">
      {/* Avatar */}
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="h-9 w-9 rounded-full object-cover border border-gray-200 shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{user.displayName}</span>
          {" "}{actionText}{" "}
          <Link
            href={`/community/${recipe.id}`}
            className="font-semibold text-orange-500 hover:underline"
          >
            {recipe.title}
          </Link>
        </p>

        {/* Recipe thumbnail */}
        {recipe.imageUrl && (
          <Link href={`/community/${recipe.id}`} className="mt-2.5 block w-fit">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="h-24 w-40 rounded-lg object-cover border border-gray-100"
            />
          </Link>
        )}
      </div>

      {/* Timestamp */}
      <p className="shrink-0 text-xs text-gray-400 pt-0.5">{timeAgo(occurredAt)}</p>
    </div>
  );
}

export default function FeedPage(): React.JSX.Element {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.feed.list({ limit: PAGE_SIZE, offset: 0 });
        if ("error" in res) throw new Error(res.error.message);
        setActivities(res.data.activities);
        setTotal(res.data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleLoadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const api = await getApiClient();
      const res = await api.feed.list({ limit: PAGE_SIZE, offset: activities.length });
      if ("error" in res) throw new Error(res.error.message);
      setActivities((prev) => [...prev, ...res.data.activities]);
      setTotal(res.data.total);
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Feed</h1>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-8 py-14 text-center">
          <p className="text-gray-900 font-medium mb-1">Nothing here yet</p>
          <p className="text-sm text-gray-400 mb-5">
            Follow some cooks to see when they share or cook recipes.
          </p>
          <Link
            href="/community"
            className="inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Explore community
          </Link>
        </div>
      ) : (
        <>
          <div>
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>

          {activities.length < total && (
            <div className="mt-6 text-center">
              <button
                onClick={() => { void handleLoadMore(); }}
                disabled={loadingMore}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
