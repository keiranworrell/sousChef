import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Notification } from "@souschef/shared";
import { timeAgo } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

/**
 * Notifications, which on mobile exist mainly so household invites can be
 * accepted.
 *
 * Accepting an invite lives nowhere else — not on the household screen, not in
 * settings — on web either. So a phone with a household screen but no
 * notifications can create a household and invite people to it, while anyone
 * invited from a phone has no way to join. That is why this screen shipped in
 * the same change rather than waiting for a notifications PR of its own.
 */
export default function NotificationsScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.notifications.list();
      if ("error" in res) throw new Error(res.error.message);
      setNotifications(res.data.notifications);

      // Mark seen in the background. Deliberately after the list is in state:
      // the unread dots are drawn from what was fetched, so they survive this
      // screen and only disappear on the next visit. Clearing them under the
      // user's thumb is how you lose track of what you had just read.
      void api.notifications.markAllSeen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nothing yet.</Text>
                <Text style={styles.emptyHint}>
                  Household invites and collections shared with you land here.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationRow notification={item} router={router} />
          )}
        />
      )}
    </View>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  router,
}: {
  notification: Notification;
  router: ReturnType<typeof useRouter>;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  if (notification.type === "household_invite") {
    return <HouseholdInviteRow notification={notification} />;
  }

  if (notification.type === "collection_shared") {
    const data = notification.data ?? {};
    const name = data.collectionName ?? "a collection";
    const sharer = data.sharerName ?? "Someone";
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          router.push(
            data.collectionId
              ? `/(app)/collections/${data.collectionId}`
              : "/(app)/collections",
          )
        }
      >
        <Dot unseen={notification.seenAt === null} />
        <View style={styles.rowBody}>
          <Text style={styles.message}>
            <Text style={styles.strong}>{sharer}</Text> shared{" "}
            <Text style={styles.strong}>{name}</Text> with you
            {data.role === "editor" ? " — you can add recipes to it" : ""}
          </Text>
          <Text style={styles.when}>{timeAgo(notification.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // A type this build predates. Better a dated placeholder than a blank gap
  // where a real notification should be — at least it is visibly something.
  return (
    <View style={styles.row}>
      <Dot unseen={notification.seenAt === null} />
      <View style={styles.rowBody}>
        <Text style={styles.message}>You have a new notification.</Text>
        <Text style={styles.when}>{timeAgo(notification.createdAt)}</Text>
      </View>
    </View>
  );
}

type InviteState = "pending" | "working" | "accepted" | "declined";

function HouseholdInviteRow({
  notification,
}: {
  notification: Notification;
}): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<InviteState>("pending");
  const [error, setError] = useState<string | null>(null);

  const data = notification.data ?? {};
  const inviteId = data.inviteId;
  const householdName = data.householdName ?? "a household";
  const inviterName = data.inviterName ?? "Someone";

  async function respond(accept: boolean): Promise<void> {
    if (!inviteId) return;
    setState("working");
    setError(null);
    try {
      const api = await getApiClient();
      const res = accept
        ? await api.households.acceptInvite(inviteId)
        : await api.households.declineInvite(inviteId);
      if ("error" in res) throw new Error(res.error.message);
      setState(accept ? "accepted" : "declined");
    } catch (err) {
      setState("pending");
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  }

  return (
    <View style={styles.row}>
      <Dot unseen={notification.seenAt === null} />
      <View style={styles.rowBody}>
        <Text style={styles.message}>
          <Text style={styles.strong}>{inviterName}</Text> invited you to join{" "}
          <Text style={styles.strong}>{householdName}</Text>
        </Text>
        <Text style={styles.when}>{timeAgo(notification.createdAt)}</Text>

        {error && <Text style={styles.rowError}>{error}</Text>}

        {/* An invite with no inviteId cannot be acted on. Saying so beats two
            buttons that quietly do nothing. */}
        {!inviteId ? (
          <Text style={styles.outcomeMuted}>This invite is no longer valid.</Text>
        ) : state === "accepted" ? (
          <Text style={styles.outcome}>✓ You joined {householdName}</Text>
        ) : state === "declined" ? (
          <Text style={styles.outcomeMuted}>Invitation declined</Text>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.accept, state === "working" && styles.disabled]}
              onPress={() => { void respond(true); }}
              disabled={state === "working"}
            >
              {state === "working"
                ? <ActivityIndicator color={palette.onAccent} size="small" />
                : <Text style={styles.acceptText}>Accept</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.decline, state === "working" && styles.disabled]}
              onPress={() => { void respond(false); }}
              disabled={state === "working"}
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === "accepted" && (
          // Accepting leaves any previous household, which the server does
          // silently. Someone who did not realise they were in one should not
          // have to discover it from a missing shopping list.
          <Text style={styles.outcomeMuted}>
            You'll now see anything shared with {householdName}.
          </Text>
        )}
      </View>
    </View>
  );
}

function Dot({ unseen }: { unseen: boolean }): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.dot, unseen ? styles.dotUnseen : styles.dotSeen]} />;
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: t.text },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 14,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  dotUnseen: { backgroundColor: t.accent },
  dotSeen: { backgroundColor: t.border },
  message: { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  strong: { fontWeight: "700", color: t.text },
  when: { fontSize: 12, color: t.textFaint },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  accept: {
    backgroundColor: t.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 82,
    alignItems: "center",
  },
  acceptText: { color: t.onAccent, fontWeight: "600", fontSize: 13 },
  decline: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  declineText: { color: t.textSecondary, fontWeight: "600", fontSize: 13 },
  outcome: { marginTop: 6, fontSize: 13, fontWeight: "600", color: t.accent },
  outcomeMuted: { marginTop: 6, fontSize: 12, color: t.textFaint, lineHeight: 17 },
  rowError: { marginTop: 4, fontSize: 12, color: t.danger },
  disabled: { opacity: 0.5 },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: t.textSecondary },
  emptyHint: { fontSize: 13, color: t.textFaint, textAlign: "center", lineHeight: 19 },
  error: { color: t.danger, fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 },
});
