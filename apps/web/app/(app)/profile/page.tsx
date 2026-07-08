"use client";

import React, { useEffect, useRef, useState } from "react";
import type { User } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const DIETARY_SUGGESTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "pescatarian",
  "low-carb",
  "keto",
];

export default function ProfilePage(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [prefInput, setPrefInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const prefInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if ("error" in res) throw new Error(res.error.message);
        const u = res.data;
        setUser(u);
        setDisplayName(u.displayName);
        setBio(u.bio ?? "");
        setDietaryPreferences(u.dietaryPreferences ?? []);
        setAvatarUrl(u.avatarUrl ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function addPreference(value: string): void {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !dietaryPreferences.includes(trimmed)) {
      setDietaryPreferences((prev) => [...prev, trimmed]);
    }
    setPrefInput("");
  }

  function removePreference(pref: string): void {
    setDietaryPreferences((prev) => prev.filter((p) => p !== pref));
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const api = await getApiClient();
      const presignRes = await api.images.presign(file.type, "avatar");
      if ("error" in presignRes) throw new Error(presignRes.error.message);
      const { uploadUrl, imageUrl: cdnUrl } = presignRes.data;
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setAvatarUrl(cdnUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const api = await getApiClient();
      const res = await api.users.update({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || null,
        dietaryPreferences: dietaryPreferences.length > 0 ? dietaryPreferences : null,
        avatarUrl: avatarUrl || null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setUser(res.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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
        <p className="text-sm text-red-600">{error ?? "Failed to load profile"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Profile</h1>

      <form onSubmit={(e) => { void handleSave(e); }} className="space-y-8">

        {/* Avatar */}
        <section className="flex items-center gap-6">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-bold text-orange-500">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition ${avatarUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => { void handleAvatarSelect(e); }}
                disabled={avatarUploading}
              />
              {avatarUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </label>
            {avatarUrl && !avatarUploading && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="ml-3 text-sm text-gray-400 hover:text-red-500"
              >
                Remove
              </button>
            )}
            {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
          </div>
        </section>

        {/* Display name */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Basic info</h2>
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={100}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input bg-gray-50 text-gray-400 cursor-not-allowed"
              value={user.email}
              disabled
            />
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="A little about you and how you cook…"
            />
            <p className="mt-1 text-xs text-gray-400">{bio.length}/500</p>
          </div>
        </section>

        {/* Dietary preferences */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dietary preferences</h2>
          <p className="text-xs text-gray-400">These will be used to personalise recipe suggestions in future.</p>

          <div className="flex flex-wrap gap-1.5">
            {dietaryPreferences.map((pref) => (
              <span
                key={pref}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700"
              >
                {pref}
                <button
                  type="button"
                  onClick={() => removePreference(pref)}
                  className="text-orange-400 hover:text-orange-700"
                  aria-label={`Remove ${pref}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              ref={prefInputRef}
              className="input flex-1 text-sm"
              placeholder="e.g. vegetarian, gluten-free — press Enter to add"
              value={prefInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.endsWith(",")) {
                  addPreference(val.slice(0, -1));
                } else {
                  setPrefInput(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPreference(prefInput);
                }
              }}
            />
          </div>

          {/* Quick-add suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {DIETARY_SUGGESTIONS.filter((s) => !dietaryPreferences.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addPreference(s)}
                className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:border-orange-300 hover:text-orange-600 transition"
              >
                + {s}
              </button>
            ))}
          </div>
        </section>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveSuccess && (
            <p className="text-sm text-green-600 font-medium">✓ Saved</p>
          )}
        </div>
      </form>
    </div>
  );
}
