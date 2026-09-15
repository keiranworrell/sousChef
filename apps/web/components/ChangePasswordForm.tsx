"use client";

import React, { useState } from "react";
import { updatePassword } from "aws-amplify/auth";

/**
 * Change password while signed in.
 *
 * Entirely client-side: Cognito owns the credential, and Amplify's
 * updatePassword sends the old and new password straight to it over the user's
 * own session. Routing this through our API would mean a plaintext password
 * passing through a Lambda and its logs for no benefit — we would only hand it
 * to Cognito anyway, and with weaker proof of who was asking.
 */
export default function ChangePasswordForm(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset(): void {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    // Checked here rather than left to Cognito: a mistyped confirmation is the
    // user's own typo, and a round trip to tell them so is wasted.
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    if (newPassword === oldPassword) {
      setError("The new password is the same as your current one.");
      return;
    }

    setSaving(true);
    try {
      await updatePassword({ oldPassword, newPassword });
      reset();
      setOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    } catch (err) {
      // Cognito's messages here are user-facing and specific — wrong current
      // password, policy violations, rate limiting — so they're surfaced rather
      // than flattened into one generic line.
      setError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Password</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {done ? "Password changed." : "Change the password you use to sign in."}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { reset(); setOpen(true); }}
            className="btn-secondary shrink-0 text-sm"
          >
            Change password
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4"
        >
          {/* A hidden username field so password managers know which account
              these credentials belong to. Without it they tend to save the new
              password against no account, or offer it on the wrong site. */}
          <input type="text" autoComplete="username" className="hidden" readOnly value="" />
          <div>
            <label htmlFor="currentPassword" className="label">Current password</label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className="input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="label">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save password"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { reset(); setOpen(false); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
