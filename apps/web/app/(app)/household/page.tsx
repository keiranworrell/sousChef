"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Household, PublicUserListItem } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

// ── Create household form ──────────────────────────────────────────────────────

function CreateHouseholdForm({
  onCreate,
}: {
  onCreate: (household: Household) => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.households.create(name.trim());
      if ("error" in res) { setError(res.error.message); return; }
      onCreate(res.data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Create a household</h2>
        <p className="text-sm text-gray-500 mb-6">
          Give your household a name. You can then invite others to join and share
          your pantry, shopping lists, and meal plans.
        </p>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Household name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smith's"
              maxLength={60}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create household"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Invite search ──────────────────────────────────────────────────────────────

function InviteSearch({
  memberUserIds,
}: {
  memberUserIds: Set<string>;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const api = await getApiClient();
      const res = await api.users.search({ q, limit: 8 });
      if ("error" in res) { setSearchError(res.error.message); return; }
      setResults(res.data.users);
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void search(query); }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function handleInvite(userId: string): Promise<void> {
    setInviting(userId);
    try {
      const api = await getApiClient();
      const res = await api.households.invite(userId);
      if (!("error" in res)) setInvited((prev) => new Set([...prev, userId]));
    } finally {
      setInviting(null);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Invite someone</h3>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
        )}
      </div>
      {searchError && <p className="mt-2 text-xs text-red-600">{searchError}</p>}
      {results.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white divide-y divide-gray-50 shadow-sm">
          {results.map((user) => {
            const isMember = memberUserIds.has(user.id);
            const isInvited = invited.has(user.id);
            return (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="h-8 w-8 rounded-full object-cover border border-gray-200 shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-gray-900">{user.displayName}</span>
                {isMember ? (
                  <span className="text-xs text-gray-400">Already a member</span>
                ) : isInvited ? (
                  <span className="text-xs font-medium text-orange-500">Invited ✓</span>
                ) : (
                  <button
                    onClick={() => { void handleInvite(user.id); }}
                    disabled={inviting === user.id}
                    className="shrink-0 rounded-lg border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    {inviting === user.id ? "Inviting…" : "Invite"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!searching && query.trim() && results.length === 0 && (
        <p className="mt-3 text-sm text-gray-400 text-center">No users found.</p>
      )}
    </div>
  );
}

// ── Household view ─────────────────────────────────────────────────────────────

function HouseholdView({
  household,
  currentUserId,
  onLeft,
  onDeleted,
  onRenamed,
}: {
  household: Household;
  currentUserId: string;
  onLeft: () => void;
  onDeleted: () => void;
  onRenamed: (updated: Household) => void;
}): React.JSX.Element {
  const isOwner = household.ownerId === currentUserId;
  const memberUserIds = new Set(household.members.map((m) => m.userId));

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(household.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Leave / delete state
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!renameValue.trim() || renameValue.trim() === household.name) {
      setRenaming(false);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const api = await getApiClient();
      const res = await api.households.rename(renameValue.trim());
      if ("error" in res) { setRenameError(res.error.message); return; }
      onRenamed(res.data);
      setRenaming(false);
    } catch {
      setRenameError("Failed to rename. Try again.");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleLeave(): Promise<void> {
    const confirmed = confirm(
      household.members.length === 1
        ? "You're the only member. Leaving will delete the household and all its shared data. Are you sure?"
        : isOwner
          ? "You're the owner. Ownership will transfer to the longest-standing member. Are you sure you want to leave?"
          : "Are you sure you want to leave this household?"
    );
    if (!confirmed) return;
    setLeaving(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      await api.households.leave();
      onLeft();
    } catch {
      setActionError("Failed to leave household. Try again.");
      setLeaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm(`Delete "${household.name}"? This will permanently remove the household and all its shared pantry items, shopping lists, and meal plans. This cannot be undone.`)) return;
    setDeleting(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      await api.households.delete();
      onDeleted();
    } catch {
      setActionError("Failed to delete household. Try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {renaming ? (
            <form onSubmit={(e) => { void handleRename(e); }} className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={60}
                className="rounded-lg border border-orange-400 px-3 py-1.5 text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-100 w-full max-w-xs"
              />
              <button
                type="submit"
                disabled={renameSaving || !renameValue.trim()}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
              >
                {renameSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setRenaming(false); setRenameValue(household.name); setRenameError(null); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{household.name}</h1>
              {isOwner && (
                <button
                  onClick={() => { setRenameValue(household.name); setRenaming(true); }}
                  className="text-gray-400 hover:text-gray-600 transition"
                  aria-label="Rename household"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {renameError && <p className="mt-1 text-sm text-red-600">{renameError}</p>}
          <p className="mt-1 text-sm text-gray-500">
            {household.members.length} {household.members.length === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Members</h3>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {household.members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.displayName} className="h-9 w-9 rounded-full object-cover border border-gray-200 shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="flex-1 text-sm font-medium text-gray-900">{member.displayName}</p>
              {member.userId === household.ownerId && (
                <span className="text-xs text-gray-400 rounded-full border border-gray-200 px-2 py-0.5">Owner</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      <InviteSearch memberUserIds={memberUserIds} />

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-red-50/40 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Manage membership</h3>
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { void handleLeave(); }}
            disabled={leaving || deleting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-red-300 hover:text-red-600 transition disabled:opacity-50"
          >
            {leaving ? "Leaving…" : "Leave household"}
          </button>
          {isOwner && (
            <button
              onClick={() => { void handleDelete(); }}
              disabled={leaving || deleting}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete household"}
            </button>
          )}
        </div>
        {isOwner && (
          <p className="text-xs text-gray-400">
            Deleting the household permanently removes all shared pantry items, shopping lists, and meal plans.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HouseholdPage(): React.JSX.Element {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const [householdRes, meRes] = await Promise.all([
          api.households.get(),
          api.users.me(),
        ]);
        if ("error" in householdRes) { setError(householdRes.error.message); return; }
        setHousehold(householdRes.data);
        if (!("error" in meRes)) setCurrentUserId(meRes.data.id);
      } catch {
        setError("Failed to load household.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-10"><p className="text-sm text-gray-400">Loading…</p></div>;
  }

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-10"><p className="text-sm text-red-600">{error}</p></div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {household == null ? (
        <CreateHouseholdForm onCreate={setHousehold} />
      ) : (
        <HouseholdView
          household={household}
          currentUserId={currentUserId ?? ""}
          onLeft={() => { router.refresh(); setHousehold(null); }}
          onDeleted={() => { router.refresh(); setHousehold(null); }}
          onRenamed={(updated) => setHousehold(updated)}
        />
      )}
    </div>
  );
}
