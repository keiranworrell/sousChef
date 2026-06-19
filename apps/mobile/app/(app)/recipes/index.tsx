import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import type { Recipe } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

export default function RecipeListScreen(): React.JSX.Element {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false): Promise<void> => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.list();
      if ("error" in res) throw new Error(res.error.message);
      setRecipes(res.data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function onRefresh(): void {
    setRefreshing(true);
    void load(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My recipes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(app)/recipes/new")}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recipes yet.</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/(app)/recipes/new")}
            >
              <Text style={styles.addButtonText}>Add your first recipe</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const totalMins = (item.prepTimeMinutes ?? 0) + (item.cookTimeMinutes ?? 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/recipes/${item.id}`)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.difficulty && (
                  <Text style={styles.badge}>{item.difficulty}</Text>
                )}
              </View>
              {item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item.servings} servings</Text>
                {totalMins > 0 && <Text style={styles.metaText}>{totalMins} min</Text>}
                {item.cuisine && <Text style={styles.metaText}>{item.cuisine}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "#6b7280" },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  badge: { backgroundColor: "#fff7ed", color: "#f97316", fontSize: 11, fontWeight: "600", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, textTransform: "capitalize" },
  cardDesc: { marginTop: 4, fontSize: 13, color: "#6b7280" },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: "#9ca3af" },
  addButton: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
