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
import type { RediscoverMode, RediscoverRecipe } from "@souschef/shared";
import { timeAgo } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

const MODES: { id: RediscoverMode; label: string; blurb: string }[] = [
  {
    id: "cook-again",
    label: "Cook again",
    blurb: "Things you've made before and haven't for a while.",
  },
  {
    id: "never-tried",
    label: "Never tried",
    blurb: "Recipes you saved and have never actually cooked.",
  },
];

/**
 * Your own recipes, resurfaced.
 *
 * The whole point of this screen is that a recipe collection past a few dozen
 * becomes a list you scroll past the same six entries in. Nothing here is
 * recommendation in the clever sense — the server picks on last-cooked dates —
 * which is worth knowing because it means it costs nothing and always works.
 */
export default function RediscoverScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<RediscoverMode>("cook-again");
  const [recipes, setRecipes] = useState<RediscoverRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: RediscoverMode): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.rediscover(which);
      if ("error" in res) throw new Error(res.error.message);
      setRecipes(res.data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load these");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(mode);
  }, [mode, load]);

  const active = MODES.find((m) => m.id === mode)!;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rediscover</Text>
      </View>

      <View style={styles.tabs}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.tab, mode === m.id && styles.tabActive]}
            onPress={() => setMode(m.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m.id }}
          >
            <Text style={[styles.tabText, mode === m.id && styles.tabTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.blurb}>{active.blurb}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(mode); }}
              tintColor="#f97316"
            />
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {mode === "cook-again"
                    ? "Nothing to bring back yet."
                    : "You've cooked everything you've saved."}
                </Text>
                <Text style={styles.emptyHint}>
                  {mode === "cook-again"
                    ? "Log a few cooks and this fills up with things worth repeating."
                    : "Add a recipe you haven't got round to and it'll show up here."}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/recipes/${item.id}`)}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {/* The date is the reason this recipe is on the list, so it
                      leads. "Never cooked" is a fact, not a missing value. */}
                  {item.lastCookedAt
                    ? `Last cooked ${timeAgo(item.lastCookedAt)}`
                    : "Never cooked"}
                  {item.cookTimeMinutes ? ` · ${item.cookTimeMinutes} min` : ""}
                  {item.cuisine ? ` · ${item.cuisine}` : ""}
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
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: "#fff7ed", borderColor: "#f97316" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#ea580c" },
  blurb: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: "#9ca3af", lineHeight: 17 },
  list: { padding: 16, paddingTop: 4, gap: 10 },
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
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#f3f4f6" },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#374151", textAlign: "center" },
  emptyHint: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19 },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 },
});
