"use client";

import React from "react";

type Props = {
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onRetry: () => void;
  /** Attach the observer sentinel. */
  sentinelRef: (node: HTMLElement | null) => void;
  /** Number of items currently loaded — suppresses the end state on empty lists. */
  itemCount: number;
  /** Shape of the skeleton rows, matched to the list being paginated. */
  variant?: "card" | "row";
};

/**
 * The footer region of an infinitely-scrolling list: sentinel, loading skeletons,
 * retry affordance, and end-of-list marker.
 *
 * Kept separate from useInfiniteList so the hook stays presentation-free and both
 * the recipe grid and community feed can render their own skeleton shapes.
 */
export default function InfiniteListFooter({
  isLoadingMore,
  hasMore,
  error,
  onRetry,
  sentinelRef,
  itemCount,
  variant = "card",
}: Props): React.JSX.Element | null {
  // A failed page keeps the already-loaded items on screen and offers a retry.
  // Replacing the list with an error would throw away everything the user
  // already scrolled through.
  if (error) {
    return (
      <div className="col-span-full py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Couldn&apos;t load more recipes.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-orange-700 dark:hover:text-orange-400"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoadingMore) {
    return (
      <>
        {Array.from({ length: variant === "card" ? 3 : 4 }).map((_, i) => (
          <ListSkeleton key={i} variant={variant} />
        ))}
      </>
    );
  }

  if (hasMore) {
    // Zero-height sentinel; rootMargin on the observer triggers the fetch well
    // before this actually enters the viewport.
    return <div ref={sentinelRef} aria-hidden className="col-span-full h-px" />;
  }

  // Explicit end state — without it, a list that simply stops scrolling reads as
  // a failure rather than completion.
  if (itemCount > 0) {
    return (
      <p className="col-span-full py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        That&apos;s all of them
      </p>
    );
  }

  return null;
}

export function ListSkeleton({
  variant = "card",
}: {
  variant?: "card" | "row";
}): React.JSX.Element {
  if (variant === "row") {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="h-40 w-full bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
