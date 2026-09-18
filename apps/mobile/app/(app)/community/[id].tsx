import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CommunityRecipe } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../../../components/Avatar";
import SourceAttribution from "../../../components/SourceAttribution";

export default function CommunityRecipeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // CommunityRecipe, not RecipeWithDetails — see the note on the browse
  // screen. The creator and like count were being returned and thrown away.
  const [recipe, setRecipe] = useState<CommunityRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.community.get(id);
        if ("error" in res) throw new Error(res.error.message);
        setRecipe(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleFork(): Promise<void> {
    setForking(true);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(id);
      if ("error" in res) throw new Error(res.error.message);
      router.replace(`/(app)/recipes/${res.data.id}`);
    } catch (err) {
      Alert.alert("Fork failed", err instanceof Error ? err.message : "Something went wrong");
      setForking(false);
    }
  }

  /** Optimistic, and put back on failure. Same reasoning as the browse list. */
  async function handleLike(): Promise<void> {
    if (!recipe) return;
    const wasLiked = recipe.isLiked;
    setLiking(true);
    applyLike(!wasLiked);
    try {
      const api = await getApiClient();
      const res = wasLiked
        ? await api.community.unlike(recipe.id)
        : await api.community.like(recipe.id);
      if ("error" in res) throw new Error(res.error.message);
    } catch {
      applyLike(wasLiked);
    } finally {
      setLiking(false);
    }
  }

  function applyLike(liked: boolean): void {
    setRecipe((prev) =>
      prev
        ? {
            ...prev,
            isLiked: liked,
            likeCount: liked ? prev.likeCount + 1 : Math.max(0, prev.likeCount - 1),
          }
        : prev,
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#f97316" /></View>;
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Recipe not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Back + fork header */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Community</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.forkButton, forking && styles.disabled]}
          onPress={() => { void handleFork(); }}
          disabled={forking}
        >
          {forking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.forkButtonText}>Fork recipe</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.description ? (
        <Text style={styles.description}>{recipe.description}</Text>
      ) : null}

      {/* Where it came from, if it was imported. Shown on someone else's
          recipe for the same reason it is shown on your own: the original
          site is owed the credit whoever is reading. */}
      <SourceAttribution
        sourceUrl={recipe.sourceUrl}
        sourceModified={recipe.sourceModified}
      />

      {/* Who made it, and the like. Directly under the title, because "whose
          recipe is this" is the first question on a screen full of strangers'
          cooking. */}
      <View style={styles.byline}>
        <TouchableOpacity
          style={styles.creatorRow}
          onPress={() => router.push(`/(app)/users/${recipe.creatorId}`)}
        >
          <Avatar displayName={recipe.creatorName} avatarUrl={null} size={28} />
          <Text style={styles.creatorName}>{recipe.creatorName}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.likeBtn}
          onPress={() => { void handleLike(); }}
          disabled={liking}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={recipe.isLiked ? "Unlike this recipe" : "Like this recipe"}
          accessibilityState={{ selected: recipe.isLiked }}
        >
          <Ionicons
            name={recipe.isLiked ? "heart" : "heart-outline"}
            size={19}
            color={recipe.isLiked ? "#f43f5e" : "#9ca3af"}
          />
          <Text style={[styles.likeCount, recipe.isLiked && styles.likeCountOn]}>
            {recipe.likeCount}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{recipe.servings} servings</Text>
        {totalMins > 0 && <Text style={styles.metaText}>{totalMins} min total</Text>}
        {recipe.prepTimeMinutes ? <Text style={styles.metaText}>{recipe.prepTimeMinutes} min prep</Text> : null}
        {recipe.cookTimeMinutes ? <Text style={styles.metaText}>{recipe.cookTimeMinutes} min cook</Text> : null}
        {recipe.difficulty ? <Text style={styles.metaText}>{recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</Text> : null}
        {recipe.cuisine ? <Text style={styles.metaText}>{recipe.cuisine}</Text> : null}
      </View>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <View style={styles.tagRow}>
          {recipe.tags.map((t) => (
            <Text key={t.id} style={styles.tag}>{t.tag}</Text>
          ))}
        </View>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients.map((ing) => (
            <View key={ing.id} style={styles.ingredientRow}>
              {ing.quantity != null && (
                <Text style={styles.ingredientQty}>
                  {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
                </Text>
              )}
              <Text style={styles.ingredientName}>{ing.name}</Text>
              {ing.notes ? <Text style={styles.ingredientNotes}>({ing.notes})</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Method</Text>
          {recipe.steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                {step.timerSeconds ? (
                  <Text style={styles.stepTimer}>
                    Timer: {Math.round(step.timerSeconds / 60)} min
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Bottom fork CTA */}
      <View style={styles.bottomCta}>
        <Text style={styles.bottomCtaText}>
          Like this recipe? Fork it to add it to your collection.
        </Text>
        <TouchableOpacity
          style={[styles.forkButton, forking && styles.disabled]}
          onPress={() => { void handleFork(); }}
          disabled={forking}
        >
          {forking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.forkButtonText}>Fork recipe</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backLink: { fontSize: 14, color: "#f97316" },
  title: { fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 8 },
  description: { fontSize: 14, color: "#6b7280", marginBottom: 10, lineHeight: 21 },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  creatorName: { fontSize: 14, fontWeight: "600", color: "#f97316", flexShrink: 1 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontSize: 14, color: "#9ca3af", fontVariant: ["tabular-nums"] },
  likeCountOn: { color: "#f43f5e", fontWeight: "600" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  metaText: { fontSize: 13, color: "#9ca3af" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  tag: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 10 },
  ingredientRow: { flexDirection: "row", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  ingredientQty: { fontSize: 14, fontWeight: "600", color: "#111827" },
  ingredientName: { fontSize: 14, color: "#374151" },
  ingredientNotes: { fontSize: 13, color: "#9ca3af" },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberText: { fontSize: 11, fontWeight: "700", color: "#ea580c" },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: 14, color: "#374151", lineHeight: 21 },
  stepTimer: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
  bottomCta: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 20, gap: 12, alignItems: "flex-start" },
  bottomCtaText: { fontSize: 14, color: "#6b7280" },
  forkButton: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: "center" },
  forkButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  errorText: { color: "#dc2626", fontSize: 14 },
});
