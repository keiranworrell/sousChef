import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import type { PublicUserListItem } from "@souschef/shared";
import { getApiClient } from "../lib/api";
import { canFollow, toggleFollowIn } from "../lib/follow-state";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

const PAGE = 20;

export type UserListKind = "followers" | "following";

type Props = {
  /** Whose list, and which. Null closes the sheet. */
  target: { userId: string; kind: UserListKind } | null;
  /** The signed-in user, so their own row gets no follow button. */
  ownUserId: string | null;
  onClose: () => void;
};

/**
 * Followers and following, as a sheet.
 *
 * Both lists are the same shape and the same paging, and on a phone they are
 * the same screen with a different title — so one component takes which.
 */
export default function UserListSheet({
  target,
  ownUserId,
  onClose,
}: Props): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const [items, setItems] = useState<PublicUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number): Promise<void> => {
      if (!target) return;
      setError(null);
      try {
        const api = await getApiClient();
        const res =
          target.kind === "followers"
            ? await api.users.followers(target.userId, { limit: PAGE, offset })
            : await api.users.following(target.userId, { limit: PAGE, offset });
        if ("error" in res) throw new Error(res.error.message);
        setItems((prev) => (offset === 0 ? res.data.users : [...prev, ...res.data.users]));
        setTotal(res.data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load that list");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [target],
  );

  useEffect(() => {
    if (!target) return;
    setItems([]);
    setLoading(true);
    void fetchPage(0);
  }, [target, fetchPage]);

  async function handleToggle(item: PublicUserListItem): Promise<void> {
    setBusyId(item.id);
    // Optimistic, then reverted by applying the same toggle again on failure.
    setItems((prev) => toggleFollowIn(prev, item.id));
    try {
      const api = await getApiClient();
      const res = item.isFollowing
        ? await api.users.unfollow(item.id)
        : await api.users.follow(item.id);
      if ("error" in res) throw new Error(res.error.message);
    } catch (err) {
      setItems((prev) => toggleFollowIn(prev, item.id));
      setError(err instanceof Error ? err.message : "Couldn't update that follow");
    } finally {
      setBusyId(null);
    }
  }

  function openProfile(userId: string): void {
    onClose();
    router.push(`/(app)/users/${userId}`);
  }

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {target?.kind === "followers" ? "Followers" : "Following"}
              {total > 0 ? ` · ${total}` : ""}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {loading ? (
            <ActivityIndicator color={palette.accent} style={styles.loading} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(u) => u.id}
              style={styles.list}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (loadingMore || items.length >= total) return;
                setLoadingMore(true);
                void fetchPage(items.length);
              }}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator color={palette.accent} style={styles.footer} /> : null
              }
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {target?.kind === "followers"
                    ? "Nobody yet."
                    : "Not following anyone yet."}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <TouchableOpacity style={styles.rowMain} onPress={() => openProfile(item.id)}>
                    <Avatar displayName={item.displayName} avatarUrl={item.avatarUrl} size={36} />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                      <Text style={styles.meta}>
                        {item.followerCount} {item.followerCount === 1 ? "follower" : "followers"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {canFollow(item.id, ownUserId) && (
                    <FollowButton
                      isFollowing={item.isFollowing}
                      busy={busyId === item.id}
                      onPress={() => { void handleToggle(item); }}
                      size="small"
                    />
                  )}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: t.overlay },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingBottom: 12,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: t.text },
  close: { fontSize: 14, fontWeight: "600", color: t.accent },
  loading: { paddingVertical: 32 },
  footer: { paddingVertical: 16 },
  list: { paddingHorizontal: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600", color: t.text },
  meta: { marginTop: 1, fontSize: 12, color: t.textFaint },
  empty: { paddingVertical: 32, textAlign: "center", fontSize: 13, color: t.textFaint },
  error: { paddingHorizontal: 20, paddingBottom: 6, fontSize: 13, color: t.danger },
});
