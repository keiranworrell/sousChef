import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FeedActivity } from "@souschef/shared";
import { timeAgo } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { describeActivity } from "../../../lib/feed-activity";
import Avatar from "../../../components/Avatar";

const PAGE = 20;

/**
 * What the people you follow have been doing.
 *
 * Offset paging, not cursor: that is what `/feed` offers. Fine for a list
 * nobody scrolls very far down, and worth noting only because every other list
 * in the app is cursor-based and the difference is not an oversight here.
 */
export default function FeedScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.feed.list({ limit: PAGE, offset });
      if ("error" in res) throw new Error(res.error.message);
      setActivities((prev) =>
        offset === 0 ? res.data.activities : [...prev, ...res.data.activities],
      );
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { void fetchPage(0); }, [fetchPage]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchPage(0); }}
              tintColor="#f97316"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (loadingMore || activities.length >= total) return;
            setLoadingMore(true);
            void fetchPage(activities.length);
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#f97316" style={styles.footer} /> : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nothing here yet.</Text>
                <Text style={styles.emptyHint}>
                  Follow some cooks and you'll see what they add and cook.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => router.push("/(app)/community")}
                >
                  <Text style={styles.emptyCtaText}>Browse the community</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const { verb } = describeActivity(item);
            return (
              <View style={styles.row}>
                <TouchableOpacity onPress={() => router.push(`/(app)/users/${item.user.id}`)}>
                  <Avatar
                    displayName={item.user.displayName}
                    avatarUrl={item.user.avatarUrl}
                    size={36}
                  />
                </TouchableOpacity>

                <View style={styles.rowBody}>
                  <Text style={styles.sentence}>
                    <Text
                      style={styles.strong}
                      onPress={() => router.push(`/(app)/users/${item.user.id}`)}
                    >
                      {item.user.displayName}
                    </Text>
                    {` ${verb} `}
                    <Text
                      style={styles.strong}
                      onPress={() => router.push(`/(app)/community/${item.recipe.id}`)}
                    >
                      {item.recipe.title}
                    </Text>
                  </Text>
                  <Text style={styles.when}>{timeAgo(item.occurredAt)}</Text>
                </View>

                {item.recipe.imageUrl ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/(app)/community/${item.recipe.id}`)}
                  >
                    <Image
                      source={{ uri: item.recipe.imageUrl }}
                      style={styles.thumb}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  sentence: { fontSize: 14, color: "#374151", lineHeight: 20 },
  strong: { fontWeight: "700", color: "#111827" },
  when: { fontSize: 12, color: "#9ca3af" },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#f3f4f6" },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  emptyHint: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19 },
  emptyCta: {
    marginTop: 8,
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyCtaText: { fontSize: 13, fontWeight: "700", color: "#ea580c" },
  footer: { paddingVertical: 16 },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 },
});
