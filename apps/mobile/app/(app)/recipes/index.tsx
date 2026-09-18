import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { OnboardingState, Recipe } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingChecklist from "../../../components/OnboardingChecklist";

export default function RecipeListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paging. This list previously called api.recipes.list() with no arguments,
  // took the first page, and stopped — so anyone past twenty recipes simply
  // could not reach the rest of their own library by scrolling.
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // A ref rather than state: FlatList fires onEndReached several times per
  // threshold crossing, and state would not have settled between them, so two
  // requests would go out for the same page. Same reason the community screen
  // keeps one.
  const inFlightRef = useRef(false);

  /**
   * Fetches a page. A null cursor means the first one, and replaces what is on
   * screen; anything else appends.
   */
  const load = useCallback(
    async (pageCursor: string | null, isRefresh = false): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const isFirstPage = pageCursor === null;
      if (isFirstPage && !isRefresh) setLoading(true);
      if (!isFirstPage) setLoadingMore(true);
      setError(null);

      try {
        const api = await getApiClient();
        const res = await api.recipes.list({ cursor: pageCursor ?? undefined });
        if ("error" in res) throw new Error(res.error.message);

        setRecipes((prev) =>
          isFirstPage ? res.data.recipes : [...prev, ...res.data.recipes],
        );
        setCursor(res.data.nextCursor);
        setHasMore(res.data.nextCursor !== null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipes");
        // Stop paging on failure. Otherwise every further scroll retries the
        // same broken request and the error flickers on and off as the user
        // moves — one message that stays put is easier to act on.
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        inFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => { void load(null); }, [load]);

  /**
   * Onboarding progress, refreshed whenever this tab regains focus.
   *
   * On focus rather than on mount: every step is completed on some *other*
   * screen, so a checklist that only loaded once would still be showing "plan
   * a few meals" as outstanding after the user came back from doing exactly
   * that.
   *
   * Failures are swallowed. The checklist is an aid; a recipe list that
   * refuses to render because a progress call failed would be a worse trade.
   */
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function loadOnboarding(): Promise<void> {
        try {
          const api = await getApiClient();
          const res = await api.users.onboarding();
          if (cancelled || "error" in res) return;
          setOnboarding(res.data);
        } catch {
          // Deliberately ignored — see above.
        }
      }
      void loadOnboarding();
      return () => { cancelled = true; };
    }, []),
  );

  function onRefresh(): void {
    setRefreshing(true);
    setHasMore(true);
    void load(null, true);
  }

  function handleEndReached(): void {
    if (!hasMore || inFlightRef.current || loading) return;
    void load(cursor);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My recipes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(app)/recipes/new")}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
        onEndReached={handleEndReached}
        // Half a screen from the bottom. Firing at the very end means the
        // spinner appears after the scroll has already stopped, which reads as
        // the list having ended.
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#f97316" />
            </View>
          ) : null
        }
        // Above the list rather than inside it, so it scrolls away once the
        // user has recipes instead of sitting between them and their food.
        // Gone entirely once the loop is finished — this is a way in, not a
        // permanent fixture.
        ListHeaderComponent={
          onboarding && !onboarding.complete && recipes.length > 0 ? (
            <View style={styles.checklistWrap}>
              <OnboardingChecklist state={onboarding} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          onboarding ? (
            // A brand-new account gets the checklist as the empty state, with
            // a greeting on top. No modal and nothing to dismiss: it stops
            // appearing when they have a recipe, which is the same fact the
            // server derives `fresh` from.
            <View style={styles.emptyChecklist}>
              <OnboardingChecklist state={onboarding} welcome={onboarding.fresh} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recipes yet.</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/(app)/recipes/new")}
              >
                <Text style={styles.addButtonText}>Add your first recipe</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const totalMins = (item.prepTimeMinutes ?? 0) + (item.cookTimeMinutes ?? 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/recipes/${item.id}`)}
            >
              {/* A photo runs the full width of the card, above the title,
                  rather than as a thumbnail beside it. The thumbnail version
                  needed a placeholder tile on every recipe without a picture
                  to keep the titles aligned, which meant most of the list was
                  empty grey squares — solving alignment at the expense of the
                  thing you actually look at.

                  Recipes without a photo now get a plain text card and no
                  placeholder at all. The two shapes differ, which is the
                  point: a recipe with a picture should look different from one
                  without, instead of both being compromised into the same row. */}
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              )}

              <View style={styles.cardText}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
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
  headerActions: { flexDirection: "row", gap: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyChecklist: { padding: 16 },
  checklistWrap: { marginBottom: 4 },
  emptyText: { fontSize: 14, color: "#6b7280" },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    // So the photo's corners follow the card's rather than squaring them off.
    overflow: "hidden",
  },
  // 16:9 rather than a fixed height, so it holds its shape on any screen width.
  cardImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#f3f4f6" },
  cardText: { padding: 14, gap: 4 },
  footerLoading: { paddingVertical: 20, alignItems: "center" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  badge: { backgroundColor: "#fff7ed", color: "#f97316", fontSize: 11, fontWeight: "600", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, textTransform: "capitalize" },
  cardDesc: { marginTop: 4, fontSize: 13, color: "#6b7280" },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: "#9ca3af" },
  addButton: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.5 },
  importButton: { backgroundColor: "#fff7ed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#fed7aa" },
  importButtonText: { color: "#f97316", fontWeight: "600", fontSize: 13 },
  // modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827", marginBottom: 8 },
  importError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 14 },
});
