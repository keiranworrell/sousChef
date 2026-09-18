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
import type { PublicCollectionSummary } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";

const PAGE = 20;

/**
 * Public collections, from everyone.
 *
 * Exists mainly so the public collection screen is reachable at all — a shared
 * link would open one, but nothing in the app led anywhere near them.
 */
export default function PublicCollectionsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [collections, setCollections] = useState<PublicCollectionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.listPublic({ limit: PAGE, offset });
      if ("error" in res) throw new Error(res.error.message);
      setCollections((prev) =>
        offset === 0 ? res.data.collections : [...prev, ...res.data.collections],
      );
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load collections");
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
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Community</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Public collections</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" />
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
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
            if (loadingMore || collections.length >= total) return;
            setLoadingMore(true);
            void fetchPage(collections.length);
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#f97316" style={styles.footer} /> : null
          }
          ListEmptyComponent={
            !error ? (
              <Text style={styles.empty}>No public collections yet.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/community/collections/${item.id}`)}
            >
              {item.coverImageUrl ? (
                <Image
                  source={{ uri: item.coverImageUrl }}
                  style={styles.cover}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.cover, styles.coverEmpty]} />
              )}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.recipeCount} {item.recipeCount === 1 ? "recipe" : "recipes"}
                  {` · by ${item.ownerName}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 4 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: "600", color: "#f97316" },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
  },
  cover: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#f3f4f6" },
  coverEmpty: { borderWidth: 1, borderColor: "#f3f4f6" },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 13, color: "#9ca3af" },
  footer: { paddingVertical: 16 },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 },
});
