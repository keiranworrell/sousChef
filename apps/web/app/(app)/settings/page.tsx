"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import type { User } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if ("error" in res) throw new Error(res.error.message);
        setUser(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleDeleteAccount(): Promise<void> {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const api = await getApiClient();
      const res = await api.users.deleteAccount();
      if ("error" in res) throw new Error(res.error.message);
      await signOut();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Failed to load account"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

        {/* Account info */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Account</h2>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Display name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.displayName}</p>
              </div>
              <Link href="/profile" className="text-sm text-orange-500 hover:underline shrink-0">
                Edit profile →
              </Link>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{user.email}</p>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Plan</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{user.planTier}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">Danger zone</h2>
          <div className="rounded-xl border border-red-200 dark:border-red-900 px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Delete account</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Permanently deletes your account, recipes, pantry, and all data. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setDeleteConfirm("");
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="shrink-0 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition"
            >
              Delete account
            </button>
          </div>
        </section>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { if (!deleting) setShowDeleteModal(false); }}
          />
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Delete your account?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This will permanently delete your account and all associated data — recipes, pantry, shopping lists, collections, fermentation batches, and meal plans.
              <span className="font-semibold text-gray-700 dark:text-gray-300"> This cannot be undone.</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                className="input w-full font-mono"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                autoFocus
                disabled={deleting}
              />
            </div>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleDeleteAccount(); }}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
