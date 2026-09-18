import React, { useCallback, useEffect, useState } from "react";
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
import type { CookLogEntry, RecipeWithDetails, Substitution } from "@souschef/shared";
import { hasSubstitutions, scaleQuantity, unwrap } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";
import CollectionPicker from "../../../../components/CollectionPicker";
import CookLogPanel from "../../../../components/CookLogPanel";
import CookLogSheet from "../../../../components/CookLogSheet";
import SourceAttribution from "../../../../components/SourceAttribution";
import SubstitutionSheet from "../../../../components/SubstitutionSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../../../../components/ThemeProvider";
import type { Palette } from "../../../../lib/theme";

/** Matches the web page's cap. Beyond this the arithmetic stops meaning much. */
const MAX_SERVINGS = 200;

export default function RecipeDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pickerOpen, setPickerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { id, log } = useLocalSearchParams<{ id: string; log?: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** null means "as written" — distinct from having chosen the original number. */
  const [adjustedServings, setAdjustedServings] = useState<number | null>(null);

  const [cookLog, setCookLog] = useState<CookLogEntry[]>([]);
  const [cookLogLoading, setCookLogLoading] = useState(true);
  const [cookLogError, setCookLogError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CookLogEntry | null>(null);

  /** The ingredient whose substitutions are open, by id. */
  const [subsFor, setSubsFor] = useState<string | null>(null);

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

  // Separate from the recipe, and allowed to fail on its own. The cook log is
  // an extra on this screen; a recipe that loads without it is still usable,
  // and one request failing should not blank the other.
  useEffect(() => {
    async function loadLog(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.cookLog(id);
        if ("error" in res) throw new Error(res.error.message);
        setCookLog(res.data.entries);
      } catch (err) {
        setCookLogError(err instanceof Error ? err.message : "Couldn't load your cook log");
      } finally {
        setCookLogLoading(false);
      }
    }
    void loadLog();
  }, [id]);

  // Cooking mode sends the user back here with ?log=1 after they finish.
  useEffect(() => {
    if (log === "1") {
      setEditingEntry(null);
      setSheetOpen(true);
      // Clear the param, or a later back-navigation to this screen reopens the
      // sheet for a cook that was already logged.
      router.setParams({ log: undefined });
    }
  }, [log, router]);

  const handleSaved = useCallback((entry: CookLogEntry): void => {
    setCookLog((prev) => {
      const without = prev.filter((e) => e.id !== entry.id);
      return [entry, ...without].sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
    });
    setSheetOpen(false);
    setEditingEntry(null);
  }, []);

  /**
   * Swap an ingredient for a substitute, on screen only.
   *
   * Not persisted, and the sheet says as much. Cooking with oat milk tonight
   * is not a decision about what the recipe is, and writing it through would
   * quietly rewrite a recipe someone may have shared or imported.
   */
  function handleReplace(ingredientId: string, sub: Substitution): void {
    setRecipe((prev) =>
      prev
        ? {
            ...prev,
            ingredients: prev.ingredients.map((ing) =>
              ing.id === ingredientId ? { ...ing, name: sub.name } : ing,
            ),
          }
        : prev,
    );
    setSubsFor(null);
  }

  function handleDelete(): void {
    Alert.alert("Delete recipe", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const api = await getApiClient();
          unwrap(await api.recipes.delete(id));
          router.replace("/(app)/recipes");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
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
  const servings = adjustedServings ?? recipe.servings;
  const isScaled = servings !== recipe.servings;
  const scaleFactor = servings / recipe.servings;
  const hasIngredients = recipe.ingredients.length > 0;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.description && (
        <Text style={styles.description}>{recipe.description}</Text>
      )}
      <SourceAttribution
        sourceUrl={recipe.sourceUrl}
        sourceModified={recipe.sourceModified}
      />

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
          onPress={() => { setEditingEntry(null); setSheetOpen(true); }}
        >
          <Text style={styles.editButtonText}>Log cook</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/(app)/recipes/${id}/edit`)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={styles.editButtonText}>Collections</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        {/* Servings only lives here when there is nothing to scale. Otherwise
            it is the stepper below, next to the quantities it changes — a
            number in this row and a separate control elsewhere would be two
            places showing the same fact. */}
        {!hasIngredients && <MetaItem label="Servings" value={String(recipe.servings)} />}
        {totalMins > 0 && <MetaItem label="Total" value={`${totalMins} min`} />}
        {recipe.prepTimeMinutes && <MetaItem label="Prep" value={`${recipe.prepTimeMinutes} min`} />}
        {recipe.cookTimeMinutes && <MetaItem label="Cook" value={`${recipe.cookTimeMinutes} min`} />}
        {recipe.difficulty && <MetaItem label="Difficulty" value={recipe.difficulty} />}
        {recipe.cuisine && <MetaItem label="Cuisine" value={recipe.cuisine} />}
        <MetaItem label="Visibility" value={recipe.isPublic ? "Public" : "Private"} />
      </View>

      {/* Ingredients */}
      {hasIngredients && (
        <View style={styles.section}>
          <View style={styles.ingredientsHeader}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setAdjustedServings(Math.max(1, servings - 1))}
                disabled={servings <= 1}
                accessibilityLabel="Decrease servings"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.stepperBtnText, servings <= 1 && styles.stepperDisabled]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepperValue, isScaled && styles.stepperValueScaled]}>
                {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setAdjustedServings(Math.min(MAX_SERVINGS, servings + 1))}
                disabled={servings >= MAX_SERVINGS}
                accessibilityLabel="Increase servings"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.stepperBtnText, servings >= MAX_SERVINGS && styles.stepperDisabled]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isScaled && (
            <View style={styles.scaledBanner}>
              <Text style={styles.scaledText}>
                Scaled from {recipe.servings}. The recipe itself is unchanged.
              </Text>
              <TouchableOpacity onPress={() => setAdjustedServings(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>
          )}

          {recipe.ingredients.some((ing) => hasSubstitutions(ing.name)) && (
            <Text style={styles.subsHint}>
              Underlined ingredients have substitutions — tap one.
            </Text>
          )}

          {recipe.ingredients.map((ing) => {
            const quantity = scaleQuantity(ing.quantity, ing.name, scaleFactor);
            const swappable = hasSubstitutions(ing.name);
            return (
              <View key={ing.id} style={styles.ingredientRow}>
                {quantity !== null && (
                  <Text style={[styles.ingredientQty, isScaled && styles.ingredientQtyScaled]}>
                    {quantity}{ing.unit ? ` ${ing.unit}` : ""}
                  </Text>
                )}
                {/* Only the ones with something to show are tappable. A tap
                    target that opens an empty sheet teaches people not to
                    bother trying the next one. */}
                {swappable ? (
                  <TouchableOpacity
                    style={styles.ingredientNameWrap}
                    onPress={() => setSubsFor(ing.id)}
                    accessibilityRole="button"
                    accessibilityHint={`Show what you can use instead of ${ing.name}`}
                  >
                    <Text style={[styles.ingredientName, styles.ingredientSwappable]}>
                      {ing.name}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                )}
                {ing.notes && <Text style={styles.ingredientNotes}>({ing.notes})</Text>}
              </View>
            );
          })}
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

      <CookLogPanel
        recipeId={id}
        entries={cookLog}
        loading={cookLogLoading}
        error={cookLogError}
        onEdit={(entry) => { setEditingEntry(entry); setSheetOpen(true); }}
        onRemoved={(entryId) => setCookLog((prev) => prev.filter((e) => e.id !== entryId))}
      />

      <CookLogSheet
        visible={sheetOpen}
        recipeId={id}
        entry={editingEntry}
        onClose={() => { setSheetOpen(false); setEditingEntry(null); }}
        onSaved={handleSaved}
      />

      <SubstitutionSheet
        ingredientName={
          recipe.ingredients.find((ing) => ing.id === subsFor)?.name ?? null
        }
        onReplace={(sub) => { if (subsFor) handleReplace(subsFor, sub); }}
        onClose={() => setSubsFor(null)}
      />

      <CollectionPicker
        visible={pickerOpen}
        recipeId={id}
        onClose={() => setPickerOpen(false)}
      />
    </ScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: t.danger, fontSize: 13 },
  title: { fontSize: 26, fontWeight: "700", color: t.text, marginBottom: 6 },
  description: { fontSize: 14, color: t.textMuted, marginBottom: 8, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  cookButton: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  cookButtonText: { fontSize: 13, fontWeight: "600", color: t.onAccent },
  editButton: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  editButtonText: { fontSize: 13, fontWeight: "600", color: t.textSecondary },
  deleteButton: { borderWidth: 1, borderColor: t.dangerBorder, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  deleteButtonText: { fontSize: 13, fontWeight: "600", color: t.danger },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: t.border },
  metaItem: { alignItems: "center" },
  metaLabel: { fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 13, fontWeight: "600", color: t.text, marginTop: 2, textTransform: "capitalize" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: t.text, marginBottom: 12 },
  ingredientsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.surface,
  },
  stepperBtnText: { fontSize: 17, lineHeight: 20, color: t.textMuted, fontWeight: "600" },
  stepperDisabled: { color: t.border },
  stepperValue: { fontSize: 13, fontWeight: "600", color: t.textSecondary, fontVariant: ["tabular-nums"] },
  stepperValueScaled: { color: t.accentStrong },
  scaledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: t.accentSurface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  scaledText: { flex: 1, fontSize: 12, color: t.accentText, lineHeight: 17 },
  resetText: { fontSize: 12, fontWeight: "700", color: t.accentStrong },
  ingredientRow: { flexDirection: "row", gap: 6, alignItems: "baseline", paddingVertical: 4 },
  ingredientQty: { fontSize: 13, fontWeight: "600", color: t.text, minWidth: 60 },
  ingredientQtyScaled: { color: t.accentStrong },
  ingredientName: { fontSize: 13, color: t.textSecondary, flex: 1 },
  ingredientNameWrap: { flex: 1 },
  ingredientSwappable: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: t.border,
  },
  subsHint: { fontSize: 12, color: t.textFaint, marginBottom: 8, marginTop: -4 },
  ingredientNotes: { fontSize: 12, color: t.textFaint },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.accentSurface, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumberText: { fontSize: 12, fontWeight: "700", color: t.accent },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },
  stepTimer: { fontSize: 11, color: t.textFaint, marginTop: 4 },
});
