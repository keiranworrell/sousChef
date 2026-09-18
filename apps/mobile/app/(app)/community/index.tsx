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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { CommunityRecipe } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function CommunityScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // CommunityRecipe, not RecipeWithDetails. The endpoint has always returned
  // the creator and the like count on top of the recipe; this screen was typed
  // one level too narrow, so those three fields were invisible to it. Neither
  // likes nor any route to the cook existed here — not because they were cut,
  // but because nothing ever told the screen they were there.
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [tag, setTag] = useState("");

  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  const [forkingId, setForkingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FlatList fires onEndReached more than once per threshold crossing, so the
  // guard has to be a ref — state wouldn't have settled between calls.
  const inFlightRef = useRef(false);

  const load = useCallback(
    async (params: {
      q: string;
      cuisine: string;
      tag: string;
      cursor: string | null;
    }): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const isFirstPage = params.cursor === null;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const api = await getApiClient();
        const res = await api.community.list({
          q: params.q || undefined,
          cuisine: params.cuisine || undefined,
          tag: params.tag || undefined,
          limit,
          cursor: params.cursor ?? undefined,
        });
        if ("error" in res) throw new Error(res.error.message);
        setRecipes((prev) =>
          isFirstPage ? res.data.recipes : [...prev, ...res.data.recipes],
        );
        setCursor(res.data.nextCursor);
        setHasMore(res.data.nextCursor !== null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        inFlightRef.current = false;
      }
    },
    [],
  );

  // Filter changes reset to the first page. The second effect that previously
  // watched `offset` is gone — paging is now driven by onEndReached instead.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCursor(null);
      setHasMore(true);
      inFlightRef.current = false;
      void load({ q, cuisine, tag, cursor: null });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, cuisine, tag, load]);

  function handleEndReached(): void {
    if (!hasMore || inFlightRef.current || loading) return;
    void load({ q, cuisine, tag, cursor });
  }

  async function handleFork(recipe: CommunityRecipe): Promise<void> {
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

  /**
   * Like and unlike, optimistically.
   *
   * A heart that waits for a round trip before filling feels broken, so the
   * card updates first and is put back if the request fails. No alert on
   * failure: the heart springing back is the message, and a modal over a
   * browse list for something this small would be worse than the failure.
   */
  async function handleLike(recipe: CommunityRecipe): Promise<void> {
    const wasLiked = recipe.isLiked;
    setLikingId(recipe.id);
    applyLike(recipe.id, !wasLiked);
    try {
      const api = await getApiClient();
      const res = wasLiked
        ? await api.community.unlike(recipe.id)
        : await api.community.like(recipe.id);
      if ("error" in res) throw new Error(res.error.message);
    } catch {
      applyLike(recipe.id, wasLiked);
    } finally {
      setLikingId(null);
    }
  }

  function applyLike(recipeId: string, liked: boolean): void {
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? {
              ...r,
              isLiked: liked,
              // Clamped, for the same reason follower counts are: a stale card
              // can otherwise render "-1 likes".
              likeCount: liked ? r.likeCount + 1 : Math.max(0, r.likeCount - 1),
            }
          : r,
      ),
    );
  }


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Community</Text>
        <TouchableOpacity onPress={() => router.push("/(app)/community/collections")}>
          <Text style={styles.collectionsLink}>Collections →</Text>
        </TouchableOpacity>
      </View>

      {/* Search / filters */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          placeholder="Search recipes…"
          value={q}
          onChangeText={setQ}
          placeholderTextColor={palette.textFaint}
        />
      </View>
      <View style={styles.filterRow}>
        <TextInput
          style={[styles.input, styles.filterInput]}
          placeholder="Cuisine"
          value={cuisine}
          onChangeText={setCuisine}
          placeholderTextColor={palette.textFaint}
        />
        <TextInput
          style={[styles.input, styles.filterInput]}
          placeholder="Tag"
          value={tag}
          onChangeText={setTag}
          placeholderTextColor={palette.textFaint}
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
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
                      ? <ActivityIndicator color={palette.accent} size="small" />
                      : <Text style={styles.forkButtonText}>Fork</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.cardFooter}>
                  {/* A separate tap target inside the card, and the reason the
                      whole row is not a single button any more: the creator's
                      name has to go somewhere you can actually reach them. */}
                  <TouchableOpacity
                    onPress={() => router.push(`/(app)/users/${item.creatorId}`)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={styles.creator}>{item.creatorName}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.likeBtn}
                    onPress={() => { void handleLike(item); }}
                    disabled={likingId === item.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={
                      item.isLiked ? "Unlike this recipe" : "Like this recipe"
                    }
                    accessibilityState={{ selected: item.isLiked }}
                  >
                    <Ionicons
                      name={item.isLiked ? "heart" : "heart-outline"}
                      size={17}
                      color={item.isLiked ? palette.like : palette.textFaint}
                    />
                    <Text style={[styles.likeCount, item.isLiked && styles.likeCountOn]}>
                      {item.likeCount}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          onEndReached={handleEndReached}
          // Fires when the user is within half a screen of the end, so the next
          // page is usually in place before they reach the bottom.
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerStatus}>
                <ActivityIndicator color={palette.accent} size="small" />
              </View>
            ) : !hasMore && recipes.length > 0 ? (
              <View style={styles.footerStatus}>
                <Text style={styles.footerStatusText}>That&apos;s all of them</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: t.text },
  collectionsLink: { fontSize: 13, fontWeight: "600", color: t.accent },
  searchRow: { paddingHorizontal: 16, paddingBottom: 6 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
  },
  searchInput: { width: "100%" },
  filterInput: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  creator: { fontSize: 12, fontWeight: "600", color: t.accent },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { fontSize: 12, color: t.textFaint, fontVariant: ["tabular-nums"] },
  likeCountOn: { color: t.like, fontWeight: "600" },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: t.text, lineHeight: 20 },
  cardDesc: { fontSize: 13, color: t.textMuted, lineHeight: 18 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  metaText: { fontSize: 12, color: t.textFaint },
  difficultyBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: t.accentStrong,
    backgroundColor: t.accentSurface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: {
    fontSize: 11,
    color: t.textMuted,
    backgroundColor: t.surfaceSunken,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  forkButton: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: "center",
  },
  forkButtonText: { fontSize: 13, fontWeight: "600", color: t.textSecondary },
  disabled: { opacity: 0.4 },
  emptyText: { fontSize: 15, color: t.textFaint, textAlign: "center" },
  errorText: { color: t.danger, fontSize: 13 },
  footerStatus: { paddingVertical: 20, alignItems: "center" },
  footerStatusText: { fontSize: 13, color: t.textFaint },
});
