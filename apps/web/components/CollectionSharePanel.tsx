"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  CollectionShare,
  CollectionShareRole,
  Household,
  PublicUserListItem,
} from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { errorMessage, useToast } from "@/components/ToastProvider";

type Props = {
  collectionId: string;
  /** Whether the collection holds any of the owner's private recipes. */
  hasPrivateRecipes: boolean;
  isPublic: boolean;
  onClose: () => void;
};

const ROLE_LABEL: Record<CollectionShareRole, string> = {
  viewer: "Can view",
  editor: "Can add recipes",
};

/**
 * Share management, owner-only.
 *
 * The panel's job beyond the mechanics is to make the consequence visible
 * before the share happens: sharing a collection grants read access to the
 * recipes in it, private ones included. That is the intended behaviour, but it
 * is not something a person should have to infer.
 */
export default function CollectionSharePanel({
  collectionId,
  hasPrivateRecipes,
  isPublic,
  onClose,
}: Props): React.JSX.Element {
  const { showError } = useToast();

  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [household, setHousehold] = useState<Household | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [role, setRole] = useState<CollectionShareRole>("viewer");
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const api = await getApiClient();
      const [sharesRes, householdRes] = await Promise.all([
        api.collections.shares(collectionId),
        api.households.get(),
      ]);
      if ("error" in sharesRes) throw new Error(sharesRes.error.message);
      setShares(sharesRes.data.shares);
      // A missing household is normal, not a failure — most people won't have
      // one, and the household option simply doesn't appear.
      if (!("error" in householdRes)) setHousehold(householdRes.data);
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load who this is shared with."));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced user search. Same 300ms as the recipe search, so the two feel the
  // same rather than one lagging the other.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchError(null);
        try {
          const api = await getApiClient();
          const res = await api.users.search({ q, limit: 8 });
          if ("error" in res) throw new Error(res.error.message);
          setResults(res.data.users);
        } catch (err) {
          setSearchError(errorMessage(err, "Couldn't search for people."));
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sharedUserIds = new Set(
    shares.map((s) => s.user?.id).filter((id): id is string => Boolean(id)),
  );
  const householdShared = shares.some((s) => s.household !== null);

  async function handleShare(
    target: { userId: string } | { householdId: string },
    key: string,
  ): Promise<void> {
    setSavingFor(key);
    try {
      const api = await getApiClient();
      const res = await api.collections.share(collectionId, { ...target, role });
      if ("error" in res) throw new Error(res.error.message);
      await load();
      setQuery("");
      setResults([]);
    } catch (err) {
      showError(errorMessage(err, "Couldn't share this collection."));
    } finally {
      setSavingFor(null);
    }
  }

  async function handleRevoke(shareId: string): Promise<void> {
    setSavingFor(shareId);
    try {
      const api = await getApiClient();
      const res = await api.collections.revokeShare(collectionId, shareId);
      if ("error" in res) throw new Error(res.error.message);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      showError(errorMessage(err, "Couldn't remove that access."));
    } finally {
      setSavingFor(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Share collection</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* Stated before sharing, not discovered afterwards. */}
          {hasPrivateRecipes && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              This collection contains private recipes. Anyone you share it with
              will be able to read them. They stay private everywhere else, and
              removing someone&apos;s access removes it immediately.
            </p>
          )}

          <div className="mb-4">
            <label className="label">They can</label>
            <div className="flex gap-2">
              {(["viewer", "editor"] as CollectionShareRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    role === r
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            {role === "editor" && isPublic && (
              <p className="mt-2 text-xs text-gray-400">
                This collection is public, so editors can&apos;t add to it —
                adding would publish their recipe. They&apos;ll be able to remove
                recipes only.
              </p>
            )}
            {role === "editor" && !isPublic && (
              <p className="mt-2 text-xs text-gray-400">
                Editors can add their own recipes here. Anything they add becomes
                readable by everyone this collection is shared with.
              </p>
            )}
          </div>

          {household && !householdShared && (
            <button
              type="button"
              onClick={() => { void handleShare({ householdId: household.id }, household.id); }}
              disabled={savingFor === household.id}
              className="mb-4 w-full rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-left text-sm text-gray-600 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400"
            >
              {savingFor === household.id
                ? "Sharing…"
                : `Share with everyone in ${household.name}`}
            </button>
          )}

          <div className="mb-4">
            <label htmlFor="shareSearch" className="label">
              Share with someone
            </label>
            <input
              id="shareSearch"
              className="input"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <p className="mt-2 text-xs text-gray-400">Searching…</p>}
            {searchError && <p className="mt-2 text-xs text-red-600">{searchError}</p>}
            {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">Nobody found by that name.</p>
            )}
            {results.length > 0 && (
              <ul className="mt-2 space-y-1">
                {results.map((person) => {
                  const already = sharedUserIds.has(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => { void handleShare({ userId: person.id }, person.id); }}
                        disabled={savingFor === person.id}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-orange-50 disabled:opacity-50 dark:hover:bg-gray-800"
                      >
                        <span className="text-gray-800 dark:text-gray-200">
                          {person.displayName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {savingFor === person.id
                            ? "Sharing…"
                            : already
                              ? "Change role"
                              : "Share"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Has access
            </h3>
            {loading && <p className="text-xs text-gray-400">Loading…</p>}
            {loadError && <p className="text-xs text-red-600">{loadError}</p>}
            {!loading && !loadError && shares.length === 0 && (
              <p className="text-xs text-gray-400">
                Only you. Nobody else can see this collection.
              </p>
            )}
            <ul className="space-y-1">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                      {share.user?.displayName ??
                        (share.household ? `Everyone in ${share.household.name}` : "Unknown")}
                    </p>
                    <p className="text-xs text-gray-400">{ROLE_LABEL[share.role]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleRevoke(share.id); }}
                    disabled={savingFor === share.id}
                    className="shrink-0 text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                  >
                    {savingFor === share.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
