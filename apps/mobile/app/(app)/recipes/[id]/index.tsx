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
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";

export default function RecipeDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.get(id);
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

  function handleDelete(): void {
    Alert.alert("Delete recipe", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const api = await getApiClient();
          await api.recipes.delete(id);
          router.replace("/(app)/recipes");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Recipe not found"}</Text>
      </View>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.description && (
        <Text style={styles.description}>{recipe.description}</Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {recipe.steps.length > 0 && (
          <TouchableOpacity
            style={styles.cookButton}
            onPress={() => router.push(`/(app)/recipes/${id}/cook`)}
          >
            <Text style={styles.cookButtonText}>Start cooking</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/(app)/recipes/${id}/edit`)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        <MetaItem label="Servings" value={String(recipe.servings)} />
        {totalMins > 0 && <MetaItem label="Total" value={`${totalMins} min`} />}
        {recipe.prepTimeMinutes && <MetaItem label="Prep" value={`${recipe.prepTimeMinutes} min`} />}
        {recipe.cookTimeMinutes && <MetaItem label="Cook" value={`${recipe.cookTimeMinutes} min`} />}
        {recipe.difficulty && <MetaItem label="Difficulty" value={recipe.difficulty} />}
        {recipe.cuisine && <MetaItem label="Cuisine" value={recipe.cuisine} />}
        <MetaItem label="Visibility" value={recipe.isPublic ? "Public" : "Private"} />
      </View>

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
              {ing.notes && <Text style={styles.ingredientNotes}>({ing.notes})</Text>}
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
                {step.timerSeconds && (
                  <Text style={styles.stepTimer}>
                    Timer: {Math.round(step.timerSeconds / 60)} min
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#dc2626", fontSize: 13 },
  title: { fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 6 },
  description: { fontSize: 14, color: "#6b7280", marginBottom: 16, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  cookButton: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  cookButtonText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  editButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  editButtonText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  deleteButton: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  deleteButtonText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  metaItem: { alignItems: "center" },
  metaLabel: { fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 13, fontWeight: "600", color: "#111827", marginTop: 2, textTransform: "capitalize" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 12 },
  ingredientRow: { flexDirection: "row", gap: 6, alignItems: "baseline", paddingVertical: 4 },
  ingredientQty: { fontSize: 13, fontWeight: "600", color: "#111827", minWidth: 60 },
  ingredientName: { fontSize: 13, color: "#374151", flex: 1 },
  ingredientNotes: { fontSize: 12, color: "#9ca3af" },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff7ed", alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumberText: { fontSize: 12, fontWeight: "700", color: "#f97316" },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: 13, color: "#374151", lineHeight: 20 },
  stepTimer: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
});
