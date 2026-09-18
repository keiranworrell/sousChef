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
import type { CookHistoryEntry } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import StarRating from "../../../components/StarRating";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

const PAGE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/**
 * Everything you've cooked, across every recipe.
 *
 * The per-recipe log on a recipe page answers "how did this go last time".
 * This answers "what have I actually been cooking", which is a different
 * question and the one that is interesting after a few months.
 */
export default function CookHistoryScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [entries, setEntries] = useState<CookHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.cookHistory.list({ limit: PAGE, offset });
      if ("error" in res) throw new Error(res.error.message);
      setEntries((prev) => (offset === 0 ? res.data.entries : [...prev, ...res.data.entries]));
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your cook history");
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
        <Text style={styles.title}>Cook history</Text>
        {total > 0 && (
          <Text style={styles.subtitle}>
            {total} {total === 1 ? "cook" : "cooks"} · private to you
          </Text>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchPage(0); }}
              tintColor={palette.accent}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (loadingMore || entries.length >= total) return;
            setLoadingMore(true);
            void fetchPage(entries.length);
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={palette.accent} style={styles.footer} /> : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No cooks logged yet.</Text>
                <Text style={styles.emptyHint}>
                  Log one from a recipe, or when you finish cooking mode.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/(app)/recipes/${item.recipeId}`)}
            >
              {item.recipe.imageUrl ? (
                <Image
                  source={{ uri: item.recipe.imageUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.recipeTitle} numberOfLines={1}>{item.recipe.title}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.date}>{formatDate(item.cookedAt)}</Text>
                  {item.rating !== null && <StarRating value={item.rating} size={12} />}
                </View>
                {item.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: t.text },
  subtitle: { marginTop: 2, fontSize: 12, color: t.textFaint },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: t.surfaceSunken },
  thumbEmpty: { borderWidth: 1, borderColor: t.border },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  recipeTitle: { fontSize: 14, fontWeight: "600", color: t.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 12, color: t.textFaint, fontVariant: ["tabular-nums"] },
  notes: { fontSize: 12, color: t.textMuted, lineHeight: 17 },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: t.textSecondary },
  emptyHint: { fontSize: 13, color: t.textFaint, textAlign: "center", lineHeight: 19 },
  footer: { paddingVertical: 16 },
  error: { color: t.danger, fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 },
});
