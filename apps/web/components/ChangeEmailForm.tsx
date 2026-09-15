"use client";

import React, { useState } from "react";
import {
  confirmUserAttribute,
  fetchAuthSession,
  sendUserAttributeVerificationCode,
  updateUserAttribute,
} from "aws-amplify/auth";
import { getApiClient } from "@/lib/api";

type Props = {
  currentEmail: string;
  /** Called once the new address is confirmed, so the page can show it. */
  onChanged: (newEmail: string) => void;
};

type Stage = "idle" | "entering" | "confirming";

/**
 * Change the email address on the account.
 *
 * Two steps, because an unverified email change is worse than none: Cognito
 * takes the new address, sends a code to it, and only swaps the attribute over
 * once that code comes back. That proves the person asking actually controls
 * the address before anything depends on it — password resets, notifications,
 * and account recovery all key off this.
 *
 * Nothing here posts the new address to our own API. Our users row is a cache
 * of what Cognito has verified, and it is reconciled server-side from the
 * token's email claim on the next request; see the users Lambda. An endpoint
 * that accepted an email from the client would let anyone claim any address.
 */
export default function ChangeEmailForm({
  currentEmail,
  onChanged,
}: Props): React.JSX.Element {
  const [stage, setStage] = useState<Stage>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset(): void {
    setNewEmail("");
    setCode("");
    setError(null);
    setNotice(null);
  }

  async function handleRequest(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const trimmed = newEmail.trim().toLowerCase();
    if (trimmed === currentEmail.toLowerCase()) {
      setError("That's already your email address.");
      return;
    }

    setBusy(true);
    try {
      const result = await updateUserAttribute({
        userAttribute: { attributeKey: "email", value: trimmed },
      });

      // Cognito may accept the change outright if the pool doesn't require
      // verification. Handling both outcomes rather than assuming the code step
      // means a pool config change can't leave the user stuck on a screen
      // waiting for an email that will never arrive.
      if (result.nextStep.updateAttributeStep === "CONFIRM_ATTRIBUTE_WITH_CODE") {
        setStage("confirming");
        setNotice(`We've sent a code to ${trimmed}. Enter it to finish.`);
      } else {
        await finish(trimmed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the email change.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmUserAttribute({
        userAttributeKey: "email",
        confirmationCode: code.trim(),
      });
      await finish(newEmail.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code wasn't accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(confirmedEmail: string): Promise<void> {
    // Force a token refresh so the ID token carries the new email claim. Without
    // this the old claim persists until the token expires, and the server-side
    // reconciliation would keep writing the old address back.
    try {
      await fetchAuthSession({ forceRefresh: true });
      const api = await getApiClient();
      // Any authenticated call triggers the reconciliation; /users/me is the one
      // whose response we can also use.
      await api.users.me();
    } catch {
      // The change itself succeeded in Cognito, which is what matters. A failed
      // refresh only delays our copy catching up until the next request, so it
      // is not worth showing the user an error about.
    }

    onChanged(confirmedEmail);
    reset();
    setStage("idle");
  }

  async function handleResend(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await sendUserAttributeVerificationCode({ userAttributeKey: "email" });
      setNotice(`We've sent another code to ${newEmail.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email address</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">{currentEmail}</p>
        </div>
        {stage === "idle" && (
          <button
            type="button"
            onClick={() => { reset(); setStage("entering"); }}
            className="btn-secondary shrink-0 text-sm"
          >
            Change email
          </button>
        )}
      </div>

      {stage === "entering" && (
        <form
          onSubmit={(e) => { void handleRequest(e); }}
          className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4"
        >
          <div>
            <label htmlFor="newEmail" className="label">New email address</label>
            <input
              id="newEmail"
              type="email"
              autoComplete="email"
              className="input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">
              We&apos;ll send a code to the new address to confirm it&apos;s yours.
              Your sign-in email only changes once you enter that code.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { reset(); setStage("idle"); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {stage === "confirming" && (
        <form
          onSubmit={(e) => { void handleConfirm(e); }}
          className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4"
        >
          {notice && <p className="text-xs text-gray-500 dark:text-gray-400">{notice}</p>}
          <div>
            <label htmlFor="emailCode" className="label">Confirmation code</label>
            <input
              id="emailCode"
              // Not type="number": codes are digit strings, and number inputs
              // strip leading zeros and add spinners nobody wants.
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Confirming…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { void handleResend(); }}
              disabled={busy}
            >
              Resend code
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { reset(); setStage("idle"); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
