import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "aws-amplify/auth";
import type { RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function CommunityScreen(): React.JSX.Element {
  const router = useRouter();

  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [tag, setTag] = useState("");

  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [forkingId, setForkingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (params: { q: string; cuisine: string; tag: string; offset: number }): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const api = await getApiClient();
        const res = await api.community.list({
          q: params.q || undefined,
          cuisine: params.cuisine || undefined,
          tag: params.tag || undefined,
          limit,
          offset: params.offset,
        });
        if ("error" in res) throw new Error(res.error.message);
        setRecipes(res.data.recipes);
        setTotal(res.data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      void load({ q, cuisine, tag, offset: 0 });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, cuisine, tag, load]);

  useEffect(() => {
    void load({ q, cuisine, tag, offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function handleFork(recipe: RecipeWithDetails): Promise<void> {
    setForkingId(recipe.id);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(recipe.id);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/(app)/recipes/${res.data.id}`);
    } catch (err) {
      Alert.alert("Fork failed", err instanceof Error ? err.message : "Something went wrong");
      setForkingId(null);
    }
  }

  function handleSignOut(): void {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Community</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutLink}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Search / filters */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          placeholder="Search recipes…"
          value={q}
          onChangeText={setQ}
          placeholderTextColor="#9ca3af"
        />
      </View>
      <View style={styles.filterRow}>
        <TextInput
          style={[styles.input, styles.filterInput]}
          placeholder="Cuisine"
          value={cuisine}
          onChangeText={setCuisine}
          placeholderTextColor="#9ca3af"
        />
        <TextInput
          style={[styles.input, styles.filterInput]}
          placeholder="Tag"
          value={tag}
          onChangeText={setTag}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && recipes.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No public recipes found.</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const totalMins = (item.prepTimeMinutes ?? 0) + (item.cookTimeMinutes ?? 0);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/(app)/community/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                    <View style={styles.cardMeta}>
                      <Text style={styles.metaText}>{item.servings} servings</Text>
                      {totalMins > 0 && <Text style={styles.metaText}>{totalMins} min</Text>}
                      {item.cuisine ? <Text style={styles.metaText}>{item.cuisine}</Text> : null}
                      {item.difficulty ? (
                        <Text style={styles.difficultyBadge}>
                          {DIFFICULTY_LABEL[item.difficulty]}
                        </Text>
                      ) : null}
                    </View>
                    {item.tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {item.tags.slice(0, 4).map((t) => (
                          <Text key={t.id} style={styles.tag}>{t.tag}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.forkButton, forkingId === item.id && styles.disabled]}
                    onPress={() => { void handleFork(item); }}
                    disabled={forkingId === item.id}
                  >
                    {forkingId === item.id
                      ? <ActivityIndicator color="#f97316" size="small" />
                      : <Text style={styles.forkButtonText}>Fork</Text>}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  style={[styles.pageButton, offset === 0 && styles.disabled]}
                >
                  <Text style={styles.pageButtonText}>← Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {currentPage} / {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={() => setOffset(offset + limit)}
                  disabled={currentPage >= totalPages}
                  style={[styles.pageButton, currentPage >= totalPages && styles.disabled]}
                >
                  <Text style={styles.pageButtonText}>Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  signOutLink: { fontSize: 14, color: "#9ca3af" },
  searchRow: { paddingHorizontal: 16, paddingBottom: 6 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  searchInput: { width: "100%" },
  filterInput: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", lineHeight: 20 },
  cardDesc: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  metaText: { fontSize: 12, color: "#9ca3af" },
  difficultyBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ea580c",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: {
    fontSize: 11,
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  forkButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: "center",
  },
  forkButtonText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  disabled: { opacity: 0.4 },
  emptyText: { fontSize: 15, color: "#9ca3af", textAlign: "center" },
  errorText: { color: "#dc2626", fontSize: 13 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  pageButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pageButtonText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  pageInfo: { fontSize: 13, color: "#9ca3af" },
});
