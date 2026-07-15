"use client";

import React, { useEffect, useState } from "react";
import type { Notification } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Notification item ──────────────────────────────────────────────────────────

type InviteStatus = "pending" | "accepting" | "declining" | "accepted" | "declined";

function HouseholdInviteItem({
  notification,
}: {
  notification: Notification;
}): React.JSX.Element {
  const [status, setStatus] = useState<InviteStatus>("pending");

  const data = notification.data ?? {};
  const inviteId = data.inviteId as string | undefined;
  const householdName = (data.householdName as string | undefined) ?? "a household";
  const inviterName = (data.inviterName as string | undefined) ?? "Someone";
  const unseen = notification.seenAt === null;

  async function handleAccept(): Promise<void> {
    if (!inviteId) return;
    setStatus("accepting");
    try {
      const api = await getApiClient();
      await api.households.acceptInvite(inviteId);
      setStatus("accepted");
    } catch {
      setStatus("pending");
    }
  }

  async function handleDecline(): Promise<void> {
    if (!inviteId) return;
    setStatus("declining");
    try {
      const api = await getApiClient();
      await api.households.declineInvite(inviteId);
      setStatus("declined");
    } catch {
      setStatus("pending");
    }
  }

  return (
    <div className="py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {unseen ? (
            <span className="block h-2 w-2 rounded-full bg-orange-400" />
          ) : (
            <span className="block h-2 w-2 rounded-full bg-gray-200" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">
            <span className="font-semibold">{inviterName}</span>
            {" invited you to join "}
            <span className="font-semibold">{householdName}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{timeAgo(notification.createdAt)}</p>

          {/* Action buttons */}
          {(status === "pending" || status === "accepting" || status === "declining") && (
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => { void handleAccept(); }}
                disabled={status !== "pending"}
                className="rounded-lg border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
              >
                {status === "accepting" ? "Joining…" : "Accept"}
              </button>
              <button
                onClick={() => { void handleDecline(); }}
                disabled={status !== "pending"}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition disabled:opacity-50"
              >
                {status === "declining" ? "Declining…" : "Decline"}
              </button>
            </div>
          )}

          {status === "accepted" && (
            <p className="mt-2 text-xs font-medium text-orange-500">
              ✓ Joined {householdName}
            </p>
          )}
          {status === "declined" && (
            <p className="mt-2 text-xs text-gray-400">Invitation declined</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function NotificationPanel({
  onClose,
  onRead,
}: {
  onClose: () => void;
  onRead: () => void;
}): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.notifications.list();
        if ("error" in res) return;
        setNotifications(res.data.notifications);
        // Mark all seen in the background
        void api.notifications.markAllSeen();
        onRead();
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onRead]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-1">
          {loading && (
            <p className="py-6 text-sm text-center text-gray-400">Loading…</p>
          )}
          {!loading && notifications.length === 0 && (
            <p className="py-6 text-sm text-center text-gray-400">
              No notifications yet.
            </p>
          )}
          {notifications.map((n) => {
            if (n.type === "household_invite") {
              return <HouseholdInviteItem key={n.id} notification={n} />;
            }
            // Generic fallback for future notification types
            return (
              <div key={n.id} className="py-3 flex items-start gap-3 border-b border-gray-50 last:border-0">
                <div className="mt-1.5 shrink-0">
                  {n.seenAt === null ? (
                    <span className="block h-2 w-2 rounded-full bg-orange-400" />
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-gray-200" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-700">{n.type}</p>
                  <p className="text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
