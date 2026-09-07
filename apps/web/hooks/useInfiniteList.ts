"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type InfinitePage<T> = {
  items: T[];
  nextCursor: string | null;
  total: number | null;
};

export type UseInfiniteListOptions<T> = {
  /**
   * Fetches one page. Receives null on the first page. Must be stable across
   * renders for a given set of filters — wrap it in useCallback whose deps are
   * the filters — because a change to it resets the list.
   */
  fetchPage: (cursor: string | null) => Promise<InfinitePage<T>>;
  /**
   * Key identifying the current filter/sort combination. When it changes the
   * list resets to page one. Changing filters must not append to results
   * gathered under the previous filters.
   */
  resetKey: string;
  /** Stable identity for an item, used to drop duplicates. */
  getItemKey: (item: T) => string;
  /**
   * Enables back-navigation restore. When set, loaded pages and the scroll
   * position are cached per route+filter combination, so returning from a detail
   * page puts the user back where they were instead of at the top of page one.
   *
   * Without this, infinite scroll is actively worse than numbered pages: a page
   * number survives a round trip through the browser's history, a scroll offset
   * into unloaded content does not.
   */
  cacheKey?: string;
};

/** Cap on cached items. Guards against filling sessionStorage on a large library. */
const MAX_CACHED_ITEMS = 200;

type CachedState<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  total: number | null;
  scrollY: number;
};

function readCache<T>(key: string): CachedState<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState<T>;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    // Quota errors, private-mode restrictions, corrupt entries — all non-fatal.
    // Falling through to a normal fetch is always a safe outcome.
    return null;
  }
}

function writeCache<T>(key: string, state: CachedState<T>): void {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...state, items: state.items.slice(0, MAX_CACHED_ITEMS) }),
    );
  } catch {
    // Ignore — caching is an optimisation, never a requirement.
  }
}

export type UseInfiniteListResult<T> = {
  items: T[];
  total: number | null;
  /** True only during the very first load, so callers can show a full skeleton. */
  isLoadingInitial: boolean;
  /** True while appending a further page. */
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Retries the page that failed, preserving already-loaded items. */
  retry: () => void;
  /** Attach to a sentinel element at the end of the list. */
  sentinelRef: (node: HTMLElement | null) => void;
  /**
   * Direct access for optimistic in-place updates — toggling a like, marking a
   * recipe forked. Use for mutating loaded items, not for adding pages.
   */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
};

export function useInfiniteList<T>({
  fetchPage,
  resetKey,
  getItemKey,
  cacheKey,
}: UseInfiniteListOptions<T>): UseInfiniteListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against IntersectionObserver firing repeatedly while a request is in
  // flight. React state updates are async, so checking isLoadingMore in the
  // observer callback races — the observer can fire several times before the
  // state has settled. A ref updates synchronously and closes that window.
  const inFlightRef = useRef(false);

  // Identifies the current filter generation. A response that arrives after the
  // filters changed belongs to a list the user is no longer looking at, so it is
  // discarded rather than merged into the new one.
  const generationRef = useRef(0);

  const loadPage = useCallback(
    async (nextCursor: string | null, isInitial: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const generation = generationRef.current;

      if (isInitial) setIsLoadingInitial(true);
      else setIsLoadingMore(true);
      setError(null);

      try {
        const page = await fetchPage(nextCursor);
        if (generation !== generationRef.current) return;

        setItems((prev) => {
          if (isInitial) return page.items;
          // Defensive de-duplication. Keyset pagination shouldn't produce
          // overlaps, but a row edited between requests can shift position, and
          // a duplicate React key is a visible bug where a missing row is not.
          const seen = new Set(prev.map(getItemKey));
          return [...prev, ...page.items.filter((i) => !seen.has(getItemKey(i)))];
        });
        if (page.total !== null) setTotal(page.total);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      } catch (err) {
        if (generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load recipes");
      } finally {
        if (generation === generationRef.current) {
          setIsLoadingInitial(false);
          setIsLoadingMore(false);
        }
        inFlightRef.current = false;
      }
    },
    [fetchPage, getItemKey],
  );

  // Scroll offset awaiting restore, applied once the cached rows are painted
  const pendingScrollRef = useRef<number | null>(null);

  const fullCacheKey = cacheKey ? `infinite-list:${cacheKey}:${resetKey}` : null;

  // Reset whenever the filters change, restoring from cache where available
  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = false;
    setError(null);

    const cached = fullCacheKey ? readCache<T>(fullCacheKey) : null;
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      setTotal(cached.total);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
      setIsLoadingInitial(false);
      pendingScrollRef.current = cached.scrollY;
      return;
    }

    setItems([]);
    setTotal(null);
    setCursor(null);
    setHasMore(true);
    void loadPage(null, true);
    // loadPage is intentionally excluded: it depends on fetchPage, which callers
    // rebuild per filter change. resetKey is the single source of truth for when
    // a reset should happen, so including loadPage would double-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, fullCacheKey]);

  // Restore scroll after the restored rows have been laid out. useLayoutEffect
  // runs before paint, so the jump isn't visible to the user.
  useLayoutEffect(() => {
    if (pendingScrollRef.current === null || items.length === 0) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    // rAF gives images and any late layout a frame to settle before we measure
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [items.length]);

  // Persist on unmount — that's the navigation-away moment we need to capture.
  // Writing on every scroll event would serialise the whole list far too often.
  const cacheStateRef = useRef({ items, cursor, hasMore, total });
  cacheStateRef.current = { items, cursor, hasMore, total };

  useEffect(() => {
    if (!fullCacheKey) return;
    return () => {
      const { items: i, cursor: c, hasMore: h, total: t } = cacheStateRef.current;
      if (i.length === 0) return;
      writeCache(fullCacheKey, {
        items: i,
        cursor: c,
        hasMore: h,
        total: t,
        scrollY: window.scrollY,
      });
    };
  }, [fullCacheKey]);

  const retry = useCallback(() => {
    void loadPage(cursor, items.length === 0);
  }, [loadPage, cursor, items.length]);

  // IntersectionObserver on a sentinel below the list. Using a callback ref
  // rather than useRef + useEffect means the observer attaches as soon as the
  // node mounts, including when it is conditionally rendered.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;
          if (inFlightRef.current || !hasMore || error !== null) return;
          void loadPage(cursor, false);
        },
        // Start fetching before the sentinel is actually visible, so the next
        // page is usually there by the time the user reaches the bottom.
        { rootMargin: "400px" },
      );
      observerRef.current.observe(node);
    },
    [cursor, hasMore, error, loadPage],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    items,
    total,
    isLoadingInitial,
    isLoadingMore,
    error,
    hasMore,
    retry,
    sentinelRef,
    setItems,
  };
}
